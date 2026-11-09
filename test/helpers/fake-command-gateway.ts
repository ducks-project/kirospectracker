import type { ICommandGateway } from '../../src/adapters/ports/ICommandGateway';

/** One recorded command execution. */
export interface IExecutedCommand {
  readonly id: string;
  readonly args: readonly unknown[];
}

/**
 * Optional, deterministic per-command behaviours for the fire-and-forget send
 * path. All are off by default so existing tests are unaffected.
 */
export interface IFakeCommandOptions {
  /**
   * Command ids whose execution returns a promise that NEVER settles, so a test
   * can prove a toast fires without awaiting that command's resolution (the
   * fire-and-forget `sendPrompt` contract).
   */
  readonly pendingIds?: readonly string[];

  /**
   * Command ids whose execution returns a promise that REJECTS asynchronously
   * (rather than throwing synchronously), so a test can prove a fire-and-forget
   * rejection is swallowed and logged, never thrown to the UI.
   */
  readonly rejectingIds?: readonly string[];
}

/**
 * Fake {@link ICommandGateway} recording executions, with a configurable command
 * surface, per-command return values and an optional failing command.
 *
 * It lets the agent adapter and the factory be unit-tested without `vscode`,
 * conforming to the full port contract (no duck-typing). Return values seed the
 * generic `executeCommand<T>` so a test can drive the `sessions.create` result
 * the preferred dispatch path reads. The optional {@link IFakeCommandOptions}
 * drive the fire-and-forget assertions (a never-settling or async-rejecting
 * command) without real timers.
 */
export class FakeCommandGateway implements ICommandGateway {
  private readonly ids: readonly string[];

  private readonly failingId: string | undefined;

  private readonly results: ReadonlyMap<string, unknown>;

  private readonly pendingIds: ReadonlySet<string>;

  private readonly rejectingIds: ReadonlySet<string>;

  /** Commands executed, in order. */
  public readonly executed: IExecutedCommand[] = [];

  /**
   * Build the fake over a command surface, an optional failing command and
   * optional per-command return values.
   * @param ids The registered command ids.
   * @param failingId A command id that throws (synchronously) when executed.
   * @param results A map of command id to the value its execution resolves to.
   * @param options Optional per-command fire-and-forget behaviours.
   */
  public constructor(
    ids: readonly string[],
    failingId?: string,
    results: ReadonlyMap<string, unknown> = new Map(),
    options: IFakeCommandOptions = {},
  ) {
    this.ids = ids;
    this.failingId = failingId;
    this.results = results;
    this.pendingIds = new Set(options.pendingIds ?? []);
    this.rejectingIds = new Set(options.rejectingIds ?? []);
  }

  public async getCommands(): Promise<readonly string[]> {
    return this.ids;
  }

  public executeCommand<T = void>(id: string, ...args: readonly unknown[]): Promise<T> {
    this.executed.push({ id, args });
    if (id === this.failingId) {
      throw new Error(`command failed: ${id}`);
    }
    if (this.pendingIds.has(id)) {
      // Never settles: proves the caller did not await this command.
      return new Promise<T>(() => undefined);
    }
    if (this.rejectingIds.has(id)) {
      return Promise.reject(new Error(`command rejected: ${id}`));
    }
    return Promise.resolve(this.results.get(id) as T);
  }
}
