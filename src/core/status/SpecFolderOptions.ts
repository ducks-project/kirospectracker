import type { ISpecCardView } from '../model/ISpecCardView';
import type { ISpecFolderOption } from '../model/ISpecFolderOption';

/**
 * Compute the distinct owning-folder options from the current cards.
 *
 * It walks the cards once (O(n), no per-task work), groups them by their stable
 * {@link ISpecCardView.folderKey}, keeps the first {@link ISpecCardView.ownerLabel}
 * seen for each key as its display label, and counts the specs per folder. The
 * result is sorted deterministically (by label, then by key as a tie-breaker so
 * two folders sharing a basename keep a stable, reproducible order), which the
 * folder-filter menu renders directly.
 * @param cards The card views currently loaded in the dashboard.
 * @returns The distinct folder options, sorted deterministically.
 */
export function computeFolderOptions(
  cards: readonly ISpecCardView[],
): readonly ISpecFolderOption[] {
  const byKey = new Map<string, { label: string; count: number }>();
  cards.forEach((card) => {
    const existing = byKey.get(card.folderKey);
    if (undefined === existing) {
      byKey.set(card.folderKey, { label: card.ownerLabel, count: 1 });
      return;
    }
    existing.count += 1;
  });
  const options = [...byKey.entries()].map(
    ([key, value]): ISpecFolderOption => ({ key, label: value.label, count: value.count }),
  );
  return options.sort(compareFolderOptions);
}

/**
 * Deterministic comparator ordering folder options by label, then by key.
 * @param left The first option.
 * @param right The second option.
 * @returns A negative, zero or positive number per the sort contract.
 */
function compareFolderOptions(left: ISpecFolderOption, right: ISpecFolderOption): number {
  if (left.label !== right.label) {
    return left.label < right.label ? -1 : 1;
  }
  if (left.key === right.key) {
    return 0;
  }
  return left.key < right.key ? -1 : 1;
}
