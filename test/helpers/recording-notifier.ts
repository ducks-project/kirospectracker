import type { IAgentNotifier } from '../../src/adapters/ports/IAgentNotifier';

/**
 * Fake {@link IAgentNotifier} recording every surfaced info message, so a test
 * can assert the success/affordance channel fired with the expected text
 * without `vscode`.
 */
export class RecordingNotifier implements IAgentNotifier {
  /** The info messages surfaced, in order. */
  public readonly infos: string[] = [];

  public notifyInfo(message: string): void {
    this.infos.push(message);
  }
}
