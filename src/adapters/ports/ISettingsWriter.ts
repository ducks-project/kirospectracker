import type { ExcludeSettingKey } from '../../core/hiding/ExcludeSettingKey';
import type { ExcludeValue } from '../../core/hiding/ExcludeReconciler';

/** Outcome of a write: whether the settings of the folder were really updated. */
export type SettingsWriteResult = 'written' | 'folderNotFound';
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
   * @returns `written`, or `folderNotFound` when no open workspace folder matches the path.
   */
  writeExclude(
    workspacePath: string,
    setting: ExcludeSettingKey,
    value: ExcludeValue | undefined,
  ): Promise<SettingsWriteResult>;
}
