/**
 * Port (Dependency Inversion) over the minimal, raw `vscode` command and
 * clipboard surface the {@link KiroChatAgentGateway} needs.
 *
 * A thin `Vscode*` wrapper implements it against the real API; the agent adapter
 * depends on this abstraction so its fragile selection/sequencing logic stays
 * unit-testable with a fake command gateway, while the raw `vscode` calls remain
 * isolated in the excluded wrapper.
 */
export interface ICommandGateway {
  /**
   * Enumerate the registered command identifiers.
   * @returns All registered command ids, including internal ones.
   */
  getCommands(): Promise<readonly string[]>;

  /**
   * Execute a registered command with optional arguments.
   * @param id The command identifier.
   * @param args The command arguments.
   */
  executeCommand(id: string, ...args: readonly unknown[]): Promise<void>;

  /**
   * Read the current clipboard text (to save and restore it around a paste).
   * @returns The current clipboard text.
   */
  readClipboard(): Promise<string>;

  /**
   * Write text to the clipboard.
   * @param text The text to write.
   */
  writeClipboard(text: string): Promise<void>;
}
