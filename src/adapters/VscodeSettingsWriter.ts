import * as vscode from 'vscode';
import type { ExcludeValue } from '../core/hiding/ExcludeReconciler';
import type { ExcludeSettingKey } from '../core/hiding/ExcludeSettingKey';
import type { ISettingsWriter, SettingsWriteResult } from './ports/ISettingsWriter';

/**
 * Thin host wrapper implementing {@link ISettingsWriter} over the workspace
 * configuration, targeting `ConfigurationTarget.WorkspaceFolder`.
 *
 * It reads the folder's OWN value through `inspect()` (never the merged `get()`,
 * which would copy defaults and user settings into the project file), and
 * replaces the whole object in one `update`. Its name matches the `Vscode*`
 * coverage exclusion: it is evidenced by the integration harness.
 */
export class VscodeSettingsWriter implements ISettingsWriter {
  public readExclude(workspacePath: string, setting: ExcludeSettingKey): ExcludeValue | undefined {
    const folder = this.findFolder(workspacePath);
    if (undefined === folder) {
      return undefined;
    }
    const { section, key } = this.split(setting);
    const inspected = vscode.workspace
      .getConfiguration(section, folder.uri)
      .inspect<ExcludeValue>(key);
    return inspected?.workspaceFolderValue;
  }

  public async writeExclude(
    workspacePath: string,
    setting: ExcludeSettingKey,
    value: ExcludeValue | undefined,
  ): Promise<SettingsWriteResult> {
    const folder = this.findFolder(workspacePath);
    if (undefined === folder) {
      return 'folderNotFound';
    }
    const { section, key } = this.split(setting);
    await vscode.workspace
      .getConfiguration(section, folder.uri)
      .update(key, value, vscode.ConfigurationTarget.WorkspaceFolder);
    return 'written';
  }

  private findFolder(workspacePath: string): vscode.WorkspaceFolder | undefined {
    return (vscode.workspace.workspaceFolders ?? []).find(
      (folder) => folder.uri.fsPath === workspacePath,
    );
  }

  private split(setting: ExcludeSettingKey): { section: string; key: string } {
    const [section, key] = setting.split('.');
    return { section, key };
  }
}
