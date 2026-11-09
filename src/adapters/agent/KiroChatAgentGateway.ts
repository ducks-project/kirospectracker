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

/**
 * Undocumented Kiro command creating a chat session and returning its id.
 *
 * Reverse-engineered, non-documented and subject to change across Kiro builds.
 * Signature: `(): Promise<{ sessionId: string }>`.
 */
const SESSIONS_CREATE = 'kiroAgent.sessions.create';

/**
 * Undocumented Kiro command truly submitting a prompt into a given session.
 *
 * Reverse-engineered, non-documented and subject to change across Kiro builds.
 * Signature: `(sessionId: string, prompt: string): Promise<void>` (POSITIONAL
 * args, NOT an options object); it starts the agent run.
 */
const SESSIONS_SEND_PROMPT = 'kiroAgent.sessions.sendPrompt';

/**
 * Undocumented Kiro command filling the chat input, submitting when
 * `submit: true`.
 *
 * Reverse-engineered, non-documented and subject to change across Kiro builds.
 * Signature: `(opts: { prompt?, submit?, newSession?, ... }): Promise<void>`.
 */
const FOCUS_CHAT_INPUT = 'kiroAgent.focusChatInput';

/** Generic VS Code chat-open command used as the last-resort fallback. */
const GENERIC_CHAT_OPEN = 'workbench.action.chat.open';

/** Prefix identifying the undocumented Kiro agent command surface. */
const KIRO_AGENT_PREFIX = 'kiroAgent.';

/**
 * The send path actually taken for a given action, as a discriminated union so
 * the caller can drive honest, path-specific feedback and the diagnostic sink
 * can record exactly how the prompt was delivered on the user's host:
 * - `create+sendPrompt`: a fresh session was created and the prompt truly
 *   submitted (the agent run started).
 * - `focusInput-submit`: the chat input was filled and submitted in a (new)
 *   session (best-effort, depends on the chat webview being rendered).
 * - `focusInput-fill`: the chat input was only filled; the user must press
 *   Enter to run it.
 * - `chat-open`: the generic host chat was opened pre-filled; it may still need
 *   to be sent, and it is not Kiro's spec engine.
 * - `none`: no usable command surface exists.
 */
export type DispatchPath =
  | 'create+sendPrompt'
  | 'focusInput-submit'
  | 'focusInput-fill'
  | 'chat-open'
  | 'none';

/**
 * The shape returned by `kiroAgent.sessions.create`: an object carrying the new
 * session id. Modelled as an `interface` so the type guard narrows an `unknown`
 * result against a stable contract rather than a loose `any`.
 */
interface ISessionCreateResult {
  readonly sessionId: string;
}

/**
 * Type guard narrowing an unknown `sessions.create` result to a usable session.
 *
 * `sessions.sendPrompt` silently no-ops unless the session id is a non-empty
 * string, so the preferred path must verify the id before submitting and fall
 * through otherwise. This is the single place that contract is enforced (DRY).
 * @param value The unknown result returned by `kiroAgent.sessions.create`.
 * @returns `true` when `value` carries a non-empty string `sessionId`.
 */
function hasSessionId(value: unknown): value is ISessionCreateResult {
  if (null === value || 'object' !== typeof value) {
    return false;
  }
  const candidate = (value as { sessionId?: unknown }).sessionId;
  return 'string' === typeof candidate && 0 < candidate.length;
}

/**
 * Best-effort adapter driving the Kiro agent, confining ALL fragility (the
 * undocumented `kiroAgent.*` command ids and the generic chat-open fallback) to
 * this single class.
 *
 * It probes the command surface to report an honest {@link availability}, builds
 * every message from the fixed {@link SPEC_AGENT_MESSAGES} templates, then runs
 * a capability-probed, cascading try/catch dispatch chain ordered by robustness:
 * 1. `sessions.create` + `sessions.sendPrompt` — open a NEW session and truly
 *    submit the prompt (the preferred path; proceeds only when `create` returns
 *    a non-empty string session id, else it falls through);
 * 2. `focusChatInput({ submit: true, newSession: true })` — UI submit in a new
 *    session (best-effort, depends on the chat webview being rendered);
 * 3. `focusChatInput({ prompt })` — fill only; the user presses Enter;
 * 4. `workbench.action.chat.open` — the generic host fallback;
 * 5. none → the error reporter path.
 *
 * Each step is guarded by a `getCommands(true)` membership check AND wrapped so
 * any throw falls through to the next step. EVERY taken path produces honest,
 * path-specific feedback (a submitting path says "sent"; a fill-only path says
 * "press Enter"; the generic fallback says "you may need to send it"), and each
 * action writes one observability line (detected ids + path taken) to the
 * injected {@link IAgentDiagnosticSink}. A failure is surfaced through the error
 * reporter and NEVER thrown to the caller, so the UI never hard-fails.
 *
 * Context attach (`kiroAgent.selectFilesAsContext`) is intentionally NOT
 * implemented here: it is reserved for the v0.7.0 step-2 objective. See
 * `.kiro/steering/kiro-agent-commands.md` for the command reference.
 */
export class KiroChatAgentGateway implements ISpecAgentGateway {
  private readonly commands: ICommandGateway;

  private readonly reporter: IAgentErrorReporter;

  private readonly notifier: IAgentNotifier;

  private readonly diagnostics: IAgentDiagnosticSink;

  /**
   * Build the adapter over its command gateway, feedback channels and sink.
   * @param commands The thin command gateway.
   * @param reporter The channel surfacing a best-effort failure.
   * @param notifier The channel confirming an honest success/affordance.
   * @param diagnostics The observability sink for the detected ids and path.
   */
  public constructor(
    commands: ICommandGateway,
    reporter: IAgentErrorReporter,
    notifier: IAgentNotifier,
    diagnostics: IAgentDiagnosticSink,
  ) {
    this.commands = commands;
    this.reporter = reporter;
    this.notifier = notifier;
    this.diagnostics = diagnostics;
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
      const path = await this.dispatch(message, ids);
      this.logDiagnostic(ids, path);
      this.notify(message, path);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.reporter.showError(
        `Kiro Spec Tracker: the agent action could not be completed (${detail}).`,
      );
    }
  }

  /**
   * Run the cascading, capability-probed dispatch chain and report the path
   * actually taken. Each step is guarded by an id-membership check AND wrapped
   * in try/catch so any throw (or an unusable result) falls through to the next.
   * @param message The fixed-template message to send.
   * @param ids The registered command ids.
   * @returns The {@link DispatchPath} actually taken.
   */
  private async dispatch(message: string, ids: readonly string[]): Promise<DispatchPath> {
    if (await this.tryCreateAndSend(message, ids)) {
      return 'create+sendPrompt';
    }
    if (await this.tryFocusInput(message, ids, true)) {
      return 'focusInput-submit';
    }
    if (await this.tryFocusInput(message, ids, false)) {
      return 'focusInput-fill';
    }
    if (await this.tryChatOpen(message, ids)) {
      return 'chat-open';
    }
    return 'none';
  }

  /**
   * PREFERRED path: create a NEW session and truly submit the prompt. Proceeds
   * only when both ids are present AND `create` returns a non-empty string
   * session id (otherwise `sendPrompt` would silently no-op), falling through
   * on any missing id, bad result or throw.
   * @param message The prompt to submit.
   * @param ids The registered command ids.
   * @returns `true` when the prompt was submitted; `false` to fall through.
   */
  private async tryCreateAndSend(message: string, ids: readonly string[]): Promise<boolean> {
    if (!ids.includes(SESSIONS_CREATE) || !ids.includes(SESSIONS_SEND_PROMPT)) {
      return false;
    }
    try {
      const result = await this.commands.executeCommand<unknown>(SESSIONS_CREATE);
      if (!hasSessionId(result)) {
        return false;
      }
      // POSITIONAL (sessionId, prompt) — NOT an options object.
      await this.commands.executeCommand(SESSIONS_SEND_PROMPT, result.sessionId, message);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * UI path through `focusChatInput`: when `submit` is set, fill a NEW session
   * and submit; otherwise fill only. Guarded by the id check and wrapped so any
   * throw falls through.
   * @param message The prompt to fill into the chat input.
   * @param ids The registered command ids.
   * @param submit Whether to submit (new session) or only fill the input.
   * @returns `true` when the call ran; `false` to fall through.
   */
  private async tryFocusInput(
    message: string,
    ids: readonly string[],
    submit: boolean,
  ): Promise<boolean> {
    if (!ids.includes(FOCUS_CHAT_INPUT)) {
      return false;
    }
    try {
      const options = submit
        ? { prompt: message, submit: true, newSession: true }
        : { prompt: message };
      await this.commands.executeCommand(FOCUS_CHAT_INPUT, options);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generic last-resort path: open the host chat pre-filled with the message.
   * Guarded by the id check and wrapped so any throw falls through.
   * @param message The query to open the chat with.
   * @param ids The registered command ids.
   * @returns `true` when the chat was opened; `false` to fall through.
   */
  private async tryChatOpen(message: string, ids: readonly string[]): Promise<boolean> {
    if (!ids.includes(GENERIC_CHAT_OPEN)) {
      return false;
    }
    try {
      await this.commands.executeCommand(GENERIC_CHAT_OPEN, message);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Raise the honest, path-specific user feedback. Only the submitting paths
   * claim a real submission; the fill-only path says the user must press Enter,
   * the generic fallback says the chat was opened, and `none` surfaces the error
   * so the action is never silent.
   * @param message The message that was (attempted to be) sent.
   * @param path The path actually taken by {@link dispatch}.
   */
  private notify(message: string, path: DispatchPath): void {
    if ('create+sendPrompt' === path || 'focusInput-submit' === path) {
      this.notifier.notifyInfo(`Kiro Spec Tracker: sent to Kiro chat \u2014 "${message}".`);
      return;
    }
    if ('focusInput-fill' === path) {
      this.notifier.notifyInfo(
        `Kiro Spec Tracker: filled the chat with "${message}" \u2014 press Enter to run it.`,
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
   * @param path The path actually taken by {@link dispatch}.
   */
  private logDiagnostic(ids: readonly string[], path: DispatchPath): void {
    const kiroIds = ids.filter((id) => id.startsWith(KIRO_AGENT_PREFIX));
    const detected = 0 < kiroIds.length ? kiroIds.join(', ') : '(none)';
    const genericChat = ids.includes(GENERIC_CHAT_OPEN) ? 'yes' : 'no';
    this.diagnostics.append(
      `agent action: path=${path}; kiroAgent ids=[${detected}]; generic chat-open=${genericChat}`,
    );
  }
}
