/**
 * Port (Dependency Inversion) over the minimal, raw `vscode` command surface the
 * {@link KiroChatAgentGateway} needs.
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
   *
   * It is generic so a caller can read a command's result (e.g. the
   * `{ sessionId }` returned by `kiroAgent.sessions.create`); the result type
   * `T` defaults to `void` for the common fire-and-forget case. Callers that
   * read a result MUST narrow it with a type guard, as these undocumented
   * commands carry no stable return contract.
   * @typeParam T The expected result type (defaults to `void`).
   * @param id The command identifier.
   * @param args The command arguments.
   * @returns The command's result, typed as `T`.
   */
  executeCommand<T = void>(id: string, ...args: readonly unknown[]): Promise<T>;
}
