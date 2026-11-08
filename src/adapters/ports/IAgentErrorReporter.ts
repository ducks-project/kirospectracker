/**
 * Port the agent adapters use to surface a best-effort failure WITHOUT throwing
 * to the UI.
 *
 * The Kiro path is inherently fragile (undocumented ids, focus/timing, no
 * context-attach API); when a send cannot complete, the adapter reports an
 * honest message through this channel rather than hard-failing the caller.
 */
export interface IAgentErrorReporter {
  /**
   * Surface an error message to the user.
   * @param message The human-readable message.
   */
  showError(message: string): void;
}
