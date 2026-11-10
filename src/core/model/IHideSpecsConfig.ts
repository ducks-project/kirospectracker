import type { HideSpecsMode } from '../hiding/HideSpecsMode';
import type { SpecStatus } from './SpecStatus';

/** Resolved `kirospectracker.hideSpecs.*` configuration. */
export interface IHideSpecsConfig {
  /** Which surfaces hide the selected specs. */
  readonly mode: HideSpecsMode;
  /** Statuses whose specs are hidden. */
  readonly hiddenStatuses: ReadonlySet<SpecStatus>;
}
