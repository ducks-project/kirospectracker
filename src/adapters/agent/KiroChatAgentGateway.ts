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
import type { ITranslator } from '../../core/ports/ITranslator';
import { IDENTITY_TRANSLATOR } from '../../core/i18n/IdentityTranslator';
import { runMessageForScope, SPEC_AGENT_MESSAGES } from '../../core/SpecAgentMessages';
import { composeMessageWithFolderContext } from '../../core/SpecAgentContext';

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
 * Undocumented Kiro command activating a created session by id and reporting
 * whether activation succeeded.
 *
 * Reverse-engineered, non-documented and subject to change across Kiro builds.
 * Signature: `(sessionId: string, ownerWindowId?: number, source?: object):
 * Promise<{ accepted: boolean, sessionId?: string, reason?: string }>`. It
 * routes through the sidebar reveal primitive (`switchToSidebarSession`) and is
 * preferred over {@link VIEW_SESSION} because it returns a verifiable
 * `accepted` flag.
 */
const SESSIONS_SWITCH = 'kiroAgent.sessions.switch';

/**
 * Undocumented Kiro command activating a created session by id (simple reveal).
 *
 * Reverse-engineered, non-documented and subject to change across Kiro builds.
 * Signature: `(sessionId: string, title?: string): void`. It makes the given
 * session the active chat in the sidebar but returns nothing, so it is the
 * best-effort fallback when {@link SESSIONS_SWITCH} is absent.
 */
const VIEW_SESSION = 'kiroAgent.viewSession';

/**
 * Framework-generated Kiro command bringing the chat view container to the
 * foreground.
 *
 * Reverse-engineered, non-documented and subject to change across Kiro builds.
 * Signature: `(): void` (no args). VS Code auto-provides a `<viewId>.focus`
 * command for the registered `kiroAgent.chatView` webview view; Kiro's own
 * spec-review flow calls it immediately before `focusChatInput`.
 */
const CHAT_VIEW_FOCUS = 'kiroAgent.chatView.focus';

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
 * How the created session was activated (brought to the foreground), recorded in
 * the diagnostic line and driving honest toast wording:
 * - `switch`: `sessions.switch` returned `{ accepted: true }` (verified);
 * - `viewSession`: the best-effort `viewSession` reveal was invoked;
 * - `none`: no activation command was available, so the session may stay in
 *   Session History and the toast must say so.
 */
export type ActivationKind = 'switch' | 'viewSession' | 'none';

/**
 * The shape returned by `kiroAgent.sessions.create`: an object carrying the new
 * session id. Modelled as an `interface` so the type guard narrows an `unknown`
 * result against a stable contract rather than a loose `any`.
 */
interface ISessionCreateResult {
  readonly sessionId: string;
}

/**
 * The shape returned by `kiroAgent.sessions.switch`: a structured activation
 * result whose `accepted` flag reports whether the session was revealed.
 * Modelled as an `interface` so the type guard narrows an `unknown` result
 * against a stable contract rather than a loose `any`.
 */
interface ISessionSwitchResult {
  readonly accepted: boolean;
  readonly sessionId?: string;
  readonly reason?: string;
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
 * Type guard narrowing an unknown `sessions.switch` result that reports a
 * verified activation.
 *
 * `sessions.switch` can legitimately resolve with `{ accepted: false, reason }`
 * (e.g. `activationFailed`, `noSurface`, `invalidArgs`), so a resolved promise
 * does NOT imply success; the activation is only confirmed when `accepted` is
 * strictly `true`.
 * @param value The unknown result returned by `kiroAgent.sessions.switch`.
 * @returns `true` when `value` carries `accepted === true`.
 */
function isAccepted(value: unknown): value is ISessionSwitchResult {
  if (null === value || 'object' !== typeof value) {
    return false;
  }
  return true === (value as { accepted?: unknown }).accepted;
}

/**
 * Best-effort adapter driving the Kiro agent, confining ALL fragility (the
 * undocumented `kiroAgent.*` command ids and the generic chat-open fallback) to
 * this single class.
 *
 * It probes the command surface to report an honest {@link availability}, builds
 * every message from the fixed {@link SPEC_AGENT_MESSAGES} templates, then runs
 * a capability-probed, cascading try/catch dispatch chain ordered by robustness:
 * 1. `sessions.create` + activate + foreground + `sessions.sendPrompt` — open a
 *    NEW session, ACTIVATE it (`sessions.switch` when it returns
 *    `{ accepted: true }`, else the best-effort `viewSession`), bring the chat
 *    view to the FOREGROUND (`chatView.focus`), then FIRE-AND-FORGET
 *    `sessions.sendPrompt` so the "sent" toast is immediate rather than delayed
 *    to end-of-turn. It proceeds only when `create` returns a non-empty string
 *    session id, else it falls through. Activation and focus are best-effort: a
 *    throw or `accepted: false` never aborts the send, and when no activation
 *    command exists the toast says the session may be in Session History;
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
 * action writes one concise observability line (path, activation, send mode,
 * whether context was attached, a COUNT of detected kiroAgent.* ids and whether
 * the generic chat-open exists) to the injected {@link IAgentDiagnosticSink}. A failure is surfaced through the error
 * reporter and NEVER thrown to the caller, so the UI never hard-fails.
 *
 * Context attach rides the SAME dispatch chain: the spec folder is carried as an
 * in-prompt `#[[folder:<fsPath>]]` token composed by the pure
 * {@link composeMessageWithFolderContext} and submitted as the prompt text, so
 * no new command is called. `kiroAgent.selectFilesAsContext` is NOT used: it only
 * seeds the chat input box, which the programmatic `sendPrompt` ignores (the
 * token-in-text approach supersedes it). When no spec folder path is available
 * the plain template is sent WITHOUT any token, preserving the no-context send.
 * See `.kiro/steering/kiro-agent-commands.md` for the command reference.
 */
export class KiroChatAgentGateway implements ISpecAgentGateway {
  private readonly commands: ICommandGateway;

  private readonly reporter: IAgentErrorReporter;

  private readonly notifier: IAgentNotifier;

  private readonly diagnostics: IAgentDiagnosticSink;
  private readonly translator: ITranslator;
  /**
   * How the created session was activated on the current `send`. Set by the
   * preferred create path and consumed by {@link logDiagnostic} and
   * {@link notify}; reset at the start of every {@link send} so it never leaks
   * across actions. Only meaningful for the `create+sendPrompt` path.
   */
  private activation: ActivationKind = 'none';

  /**
   * Whether the current `send` attached the spec folder as an in-prompt context
   * token. Set at the start of every {@link send} from the composed message and
   * consumed by {@link logDiagnostic}; it is `true` only when a non-empty spec
   * folder path produced a `#[[folder:...]]` token.
   */
  private contextAttached = false;

  /**
   * Build the adapter over its command gateway, feedback channels and sink.
   * @param commands The thin command gateway.
   * @param reporter The channel surfacing a best-effort failure.
   * @param notifier The channel confirming an honest success/affordance.
   * @param diagnostics The observability sink for the concise diagnostic line.
   * @param translator The translator for the user-facing toasts (English by default).
   */
  public constructor(
    commands: ICommandGateway,
    reporter: IAgentErrorReporter,
    notifier: IAgentNotifier,
    diagnostics: IAgentDiagnosticSink,
    translator: ITranslator = IDENTITY_TRANSLATOR,
  ) {
    this.commands = commands;
    this.reporter = reporter;
    this.notifier = notifier;
    this.diagnostics = diagnostics;
    this.translator = translator;
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
    await this.send(SPEC_AGENT_MESSAGES.syncTasks(spec.name), spec.folderPath);
  }

  /**
   * Ask the agent to run the spec's tasks for the given scope.
   * @param spec The spec snapshot (its name disambiguates the target).
   * @param scope The run scope.
   */
  public async runTasks(spec: ISpecSnapshot, scope: RunScope): Promise<void> {
    await this.send(runMessageForScope(scope), spec.folderPath);
  }

  /**
   * Send a message through the most robust available path, never throwing and
   * always giving the user honest, visible feedback. The spec folder is attached
   * as an in-prompt context token when its path is non-empty (degrading to the
   * plain template otherwise), so the agent acts on the right spec.
   * @param message The fixed-template message to send (and to toast).
   * @param folderFsPath The spec folder absolute path, empty when unavailable.
   */
  private async send(message: string, folderFsPath: string): Promise<void> {
    this.activation = 'none';
    // Compose the context-carrying prompt once (token + template). When no spec
    // folder path is available the plain template is returned WITHOUT a token,
    // so the no-context send is preserved and the send can never be blocked.
    const composed = composeMessageWithFolderContext(message, folderFsPath);
    this.contextAttached = composed !== message;
    try {
      const ids = await this.commands.getCommands();
      // The dispatch chain submits the composed (context-carrying) prompt; the
      // toast uses the plain, human-readable template.
      const path = await this.dispatch(composed, ids);
      this.logDiagnostic(ids, path);
      this.notify(message, path);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.reporter.showError(
        this.translator.t(
          'Kiro Spec Tracker: the agent action could not be completed ({0}).',
          detail,
        ),
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
   * PREFERRED path: create a NEW session, ACTIVATE it, bring the chat view to
   * the FOREGROUND, then FIRE-AND-FORGET the prompt submission so the toast is
   * immediate. Proceeds only when both create/send ids are present AND `create`
   * returns a non-empty string session id (otherwise `sendPrompt` would silently
   * no-op), falling through on any missing id, bad result or throw BEFORE the
   * send is dispatched.
   *
   * Activation ({@link activateSession}) and view focus ({@link focusChatView})
   * are best-effort: they run BEFORE the send so the user sees the session when
   * the run starts, but a throw or `accepted: false` never aborts it. The send
   * is dispatched with {@link ICommandGateway.executeCommand} and NOT awaited; a
   * mandatory `.catch` routes any rejection to the diagnostic sink only so it
   * never surfaces to the UI. The chosen activation kind is recorded in
   * {@link activation} for honest diagnostics and toast wording.
   * @param message The prompt to submit.
   * @param ids The registered command ids.
   * @returns `true` when the prompt was dispatched; `false` to fall through.
   */
  private async tryCreateAndSend(message: string, ids: readonly string[]): Promise<boolean> {
    if (!ids.includes(SESSIONS_CREATE) || !ids.includes(SESSIONS_SEND_PROMPT)) {
      return false;
    }
    let sessionId: string;
    try {
      const result = await this.commands.executeCommand<unknown>(SESSIONS_CREATE);
      if (!hasSessionId(result)) {
        return false;
      }
      sessionId = result.sessionId;
    } catch {
      return false;
    }
    // Best-effort activation + foreground BEFORE sending: never abort the send.
    this.activation = await this.activateSession(sessionId, ids);
    await this.focusChatView(ids);
    this.dispatchSend(sessionId, message);
    return true;
  }

  /**
   * FIRE-AND-FORGET the prompt submission so the "sent" toast is immediate.
   *
   * `sessions.sendPrompt` resolves only at end-of-turn (its ACP `session/prompt`
   * response carries a `stopReason`), so awaiting it before the toast is exactly
   * what made the notification feel slow. This dispatches it and attaches a
   * mandatory `.catch` that routes any rejection to the diagnostic sink only; it
   * is wrapped in `try/catch` as well so even a synchronous throw from the host
   * command surface is swallowed and can never reach the UI.
   * @param sessionId The activated session id.
   * @param message The prompt to submit (positional with `sessionId`).
   */
  private dispatchSend(sessionId: string, message: string): void {
    try {
      // POSITIONAL (sessionId, prompt) — NOT an options object.
      void this.commands
        .executeCommand(SESSIONS_SEND_PROMPT, sessionId, message)
        .catch((error: unknown) => this.logSendFailure(error));
    } catch (error) {
      this.logSendFailure(error);
    }
  }

  /**
   * ACTIVATE a created session so it becomes the visible chat. Prefers
   * `sessions.switch` because it returns a verifiable `{ accepted }` result; on
   * `accepted: false` or a throw it falls back to the best-effort `viewSession`
   * reveal. Returns `none` when neither command is available (the send still
   * works; the session may stay in Session History). Never throws.
   * @param sessionId The non-empty session id to activate.
   * @param ids The registered command ids.
   * @returns The {@link ActivationKind} actually achieved.
   */
  private async activateSession(
    sessionId: string,
    ids: readonly string[],
  ): Promise<ActivationKind> {
    if (ids.includes(SESSIONS_SWITCH)) {
      try {
        const result = await this.commands.executeCommand<unknown>(SESSIONS_SWITCH, sessionId);
        if (isAccepted(result)) {
          return 'switch';
        }
      } catch {
        // Fall through to the viewSession reveal below.
      }
    }
    if (ids.includes(VIEW_SESSION)) {
      try {
        // Returns nothing — best-effort reveal.
        await this.commands.executeCommand(VIEW_SESSION, sessionId);
        return 'viewSession';
      } catch {
        return 'none';
      }
    }
    return 'none';
  }

  /**
   * Bring the chat view container to the foreground, mirroring Kiro's own
   * `chatView.focus` → `focusChatInput` ordering. Guarded by the id check and
   * wrapped so any throw is ignored (best-effort; never aborts the send).
   * @param ids The registered command ids.
   */
  private async focusChatView(ids: readonly string[]): Promise<void> {
    if (!ids.includes(CHAT_VIEW_FOCUS)) {
      return;
    }
    try {
      // No args — framework-generated view focus command.
      await this.commands.executeCommand(CHAT_VIEW_FOCUS);
    } catch {
      // Best-effort: a failed foreground must not abort the send.
    }
  }

  /**
   * Record a fire-and-forget `sendPrompt` rejection in the diagnostic sink only,
   * so it is observable without ever surfacing to the UI.
   * @param error The rejection reason from the dispatched `sendPrompt`.
   */
  private logSendFailure(error: unknown): void {
    const detail = error instanceof Error ? error.message : String(error);
    this.diagnostics.append(`agent action: sendPrompt (fire-and-forget) failed: ${detail}`);
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
    if ('create+sendPrompt' === path) {
      this.notifier.notifyInfo(this.createPathToast(message));
      return;
    }
    if ('focusInput-submit' === path) {
      this.notifier.notifyInfo(
        this.translator.t('Kiro Spec Tracker: sent to Kiro chat \u2014 "{0}".', message),
      );
      return;
    }
    if ('focusInput-fill' === path) {
      this.notifier.notifyInfo(
        this.translator.t(
          'Kiro Spec Tracker: filled the chat with "{0}" \u2014 press Enter to run it.',
          message,
        ),
      );
      return;
    }
    if ('chat-open' === path) {
      this.notifier.notifyInfo(
        this.translator.t(
          'Kiro Spec Tracker: opened the chat with "{0}" \u2014 you may need to send it.',
          message,
        ),
      );
      return;
    }
    this.reporter.showError(
      this.translator.t('Kiro Spec Tracker: no Kiro chat command is available to run this action.'),
    );
  }

  /**
   * Build the create-path toast. When the session was activated it confirms the
   * submission plainly; when no activation command was available it words the
   * success honestly so the user knows the session may be in Session History.
   * @param message The message that was submitted.
   * @returns The honest, activation-aware toast text.
   */
  private createPathToast(message: string): string {
    if ('none' === this.activation) {
      return this.translator.t(
        'Kiro Spec Tracker: sent to Kiro chat \u2014 if it did not come to the front, open it from Session History.',
      );
    }
    return this.translator.t('Kiro Spec Tracker: sent to Kiro chat \u2014 "{0}".', message);
  }

  /**
   * Write one concise observability line: the dispatch path, the activation kind,
   * the fire-and-forget send mode, whether the spec folder was attached as
   * context, a COUNT of detected kiroAgent.* ids (not the full list, to stay
   * concise) and whether the generic chat-open exists, so a tester can still
   * diagnose a future build.
   * @param ids The registered command ids.
   * @param path The path actually taken by {@link dispatch}.
   */
  private logDiagnostic(ids: readonly string[], path: DispatchPath): void {
    const kiroAgentCommandCount = ids.filter((id) => id.startsWith(KIRO_AGENT_PREFIX)).length;
    const genericChat = ids.includes(GENERIC_CHAT_OPEN) ? 'yes' : 'no';
    const context = this.contextAttached ? 'yes' : 'no';
    // The preferred path records how the session was activated; every path
    // records that the submission was fire-and-forget (so the toast is
    // immediate). A COUNT of detected kiroAgent.* ids replaces the full id list
    // to keep the line concise while still diagnosing a future build.
    const activation = 'create+sendPrompt' === path ? this.activation : 'none';
    this.diagnostics.append(
      `agent action: path=${path}; activation=${activation}; send=fire-and-forget; ` +
        `context=${context}; kiroAgentCommandCount=${kiroAgentCommandCount}; ` +
        `generic chat-open=${genericChat}`,
    );
  }
}
