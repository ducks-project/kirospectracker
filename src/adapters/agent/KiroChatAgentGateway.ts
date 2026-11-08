import type { ISpecSnapshot } from '../../core/model/ISpecSnapshot';
import type {
  ISpecAgentGateway,
  RunScope,
  SpecAgentAvailability,
} from '../../core/ports/ISpecAgentGateway';
import type { IAgentDiagnosticSink } from '../ports/IAgentDiagnosticSink';
import type { IAgentErrorReporter } from '../ports/IAgentErrorReporter';
import type { IAgentNotifier } from '../ports/IAgentNotifier';
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
 * The send path selected for a given command surface.
 *
 * It is a discriminated union so the pure decision ({@link selectDispatchPath})
 * can be unit-tested in isolation and the caller can both drive the right side
 * effect AND tailor an honest notification to the path actually taken:
 * - `queue`: the direct-argument queue command truly submits the prompt.
 * - `paste`: the focus + clipboard-paste workaround, which does NOT reliably
 *   submit (the user may need to press Enter).
 * - `chat-open`: the generic host chat is opened pre-filled; it may need to be
 *   sent, and it is not Kiro's spec engine.
 * - `none`: no usable command surface exists.
 */
export type DispatchPath = 'queue' | 'paste' | 'chat-open' | 'none';

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
 * Pure selection rule: pick the most robust send path for a command surface.
 *
 * It holds NO side effect so it is exhaustively unit-testable, and it is the
 * single place the path order is decided (prefer the direct-argument queue
 * command, else the focus + clipboard-paste workaround, else the generic
 * chat-open fallback, else none), keeping the rule DRY.
 * @param ids The registered command ids.
 * @returns The selected {@link DispatchPath}.
 */
export function selectDispatchPath(ids: readonly string[]): DispatchPath {
  if (ids.includes(QUEUE_USER_MESSAGE)) {
    return 'queue';
  }
  if (ids.includes(SEND_MAIN_USER_INPUT) || ids.includes(FOCUS_CONTINUE_INPUT)) {
    return 'paste';
  }
  if (ids.includes(GENERIC_CHAT_OPEN)) {
    return 'chat-open';
  }
  return 'none';
}

/**
 * Best-effort adapter driving the Kiro agent, confining ALL fragility (the
 * undocumented `kiroAgent.*` command ids, the generic chat-open fallback, the
 * focus/paste timing, and the clipboard workaround) to this single class.
 *
 * It probes the command surface to report an honest {@link availability}, builds
 * every message from the fixed {@link SPEC_AGENT_MESSAGES} templates, then picks
 * the most robust available path via the pure {@link selectDispatchPath}. EVERY
 * taken path produces user-visible feedback: the direct-argument queue confirms
 * the prompt was sent; the paste workaround tells the user it was pasted and may
 * need Enter; the generic chat-open says the chat was opened and may need to be
 * sent; and when no command is usable the error reporter fires. Each action also
 * writes an observability line (the detected ids and the chosen path) to the
 * injected {@link IAgentDiagnosticSink}. A failure is surfaced through the error
 * reporter and NEVER thrown to the caller, so the UI never hard-fails.
 */
export class KiroChatAgentGateway implements ISpecAgentGateway {
  private readonly commands: ICommandGateway;

  private readonly reporter: IAgentErrorReporter;

  private readonly notifier: IAgentNotifier;

  private readonly diagnostics: IAgentDiagnosticSink;

  private readonly sleep: SleepFn;

  /**
   * Build the adapter over its command gateway, feedback channels and sink.
   * @param commands The thin command/clipboard gateway.
   * @param reporter The channel surfacing a best-effort failure.
   * @param notifier The channel confirming an honest success/affordance.
   * @param diagnostics The observability sink for the detected ids and path.
   * @param sleep The pausing function (defaults to a real timer).
   */
  public constructor(
    commands: ICommandGateway,
    reporter: IAgentErrorReporter,
    notifier: IAgentNotifier,
    diagnostics: IAgentDiagnosticSink,
    sleep: SleepFn = realSleep,
  ) {
    this.commands = commands;
    this.reporter = reporter;
    this.notifier = notifier;
    this.diagnostics = diagnostics;
    this.sleep = sleep;
  }

  /**
   * Report availability. This adapter is only built by the factory once the
   * capability probe ({@link isSupported}) has found a usable command surface,
   * so it reports `integrated`; the honest degradation path is the separate
   * Null-Object gateway the factory binds otherwise.
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
   * Send a message through the most robust available path, never throwing and
   * always giving the user honest, visible feedback.
   * @param message The fixed-template message to send.
   */
  private async send(message: string): Promise<void> {
    try {
      const ids = await this.commands.getCommands();
      const path = selectDispatchPath(ids);
      this.logDiagnostic(ids, path);
      await this.dispatch(message, ids, path);
      this.notify(message, path);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.reporter.showError(
        `Kiro Spec Tracker: the agent action could not be completed (${detail}).`,
      );
    }
  }

  /**
   * Run the side effect for the already-selected path. The `none` path takes no
   * command; its user feedback is raised by {@link notify}.
   * @param message The message to send.
   * @param ids The registered command ids.
   * @param path The path chosen by {@link selectDispatchPath}.
   */
  private async dispatch(
    message: string,
    ids: readonly string[],
    path: DispatchPath,
  ): Promise<void> {
    if ('queue' === path) {
      await this.commands.executeCommand(QUEUE_USER_MESSAGE, message);
      return;
    }
    if ('paste' === path) {
      await this.pasteAndSend(message, ids);
      return;
    }
    if ('chat-open' === path) {
      await this.commands.executeCommand(GENERIC_CHAT_OPEN, message);
    }
  }

  /**
   * Raise the honest, path-specific user feedback. Only `queue` claims a real
   * submission; `paste` and `chat-open` say what the user must still do, and
   * `none` surfaces the error so the action is never silent.
   * @param message The message that was (attempted to be) sent.
   * @param path The path chosen by {@link selectDispatchPath}.
   */
  private notify(message: string, path: DispatchPath): void {
    if ('queue' === path) {
      this.notifier.notifyInfo(`Kiro Spec Tracker: sent to Kiro chat \u2014 "${message}".`);
      return;
    }
    if ('paste' === path) {
      this.notifier.notifyInfo(
        `Kiro Spec Tracker: pasted "${message}" into the Kiro chat \u2014 press Enter to run it.`,
      );
      return;
    }
    if ('chat-open' === path) {
      this.notifier.notifyInfo(
        `Kiro Spec Tracker: opened the chat with "${message}" \u2014 you may need to send it.`,
      );
      return;
    }
    this.reporter.showError(
      'Kiro Spec Tracker: no Kiro chat command is available to run this action.',
    );
  }

  /**
   * Write one observability line naming the detected Kiro/chat command ids and
   * the chosen dispatch path, so a tester can report what their host exposes.
   * @param ids The registered command ids.
   * @param path The path chosen by {@link selectDispatchPath}.
   */
  private logDiagnostic(ids: readonly string[], path: DispatchPath): void {
    const kiroIds = ids.filter((id) => id.startsWith(KIRO_AGENT_PREFIX));
    const detected = 0 < kiroIds.length ? kiroIds.join(', ') : '(none)';
    const genericChat = ids.includes(GENERIC_CHAT_OPEN) ? 'yes' : 'no';
    this.diagnostics.append(
      `agent action: path=${path}; kiroAgent ids=[${detected}]; generic chat-open=${genericChat}`,
    );
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
