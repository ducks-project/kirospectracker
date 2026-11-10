import type { IHideSpecsConfig } from '../../core/model/IHideSpecsConfig';

/** Port reading the current `kirospectracker.hideSpecs.*` configuration. */
export interface IHideSpecsConfigReader {
  /**
   * Read the configuration afresh.
   * @returns The resolved mode and hidden statuses.
   */
  read(): IHideSpecsConfig;
}
