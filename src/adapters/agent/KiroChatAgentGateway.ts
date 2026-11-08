import type { ISpecSnapshot } from '../../core/model/ISpecSnapshot';
import type {
  ISpecAgentGateway,
  RunScope,
  SpecAgentAvailability,
} from '../../core/ports/ISpecAgentGateway';
import type { IAgentErrorReporter } from '../ports/IAgentErrorReporter';
import type { ICommandGateway } from '../ports/ICommandGateway';
import { runMessageForScope, SPEC_AGENT_MESSAGES } from '../../core/SpecAgentMessages';

/** Undocumented Kiro command taking the prompt directly as an argument. */
const QUEUE_USER_MESSAGE = 'kiroAgent.executions.queueUserMessage';

/** Undocumented Kiro command focusing the chat input (precedes a paste). */
const FOCUS_CONTINUE_INPUT = 'kiroAgent.focusContinueInput';

/** Undocumented Kiro command sending the text already in the chat input. */
const SEND_MAIN_USER_INPUT = 'kiroAgent.sendMainUserInput';

/** Generic VS Code command pasting the clipboard into the focused control. */
const CLIPBOARD_PASTE = 'editor.action.clipboardPasteAction';

/** Generic VS Code chat-open command used as the last-resort fallback. */
const GENERIC_CHAT_OPEN = 'workbench.action.chat.open';

/** Prefix identifying the undocumented Kiro agent command surface. */
const KIRO_AGENT_PREFIX = 'kiroAgent.';

/** Delay (ms) after focusing the chat input before writing+pasting. */
const FOCUS_DELAY_MS = 300;

/** Delay (ms) after pasting before asking Kiro to send the input. */
const PASTE_DELAY_MS = 200;

/**
 * A pausing function, injected so the focus/paste timing can be a no-op in unit
 * tests and a real timer in production.
 */
export type SleepFn = (ms: number) => Promise<void>;

/** Real-timer sleep used in production. */
function realSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Best-effort adapter driving the Kiro agent, confining ALL fragility (the
 * undocumented `kiroAgent.*` command ids, the generic chat-open fallback, the
 * focus/paste timing, and the clipboard workaround) to this single class.
 *
 * It probes the command surface to report an honest {@link availability}, builds
 * every message from the fixed {@link SPEC_AGENT_MESSAGES} templates, then picks
 * the most robust available path (prefer the direct-argument queue command, else
 * the focus + clipboard-paste workaround that always restores the prior
 * clipboard, else the generic chat-open fallback). A failure is surfaced through
 * the injected error reporter and NEVER thrown to the caller, so the UI never
 * hard-fails. The selection/sequencing logic lives here and is unit-testable
 * against a fake {@link ICommandGateway}; only the raw `vscode` calls live in the
 * thin wrapper.
 */
export class KiroChatAgentGateway implements ISpecAgentGateway {
  private readonly commands: ICommandGateway;

  private readonly reporter: IAgentErrorReporter;

  private readonly sleep: SleepFn;

  /**
   * Build the adapter over the command gateway and the error reporter.
   * @param commands The thin command/clipboard gateway.
   * @param reporter The channel surfacing a best-effort failure.
   * @param sleep The pausing function (defaults to a real timer).
   */
  public constructor(
    commands: ICommandGateway,
    reporter: IAgentErrorReporter,
    sleep: SleepFn = realSleep,
  ) {
    this.commands = commands;
    this.reporter = reporter;
    this.sleep = sleep;
  }

  /**
   * Report availability. This adapter is only built by the factory once the
   * capability probe ({@link detectAgentCapability}) has found a usable command
   * surface, so it reports `integrated`; the honest degradation path is the
   * separate Null-Object gateway the factory binds otherwise.
   * @returns Always `integrated`.
   */
  // eslint-disable-next-line class-methods-use-this
  public availability(): SpecAgentAvailability {
    return 'integrated';
  }

  /**
   * Probe a command-id list for a usable Kiro (or generic chat) surface.
   *
   * Exposed as a static so the factory reuses the exact same detection rule the
   * send path relies on, keeping capability detection in one place (DRY).
   * @param ids The registered command ids from `getCommands(true)`.
   * @returns `true` when a `kiroAgent.*` or the generic chat-open command exists.
   */
  public static isSupported(ids: readonly string[]): boolean {
    return ids.some((id) => id.startsWith(KIRO_AGENT_PREFIX)) || ids.includes(GENERIC_CHAT_OPEN);
  }

  /**
   * Ask the agent to sync/update the spec's tasks.
   * @param spec The spec snapshot.
   */
  public async syncTasks(spec: ISpecSnapshot): Promise<void> {
    await this.send(SPEC_AGENT_MESSAGES.syncTasks(spec.name));
  }

  /**
   * Ask the agent to run the spec's tasks for the given scope.
   * @param spec The spec snapshot (its name disambiguates the target).
   * @param scope The run scope.
   */
  public async runTasks(spec: ISpecSnapshot, scope: RunScope): Promise<void> {
    await this.send(runMessageForScope(scope));
  }

  /**
   * Send a message through the most robust available path, never throwing.
   * @param message The fixed-template message to send.
   */
  private async send(message: string): Promise<void> {
    try {
      const ids = await this.commands.getCommands();
      const sent = await this.dispatch(message, ids);
      if (!sent) {
        this.reporter.showError(
          'Kiro Spec Tracker: no Kiro chat command is available to run this action.',
        );
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.reporter.showError(
        `Kiro Spec Tracker: the agent action could not be completed (${detail}).`,
      );
    }
  }

  /**
   * Select and run the best available send path for the detected commands.
   * @param message The message to send.
   * @param ids The registered command ids.
   * @returns `true` when a path was taken, `false` when none was available.
   */
  private async dispatch(message: string, ids: readonly string[]): Promise<boolean> {
    if (ids.includes(QUEUE_USER_MESSAGE)) {
      await this.commands.executeCommand(QUEUE_USER_MESSAGE, message);
      return true;
    }
    if (ids.includes(SEND_MAIN_USER_INPUT) || ids.includes(FOCUS_CONTINUE_INPUT)) {
      await this.pasteAndSend(message, ids);
      return true;
    }
    if (ids.includes(GENERIC_CHAT_OPEN)) {
      await this.commands.executeCommand(GENERIC_CHAT_OPEN, message);
      return true;
    }
    return false;
  }

  /**
   * Focus + clipboard-paste workaround, saving and ALWAYS restoring the prior
   * clipboard content around the paste (even if a step fails).
   * @param message The message to paste into the chat input.
   * @param ids The registered command ids.
   */
  private async pasteAndSend(message: string, ids: readonly string[]): Promise<void> {
    const previousClipboard = await this.commands.readClipboard();
    try {
      if (ids.includes(FOCUS_CONTINUE_INPUT)) {
        await this.commands.executeCommand(FOCUS_CONTINUE_INPUT);
        await this.sleep(FOCUS_DELAY_MS);
      }
      await this.commands.writeClipboard(message);
      await this.commands.executeCommand(CLIPBOARD_PASTE);
      await this.sleep(PASTE_DELAY_MS);
      if (ids.includes(SEND_MAIN_USER_INPUT)) {
        await this.commands.executeCommand(SEND_MAIN_USER_INPUT);
      }
    } finally {
      await this.commands.writeClipboard(previousClipboard);
    }
  }
}
