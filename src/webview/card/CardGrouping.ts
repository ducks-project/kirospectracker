import type { ISpecCardView } from '../../core/model/ISpecCardView';
import { SpecCardFilter } from '../../core/status/SpecCardFilter';
import type { SpecFolderFilter } from '../../core/status/SpecFolderFilter';
import type { SpecStatusFilter } from '../../core/status/SpecStatusFilter';

/**
 * Whether a status places a card in the completed group.
 * @param status The spec status string.
 * @returns `true` for `Completed` or `FullyCompleted`.
 */
export function isDoneStatus(status: string): boolean {
  return 'Completed' === status || 'FullyCompleted' === status;
}

/**
 * Split cards into active and completed groups, completed kept visible but set
 * apart.
 * @param cards The cards to split.
 * @returns A tuple of active and completed cards.
 */
export function partitionCards(
  cards: readonly ISpecCardView[],
): readonly [readonly ISpecCardView[], readonly ISpecCardView[]] {
  return [
    cards.filter((card) => !isDoneStatus(card.status)),
    cards.filter((card) => isDoneStatus(card.status)),
  ];
}

/**
 * Filter cards by the active status toggles, the active folder filter and the
 * search query, composed (logical AND) by the pure {@link SpecCardFilter}.
 * @param cards The cards to filter.
 * @param filter The active status filter.
 * @param folderFilter The active folder filter.
 * @param query The search query.
 * @returns The filtered cards.
 */
export function filterCards(
  cards: readonly ISpecCardView[],
  filter: SpecStatusFilter,
  folderFilter: SpecFolderFilter,
  query: string,
): readonly ISpecCardView[] {
  return new SpecCardFilter(filter, folderFilter, query).apply(cards);
}
