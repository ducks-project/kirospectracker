/**
 * One selectable folder option shown in the dashboard's folder-filter menu.
 *
 * It pairs the stable owning-folder {@link key} the filter matches on with the
 * human-readable {@link label} the menu displays and the {@link count} of specs
 * owned by that folder. Keeping the key and the label distinct is deliberate:
 * two workspace folders can share a basename (same label) yet have different
 * paths (different keys), so the menu shows the label while the filter keys on
 * the path.
 */
export interface ISpecFolderOption {
  /** Stable owning-folder identity the folder filter matches on (its path). */
  readonly key: string;

  /** Human-readable folder label shown in the menu (the folder basename). */
  readonly label: string;

  /** Number of currently loaded specs owned by this folder. */
  readonly count: number;
}
