import type { ExcludeSettingKey } from '../../core/hiding/HideSpecsMode';
import type { ExcludeValue } from '../../core/hiding/ExcludeReconciler';

/**
 * Port reading and writing an exclusion setting in the settings of one
 * workspace folder (never the merged value).
 *
 * A `Vscode*` adapter implements it over `workspace.getConfiguration` and
 * `ConfigurationTarget.WorkspaceFolder`; tests inject a fake.
 */
export interface ISettingsWriter {
  /**
   * Read the value stored in the folder's own settings.
   * @param workspacePath Absolute path of the workspace folder.
   * @param setting The exclusion setting.
   * @returns The folder-level value, or `undefined` when the folder does not set it.
   */
  readExclude(workspacePath: string, setting: ExcludeSettingKey): ExcludeValue | undefined;
  /**
   * Replace the value stored in the folder's own settings.
   * @param workspacePath Absolute path of the workspace folder.
   * @param setting The exclusion setting.
   * @param value The whole new value; `undefined` removes the setting.
   */
  writeExclude(
    workspacePath: string,
    setting: ExcludeSettingKey,
    value: ExcludeValue | undefined,
  ): Promise<void>;
}
