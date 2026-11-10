import * as vscode from 'vscode';
import { HideSpecsModeMapper } from '../core/hiding/HideSpecsMode';
import { HiddenStatusSelection } from '../core/hiding/HiddenStatusSelection';
import type { IHideSpecsConfig } from '../core/model/IHideSpecsConfig';
import type { IHideSpecsConfigReader } from './ports/IHideSpecsConfigReader';

/** Configuration section owning the hide-specs settings. */
export const HIDE_SPECS_SECTION = 'kirospectracker.hideSpecs';

/**
 * Thin host wrapper implementing {@link IHideSpecsConfigReader} over
 * `workspace.getConfiguration`; all parsing lives in the pure core helpers.
 */
export class VscodeHideSpecsConfigReader implements IHideSpecsConfigReader {
  private readonly modes = new HideSpecsModeMapper();
  private readonly statuses = new HiddenStatusSelection();

  public read(): IHideSpecsConfig {
    const configuration = vscode.workspace.getConfiguration(HIDE_SPECS_SECTION);
    return {
      mode: this.modes.parse(configuration.get<unknown>('mode')),
      hiddenStatuses: this.statuses.parse(configuration.get<unknown>('statuses')),
    };
  }
}
