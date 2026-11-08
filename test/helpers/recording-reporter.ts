import type { IAgentErrorReporter } from '../../src/adapters/ports/IAgentErrorReporter';

/**
 * Fake {@link IAgentErrorReporter} recording every surfaced error message, so a
 * test can assert the error channel fired (or did not) without `vscode`.
 */
export class RecordingReporter implements IAgentErrorReporter {
  /** The error messages surfaced, in order. */
  public readonly errors: string[] = [];

  public showError(message: string): void {
    this.errors.push(message);
  }
}
