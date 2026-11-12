import type { ISpecCardView } from '../../core/model/ISpecCardView';
import { isDoneStatus } from './CardGrouping';

/** How a scoped `specUpdated` is applied to the dashboard content. */
export type SpecUpdateAction = 'swap-node' | 'rebuild-content';

/**
 * Decide how to apply a scoped single-card update.
 *
 * When a status change moves the card between the active and completed groups,
 * or the card is not currently mounted, the content must be rebuilt so the card
 * lands in the right section; otherwise only that one node is replaced.
 * @param previous The card as known before the update, if any.
 * @param next The updated card view.
 * @param hasPreviousNode Whether the card currently has a mounted node.
 * @returns `swap-node` to replace the single node, `rebuild-content` otherwise.
 */
export function planSpecUpdate(
  previous: ISpecCardView | undefined,
  next: ISpecCardView,
  hasPreviousNode: boolean,
): SpecUpdateAction {
  const movesGroup =
    undefined === previous || isDoneStatus(previous.status) !== isDoneStatus(next.status);
  if (!hasPreviousNode || movesGroup) {
    return 'rebuild-content';
  }
  return 'swap-node';
}
