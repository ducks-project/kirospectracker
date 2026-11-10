/** Name of a VS Code exclusion setting the extension may write to. */
export type ExcludeSettingKey = 'files.exclude' | 'search.exclude';

/**
 * Value of the `kirospectracker.hideSpecs.mode` setting: which editor surfaces
 * hide the specs whose status is selected.
 */
export enum HideSpecsMode {
  /** Nothing is hidden and the extension never writes to the exclusion settings. */
  Off = 'off',
  /** Specs are hidden from Search and Quick Open only (`search.exclude`). */
  SearchAndQuickOpen = 'searchAndQuickOpen',
  /** Specs are hidden from Explorer, Search and Quick Open (`files.exclude`). */
  Everywhere = 'everywhere',
}

/** Every exclusion setting the extension may own entries in. */
export const MANAGED_EXCLUDE_SETTINGS: readonly ExcludeSettingKey[] = [
  'files.exclude',
  'search.exclude',
];

/** Exclusion setting each mode writes to; `undefined` when the mode writes nothing. */
const SETTING_BY_MODE: Readonly<Record<HideSpecsMode, ExcludeSettingKey | undefined>> = {
  [HideSpecsMode.Off]: undefined,
  [HideSpecsMode.SearchAndQuickOpen]: 'search.exclude',
  [HideSpecsMode.Everywhere]: 'files.exclude',
};

/**
 * Pure helpers mapping the raw mode setting to the exclusion setting it drives.
 */
export class HideSpecsModeMapper {
  /**
   * Coerce a raw configuration value into a mode, falling back to `Off`.
   * @param raw The raw value read from the configuration.
   * @returns The matching mode, or {@link HideSpecsMode.Off} for anything unknown.
   */
  public parse(raw: unknown): HideSpecsMode {
    const known = Object.values(HideSpecsMode).find((mode) => mode === raw);
    return known ?? HideSpecsMode.Off;
  }

  /**
   * Resolve the exclusion setting a mode writes to.
   * @param mode The active mode.
   * @returns The setting key, or `undefined` for {@link HideSpecsMode.Off}.
   */
  public settingFor(mode: HideSpecsMode): ExcludeSettingKey | undefined {
    return SETTING_BY_MODE[mode];
  }
}
