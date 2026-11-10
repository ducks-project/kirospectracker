import * as vscode from 'vscode';
import type { ITranslator } from '../core/ports/ITranslator';
import { IDENTITY_TRANSLATOR } from '../core/i18n/IdentityTranslator';
import { hiddenSpecsNoticeKey } from './HiddenSpecsNoticeText';
import type { IFirstWriteNotice, IHiddenSpecsNotifier } from './ports/IHiddenSpecsNotifier';
import type { IWorkspaceGateway } from './ports/IWorkspaceGateway';

/** Settings file of a workspace folder, relative to its root. */
const FOLDER_SETTINGS_PATH = ['.vscode', 'settings.json'];

/**
 * Thin host wrapper implementing {@link IHiddenSpecsNotifier} with non-modal
 * `window.showInformationMessage` toasts. Evidenced by the integration harness.
 */
export class VscodeHiddenSpecsNotifier implements IHiddenSpecsNotifier {
  private readonly gateway: IWorkspaceGateway;
  private readonly translator: ITranslator;
  /**
   * Build the notifier.
   * @param gateway The gateway used to open the settings file.
   * @param translator The translator for the notices (English by default).
   */
  public constructor(gateway: IWorkspaceGateway, translator: ITranslator = IDENTITY_TRANSLATOR) {
    this.gateway = gateway;
    this.translator = translator;
  }

  public notifyFirstWrite(notice: IFirstWriteNotice): void {
    const openLabel = this.translator.t('Open settings file');
    const message = this.translator.t(
      hiddenSpecsNoticeKey(notice.count, notice.setting),
      notice.count,
      notice.setting,
    );
    vscode.window.showInformationMessage(message, openLabel).then(
      (choice) => {
        if (openLabel === choice) {
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
      this.translator.t(
        'Kiro Spec Tracker: {0} hidden spec entries removed. Set "kirospectracker.hideSpecs.mode" to "off" to stop hiding specs.',
        removed,
      ),
    );
  }
}
