import * as vscode from 'vscode';
import type { ExcludeSettingKey } from '../core/hiding/HideSpecsMode';
import type { IFirstWriteNotice, IHiddenSpecsNotifier } from './ports/IHiddenSpecsNotifier';
import type { IWorkspaceGateway } from './ports/IWorkspaceGateway';

/** Label of the button opening the settings file. */
const OPEN_SETTINGS_LABEL = 'Open settings file';

/** Settings file of a workspace folder, relative to its root. */
const FOLDER_SETTINGS_PATH = ['.vscode', 'settings.json'];

/** Surfaces each exclusion setting hides specs from, for the notice text. */
const SURFACES: Readonly<Record<ExcludeSettingKey, string>> = {
  'files.exclude': 'the Explorer, Search and Quick Open',
  'search.exclude': 'Search and Quick Open',
};

/**
 * Thin host wrapper implementing {@link IHiddenSpecsNotifier} with non-modal
 * `window.showInformationMessage` toasts. Evidenced by the integration harness.
 */
export class VscodeHiddenSpecsNotifier implements IHiddenSpecsNotifier {
  private readonly gateway: IWorkspaceGateway;

  /**
   * Build the notifier.
   * @param gateway The gateway used to open the settings file.
   */
  public constructor(gateway: IWorkspaceGateway) {
    this.gateway = gateway;
  }

  public notifyFirstWrite(notice: IFirstWriteNotice): void {
    const noun = 1 === notice.count ? 'spec' : 'specs';
    const message =
      `Kiro Spec Tracker: ${notice.count} ${noun} hidden from ${SURFACES[notice.setting]} ` +
      `(entries added to ${notice.setting} in the folder settings).`;
    vscode.window.showInformationMessage(message, OPEN_SETTINGS_LABEL).then(
      (choice) => {
        if (OPEN_SETTINGS_LABEL === choice) {
          const file = vscode.Uri.joinPath(
            vscode.Uri.file(notice.workspacePath),
            ...FOLDER_SETTINGS_PATH,
          );
          return this.gateway.openDocument(file.fsPath);
        }
        return undefined;
      },
      () => undefined,
    );
  }

  public notifyReset(removed: number): void {
    vscode.window.showInformationMessage(
      `Kiro Spec Tracker: ${removed} hidden spec entries removed. ` +
        'Set "kirospectracker.hideSpecs.mode" to "off" to stop hiding specs.',
    );
  }
}
