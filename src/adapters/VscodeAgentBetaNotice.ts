import * as vscode from 'vscode';

import type { AgentBetaNoticeChoice } from '../core/AgentBetaNoticeDecider';
import { AgentBetaNoticeDecider } from '../core/AgentBetaNoticeDecider';

/** Configuration section owning the agent-integration settings. */
const CONFIG_SECTION = 'kirospectracker.agentIntegration';

/** Boolean setting key enabling the agent integration. */
const ENABLED_KEY = 'enabled';

/** Global-state key persisting the beta-notice acknowledgement. */
const ACKNOWLEDGED_KEY = 'kirospectracker.agentIntegration.betaNoticeAcknowledged';

/** Settings query focusing the extension's settings. */
const SETTINGS_QUERY = '@ext:ducks-project.kirospectracker';

/** Non-modal beta notice text (ROADMAP v0.7.0 suggested message). */
const NOTICE_MESSAGE =
  "Kiro Spec Tracker's Sync Files and Run tasks actions adapt on a best-effort basis to the " +
  'editor and are in beta: they may change and can be disabled at any time.';

/** "Keep enabled" button label. */
const KEEP_LABEL = 'Keep enabled';

/** "Disable" button label. */
const DISABLE_LABEL = 'Disable';

/** "Settings" button label. */
const SETTINGS_LABEL = 'Settings';

/**
 * Thin host wrapper surfacing the agent-integration beta notice through the
 * native, stable `window.showInformationMessage` API and persisting the outcome
 * in `globalState` / the setting.
 *
 * All branching lives in the pure {@link AgentBetaNoticeDecider}; this class only
 * reads the setting and the acknowledgement flag, shows the non-modal toast, and
 * applies the decided effect. Its name matches the `Vscode*` coverage exclusion,
 * so it is evidenced by the integration harness rather than the in-process gate.
 */
export class VscodeAgentBetaNotice {
  private readonly context: vscode.ExtensionContext;

  private readonly decider: AgentBetaNoticeDecider;

  /**
   * Build the notice over the extension context and the pure decider.
   * @param context The extension context owning the global state.
   * @param decider The pure decision helper.
   */
  public constructor(
    context: vscode.ExtensionContext,
    decider: AgentBetaNoticeDecider = new AgentBetaNoticeDecider(),
  ) {
    this.context = context;
    this.decider = decider;
  }

  /**
   * Read whether the agent integration is enabled (default `true`).
   * @returns `true` when the integration is enabled.
   */
  // eslint-disable-next-line class-methods-use-this
  public isEnabled(): boolean {
    return vscode.workspace.getConfiguration(CONFIG_SECTION).get<boolean>(ENABLED_KEY, true);
  }

  /**
   * Show the beta notice when the pure decider says it must, then apply the
   * effect of the user's choice. A no-op when the notice must not show.
   */
  public async maybeShow(): Promise<void> {
    const acknowledged = this.context.globalState.get<boolean>(ACKNOWLEDGED_KEY, false);
    if (!this.decider.shouldShow(this.isEnabled(), acknowledged)) {
      return;
    }
    const choice = await this.promptChoice();
    await this.applyEffect(choice);
  }

  /**
   * Show the non-modal toast and map the clicked button to a canonical choice.
   * @returns The user's choice, or `undefined` when dismissed.
   */
  // eslint-disable-next-line class-methods-use-this
  private async promptChoice(): Promise<AgentBetaNoticeChoice> {
    const clicked = await vscode.window.showInformationMessage(
      NOTICE_MESSAGE,
      KEEP_LABEL,
      DISABLE_LABEL,
      SETTINGS_LABEL,
    );
    if (KEEP_LABEL === clicked) {
      return 'keep';
    }
    if (DISABLE_LABEL === clicked) {
      return 'disable';
    }
    if (SETTINGS_LABEL === clicked) {
      return 'settings';
    }
    return undefined;
  }

  /**
   * Carry out the effect the pure decider maps the choice to.
   * @param choice The user's choice.
   */
  private async applyEffect(choice: AgentBetaNoticeChoice): Promise<void> {
    const effect = this.decider.effectFor(choice);
    if ('persist-acknowledgement' === effect) {
      await this.context.globalState.update(ACKNOWLEDGED_KEY, true);
      return;
    }
    if ('disable-integration' === effect) {
      await vscode.workspace
        .getConfiguration(CONFIG_SECTION)
        .update(ENABLED_KEY, false, vscode.ConfigurationTarget.Global);
      return;
    }
    if ('open-settings' === effect) {
      await vscode.commands.executeCommand('workbench.action.openSettings', SETTINGS_QUERY);
    }
    // 'none': dismissed with the close affordance; persist nothing so the notice
    // reappears next launch while the integration stays enabled.
  }
}
