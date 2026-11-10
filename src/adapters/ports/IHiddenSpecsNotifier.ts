import type { ExcludeSettingKey } from '../../core/hiding/HideSpecsMode';

/** What the first-write notice describes. */
export interface IFirstWriteNotice {
  /** Number of specs just hidden. */
  readonly count: number;
  /** Setting the entries were written to. */
  readonly setting: ExcludeSettingKey;
  /** Workspace folder whose settings file received them. */
  readonly workspacePath: string;
}

/** Port surfacing a non-blocking notice after the first write to the settings. */
export interface IHiddenSpecsNotifier {
  /**
   * Tell the user specs were hidden, offering to open the settings file.
   * @param notice The notice description.
   */
  notifyFirstWrite(notice: IFirstWriteNotice): void;
  /**
   * Tell the user the hidden specs were reset.
   * @param removed Number of entries removed.
   */
  notifyReset(removed: number): void;
}
