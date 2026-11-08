/**
 * The choice the user made on the beta notice, or `undefined` when the notice
 * was dismissed with the close affordance (the host API returns `undefined`).
 */
export type AgentBetaNoticeChoice = 'keep' | 'disable' | 'settings' | undefined;

/**
 * The effect to apply after the user interacts with the beta notice.
 *
 * - `persist-acknowledgement`: remember the acknowledgement so the notice never
 *   shows again; the integration stays enabled.
 * - `disable-integration`: turn the disable setting on; the Null-Object takes over.
 * - `open-settings`: open the extension settings (nothing persisted).
 * - `none`: dismissed with the close affordance; persist nothing, so the notice
 *   reappears next launch while the integration stays enabled.
 */
export type AgentBetaNoticeEffect =
  | 'persist-acknowledgement'
  | 'disable-integration'
  | 'open-settings'
  | 'none';

/**
 * Pure decision logic for the agent integration beta notice.
 *
 * It holds no `vscode` reference: a thin adapter reads the `enabled` setting and
 * the `acknowledged` global-state flag, asks this class whether to show the
 * notice, then (after the host returns the user's choice) asks this class which
 * effect to apply. Keeping the branching here makes it unit-testable without a
 * host.
 */
export class AgentBetaNoticeDecider {
  /**
   * Decide whether the beta notice must be shown on activation.
   *
   * It shows only when the integration is enabled AND not yet acknowledged: a
   * disabled integration has nothing to announce, and an acknowledged one must
   * never nag again.
   * @param enabled Whether the agent integration is enabled (the setting).
   * @param acknowledged Whether the notice was already acknowledged (global state).
   * @returns `true` when the notice must be shown.
   */
  // eslint-disable-next-line class-methods-use-this
  public shouldShow(enabled: boolean, acknowledged: boolean): boolean {
    if (!enabled) {
      return false;
    }
    return !acknowledged;
  }

  /**
   * Map the user's choice on the beta notice to the effect to apply.
   * @param choice The user's choice, or `undefined` when dismissed.
   * @returns The effect the adapter must carry out.
   */
  // eslint-disable-next-line class-methods-use-this
  public effectFor(choice: AgentBetaNoticeChoice): AgentBetaNoticeEffect {
    if ('keep' === choice) {
      return 'persist-acknowledgement';
    }
    if ('disable' === choice) {
      return 'disable-integration';
    }
    if ('settings' === choice) {
      return 'open-settings';
    }
    return 'none';
  }
}
