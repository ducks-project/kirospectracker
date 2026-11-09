import type { ISpecCardView } from '../model/ISpecCardView';
import type { ISpecFolderOption } from '../model/ISpecFolderOption';
import type { SpecFolderFilter } from './SpecFolderFilter';
import { computeFolderOptions } from './SpecFolderOptions';

/** Accessible presentation of one folder-filter menu item. */
export interface ISpecFolderToggleView {
  /** The stable folder key this menu item toggles. */
  readonly key: string;
  /** Human label shown in the menu (the folder basename). */
  readonly label: string;
  /** Number of specs owned by this folder. */
  readonly count: number;
  /** Whether the folder filter is currently active (pressed) for this key. */
  readonly pressed: boolean;
}

/**
 * Pure mapper projecting the current cards and the active folder filter onto the
 * folder-filter menu items the dashboard renders.
 *
 * It reuses {@link computeFolderOptions} for the distinct options (DRY) and only
 * adds each item's pressed state from the {@link SpecFolderFilter}, so the
 * webview renders accessible menu buttons (with `aria-pressed`) without owning
 * any filtering or grouping logic. Being `vscode`- and DOM-free, it is
 * unit-testable in the core. It mirrors {@link SpecStatToggleView} on purpose.
 */
export class SpecFolderToggleView {
  /**
   * Build the ordered folder menu items for the current cards and filter.
   * @param cards The card views currently loaded in the dashboard.
   * @param filter The active additive folder filter.
   * @returns The ordered folder toggle views.
   */
  // eslint-disable-next-line class-methods-use-this
  public build(
    cards: readonly ISpecCardView[],
    filter: SpecFolderFilter,
  ): readonly ISpecFolderToggleView[] {
    return computeFolderOptions(cards).map((option: ISpecFolderOption) => ({
      key: option.key,
      label: option.label,
      count: option.count,
      pressed: filter.isActive(option.key),
    }));
  }
}
