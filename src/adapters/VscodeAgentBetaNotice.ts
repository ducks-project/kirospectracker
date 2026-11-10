import * as vscode from 'vscode';

import type { AgentBetaNoticeChoice } from '../core/AgentBetaNoticeDecider';
import { AgentBetaNoticeDecider } from '../core/AgentBetaNoticeDecider';
import type { ITranslator } from '../core/ports/ITranslator';
import { IDENTITY_TRANSLATOR } from '../core/i18n/IdentityTranslator';
/** Configuration section owning the agent-integration settings. */
const CONFIG_SECTION = 'kirospectracker.agentIntegration';

/** Boolean setting key enabling the agent integration. */
const ENABLED_KEY = 'enabled';

/** Global-state key persisting the beta-notice acknowledgement. */
const ACKNOWLEDGED_KEY = 'kirospectracker.agentIntegration.betaNoticeAcknowledged';

/** Settings query focusing the extension's settings. */
const SETTINGS_QUERY = '@ext:ducks-project.kirospectracker';

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
  private readonly translator: ITranslator;
  /**
   * Build the notice over the extension context and the pure decider.
   * @param context The extension context owning the global state.
   * @param decider The pure decision helper.
   * @param translator The translator for the notice and its buttons (English by default).
   */
  public constructor(
    context: vscode.ExtensionContext,
    decider: AgentBetaNoticeDecider = new AgentBetaNoticeDecider(),
    translator: ITranslator = IDENTITY_TRANSLATOR,
  ) {
    this.context = context;
    this.decider = decider;
    this.translator = translator;
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
  private async promptChoice(): Promise<AgentBetaNoticeChoice> {
    // One translated constant per label, used both for display and comparison.
    const keepLabel = this.translator.t('Keep enabled');
    const disableLabel = this.translator.t('Disable');
    const settingsLabel = this.translator.t('Settings');
    const clicked = await vscode.window.showInformationMessage(
      this.translator.t(
        "Kiro Spec Tracker's Sync Files and Run tasks actions adapt on a best-effort basis to the editor and are in beta: they may change and can be disabled at any time.",
      ),
      keepLabel,
      disableLabel,
      settingsLabel,
    );
    if (keepLabel === clicked) {
      return 'keep';
    }
    if (disableLabel === clicked) {
      return 'disable';
    }
    if (settingsLabel === clicked) {
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
