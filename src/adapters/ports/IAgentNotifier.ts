/**
 * Port the agent adapters use to surface an honest, user-visible SUCCESS or
 * affordance notification once a send path has been taken.
 *
 * It is a sibling of {@link IAgentErrorReporter}: the error channel reports a
 * failure, this channel confirms what actually happened. They are kept separate
 * (Interface Segregation) because the two concerns differ — an error may be
 * shown by callers that never notify success (e.g. the folder-resolution guard
 * in {@link SpecAgentActions}), and a notifier should not be able to raise an
 * error through the same method. A real implementation is backed by
 * `vscode.window.showInformationMessage`; the agent adapter never imports
 * `vscode`, so this abstraction keeps its selection logic unit-testable.
 */
export interface IAgentNotifier {
  /**
   * Surface an informational message to the user.
   * @param message The human-readable message.
   */
  notifyInfo(message: string): void;
}
