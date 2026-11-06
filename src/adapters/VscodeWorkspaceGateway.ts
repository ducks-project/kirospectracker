import * as vscode from 'vscode';

import type { IWorkspaceGateway } from './ports/IWorkspaceGateway';

/**
 * Thin host wrapper implementing {@link IWorkspaceGateway} over the real
 * `vscode` window/workspace/clipboard API.
 *
 * It is the only command-side component importing `vscode`; it holds no logic
 * beyond the direct API calls, so the command classes stay unit-testable and
 * this wrapper is evidenced by the integration harness rather than the
 * in-process gate (its name matches the `Vscode*` coverage exclusion).
 */
export class VscodeWorkspaceGateway implements IWorkspaceGateway {
  /**
   * Open a document in the active editor group.
   * @param filePath Absolute path of the file to open.
   */
  // eslint-disable-next-line class-methods-use-this
  public async openDocument(filePath: string): Promise<void> {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
    await vscode.window.showTextDocument(document);
  }

  /**
   * Ask the user to confirm an action through a modal prompt.
   * @param message The question shown to the user.
   * @param confirmLabel The affirmative button label.
   * @returns `true` when the user confirmed, `false` otherwise.
   */
  // eslint-disable-next-line class-methods-use-this
  public async confirm(message: string, confirmLabel: string): Promise<boolean> {
    const choice = await vscode.window.showInformationMessage(
      message,
      { modal: true },
      confirmLabel,
    );
    return confirmLabel === choice;
  }

  /**
   * Copy text to the clipboard.
   * @param text The text to copy.
   */
  // eslint-disable-next-line class-methods-use-this
  public async copyToClipboard(text: string): Promise<void> {
    await vscode.env.clipboard.writeText(text);
  }

  /**
   * Surface an informational message.
   * @param message The message to show.
   */
  // eslint-disable-next-line class-methods-use-this
  public showInfo(message: string): void {
    vscode.window.showInformationMessage(message).then(undefined, undefined);
  }

  /**
   * Surface an error message.
   * @param message The message to show.
   */
  // eslint-disable-next-line class-methods-use-this
  public showError(message: string): void {
    vscode.window.showErrorMessage(message).then(undefined, undefined);
  }

  /**
   * Execute a registered VS Code command.
   * @param commandId The command identifier.
   */
  // eslint-disable-next-line class-methods-use-this
  public async executeCommand(commandId: string): Promise<void> {
    await vscode.commands.executeCommand(commandId);
  }
}
