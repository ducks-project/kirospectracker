import type { ICommandGateway } from '../../src/adapters/ports/ICommandGateway';

/** One recorded command execution. */
export interface IExecutedCommand {
  readonly id: string;
  readonly args: readonly unknown[];
}

/**
 * Fake {@link ICommandGateway} recording executions, with a configurable command
 * surface, per-command return values and an optional failing command.
 *
 * It lets the agent adapter and the factory be unit-tested without `vscode`,
 * conforming to the full port contract (no duck-typing). Return values seed the
 * generic `executeCommand<T>` so a test can drive the `sessions.create` result
 * the preferred dispatch path reads.
 */
export class FakeCommandGateway implements ICommandGateway {
  private readonly ids: readonly string[];

  private readonly failingId: string | undefined;

  private readonly results: ReadonlyMap<string, unknown>;

  /** Commands executed, in order. */
  public readonly executed: IExecutedCommand[] = [];

  /**
   * Build the fake over a command surface, an optional failing command and
   * optional per-command return values.
   * @param ids The registered command ids.
   * @param failingId A command id that throws when executed.
   * @param results A map of command id to the value its execution resolves to.
   */
  public constructor(
    ids: readonly string[],
    failingId?: string,
    results: ReadonlyMap<string, unknown> = new Map(),
  ) {
    this.ids = ids;
    this.failingId = failingId;
    this.results = results;
  }

  public async getCommands(): Promise<readonly string[]> {
    return this.ids;
  }

  public async executeCommand<T = void>(id: string, ...args: readonly unknown[]): Promise<T> {
    this.executed.push({ id, args });
    if (id === this.failingId) {
      throw new Error(`command failed: ${id}`);
    }
    return this.results.get(id) as T;
  }
}
