import * as vscode from 'vscode';

import type { IAgentDiagnosticSink } from './ports/IAgentDiagnosticSink';

/** Human-readable name of the diagnostic output channel shown to the user. */
const CHANNEL_NAME = 'Kiro Spec Tracker';

/**
 * Thin host wrapper implementing {@link IAgentDiagnosticSink} over a `vscode`
 * {@link vscode.OutputChannel} named "Kiro Spec Tracker".
 *
 * It is the only diagnostic-side component importing `vscode`; it holds no
 * selection logic (that lives in {@link KiroChatAgentGateway}), so the fragile
 * detection stays unit-testable with a fake sink while this wrapper is evidenced
 * by the integration harness rather than the in-process gate (its name matches
 * the `Vscode*` coverage exclusion). Each line is timestamped so a tester can
 * correlate it with the moment they clicked an action, and the channel is a
 * disposable the composition root registers for host cleanup.
 */
export class VscodeOutputChannelDiagnosticSink implements IAgentDiagnosticSink, vscode.Disposable {
  private readonly channel: vscode.OutputChannel;

  /** Create the output channel backing the sink. */
  public constructor() {
    this.channel = vscode.window.createOutputChannel(CHANNEL_NAME);
  }

  /**
   * Append one timestamped diagnostic line to the output channel.
   * @param line The human-readable diagnostic line.
   */
  public append(line: string): void {
    this.channel.appendLine(`[${new Date().toISOString()}] ${line}`);
  }

  /** Release the underlying output channel. */
  public dispose(): void {
    this.channel.dispose();
  }
}
