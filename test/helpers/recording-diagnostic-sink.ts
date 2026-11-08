import type { IAgentDiagnosticSink } from '../../src/adapters/ports/IAgentDiagnosticSink';

/**
 * Fake {@link IAgentDiagnosticSink} recording every appended diagnostic line, so
 * a test can assert the observability sink captured the detected ids and chosen
 * path without a `vscode` output channel.
 */
export class RecordingDiagnosticSink implements IAgentDiagnosticSink {
  /** The diagnostic lines appended, in order. */
  public readonly lines: string[] = [];

  public append(line: string): void {
    this.lines.push(line);
  }
}
