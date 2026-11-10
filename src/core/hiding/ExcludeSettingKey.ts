/** Name of a VS Code exclusion setting the extension may write to. */
export type ExcludeSettingKey = 'files.exclude' | 'search.exclude';

/** Every exclusion setting the extension may own entries in. */
export const MANAGED_EXCLUDE_SETTINGS: readonly ExcludeSettingKey[] = [
  'files.exclude',
  'search.exclude',
];
