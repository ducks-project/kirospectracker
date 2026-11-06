import type { IWorkspaceGateway } from '../../src/adapters/ports/IWorkspaceGateway';

/**
 * Recording fake implementing {@link IWorkspaceGateway} for command unit tests.
 *
 * It records every interaction and lets a test script the confirmation outcome,
 * so the consent-gated clipboard behaviour can be asserted without `vscode`.
 */
export class FakeWorkspaceGateway implements IWorkspaceGateway {
  /** Absolute paths opened through {@link openDocument}. */
  public readonly opened: string[] = [];

  /** Texts written through {@link copyToClipboard}. */
  public readonly copied: string[] = [];

  /** Informational messages shown through {@link showInfo}. */
  public readonly infos: string[] = [];

  /** Error messages shown through {@link showError}. */
  public readonly errors: string[] = [];

  /** Command ids executed through {@link executeCommand}. */
  public readonly executed: string[] = [];

  private readonly confirmResult: boolean;

  /**
   * Build the fake with a scripted confirmation outcome.
   * @param confirmResult Value returned by {@link confirm} (defaults to false).
   */
  public constructor(confirmResult: boolean = false) {
    this.confirmResult = confirmResult;
  }

  public async openDocument(filePath: string): Promise<void> {
    this.opened.push(filePath);
  }

  public async confirm(): Promise<boolean> {
    return this.confirmResult;
  }

  public async copyToClipboard(text: string): Promise<void> {
    this.copied.push(text);
  }

  public showInfo(message: string): void {
    this.infos.push(message);
  }

  public showError(message: string): void {
    this.errors.push(message);
  }

  public async executeCommand(commandId: string): Promise<void> {
    this.executed.push(commandId);
  }
}
