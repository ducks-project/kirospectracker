/**
 * Port (Dependency Inversion) over the `vscode` window/workspace/clipboard
 * operations the command classes need.
 *
 * A thin `Vscode*` wrapper implements it against the real API; the commands
 * depend on this abstraction so they stay host-agnostic and unit-testable with
 * a fake, and the clipboard is never touched without the explicit consent this
 * contract models through {@link confirm}.
 */
export interface IWorkspaceGateway {
  /**
   * Open a document in the editor.
   * @param filePath Absolute path of the file to open.
   */
  openDocument(filePath: string): Promise<void>;

  /**
   * Ask the user to confirm an action through a modal prompt.
   * @param message The question shown to the user.
   * @param confirmLabel The affirmative button label.
   * @returns `true` when the user confirmed, `false` otherwise.
   */
  confirm(message: string, confirmLabel: string): Promise<boolean>;

  /**
   * Copy text to the clipboard.
   * @param text The text to copy.
   */
  copyToClipboard(text: string): Promise<void>;

  /**
   * Surface an informational message.
   * @param message The message to show.
   */
  showInfo(message: string): void;

  /**
   * Surface an error message.
   * @param message The message to show.
   */
  showError(message: string): void;

  /**
   * Execute a registered command (used to toggle the dashboard layout).
   * @param commandId The command identifier.
   */
  executeCommand(commandId: string): Promise<void>;
}
