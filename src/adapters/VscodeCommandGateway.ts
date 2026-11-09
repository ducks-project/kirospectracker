import * as vscode from 'vscode';

import type { ICommandGateway } from './ports/ICommandGateway';

/**
 * Thin host wrapper implementing {@link ICommandGateway} over the real `vscode`
 * commands API.
 *
 * It is the only new `vscode`-touching surface for the agent integration; it
 * holds NO selection or sequencing logic (that lives in
 * {@link KiroChatAgentGateway}), so the fragile orchestration stays
 * unit-testable with a fake. Its name matches the `Vscode*` coverage exclusion,
 * so it is evidenced by the integration harness rather than the in-process gate.
 */
export class VscodeCommandGateway implements ICommandGateway {
  /**
   * Enumerate every registered command identifier (internal ones included).
   * @returns All registered command ids.
   */
  // eslint-disable-next-line class-methods-use-this
  public async getCommands(): Promise<readonly string[]> {
    return vscode.commands.getCommands(true);
  }

  /**
   * Execute a registered command with optional arguments, returning its result.
   * @typeParam T The expected result type (defaults to `void`).
   * @param id The command identifier.
   * @param args The command arguments.
   * @returns The command's result, typed as `T`.
   */
  // eslint-disable-next-line class-methods-use-this
  public async executeCommand<T = void>(id: string, ...args: readonly unknown[]): Promise<T> {
    return vscode.commands.executeCommand<T>(id, ...args);
  }
}
