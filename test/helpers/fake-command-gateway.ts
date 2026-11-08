import type { ICommandGateway } from '../../src/adapters/ports/ICommandGateway';

/** One recorded command execution. */
export interface IExecutedCommand {
  readonly id: string;
  readonly args: readonly unknown[];
}

/**
 * Fake {@link ICommandGateway} recording executions and clipboard writes, with a
 * configurable command surface and an optional failing command.
 *
 * It lets the agent adapter and the factory be unit-tested without `vscode`,
 * conforming to the full port contract (no duck-typing).
 */
export class FakeCommandGateway implements ICommandGateway {
  private readonly ids: readonly string[];

  private clipboard: string;

  private readonly failingId: string | undefined;

  /** Commands executed, in order. */
  public readonly executed: IExecutedCommand[] = [];

  /** Texts written to the clipboard, in order. */
  public readonly clipboardWrites: string[] = [];

  /**
   * Build the fake over a command surface and initial clipboard content.
   * @param ids The registered command ids.
   * @param clipboard The initial clipboard content.
   * @param failingId A command id that throws when executed.
   */
  public constructor(ids: readonly string[], clipboard = 'original', failingId?: string) {
    this.ids = ids;
    this.clipboard = clipboard;
    this.failingId = failingId;
  }

  public async getCommands(): Promise<readonly string[]> {
    return this.ids;
  }

  public async executeCommand(id: string, ...args: readonly unknown[]): Promise<void> {
    this.executed.push({ id, args });
    if (id === this.failingId) {
      throw new Error(`command failed: ${id}`);
    }
  }

  public async readClipboard(): Promise<string> {
    return this.clipboard;
  }

  public async writeClipboard(text: string): Promise<void> {
    this.clipboard = text;
    this.clipboardWrites.push(text);
  }
}
