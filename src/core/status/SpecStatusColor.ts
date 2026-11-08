import type { SpecFilterKey } from '../model/SpecFilterKey';
import type { SpecStatus } from '../model/SpecStatus';
import { statusToFilterKey } from '../model/SpecFilterKey';

/**
 * Stable CSS modifier token identifying the state-representative color of a
 * status group.
 *
 * The token is appended to a base class (e.g. `badge badge-completed`) so the
 * stylesheet can map each state to a theme-aware color: the token is the single
 * source of truth shared by the toolbar stat toggles and the card status
 * badges, and the CSS binds the actual VS Code theme color variables to it.
 */
export type SpecStatusColorToken =
  | 'badge-completed'
  | 'badge-inProgress'
  | 'badge-notStarted'
  | 'badge-malformed';

/**
 * Single source of truth mapping each {@link SpecFilterKey} to its
 * state-representative color token.
 *
 * Keying the table on the filter key (rather than on the raw status) means the
 * toolbar stat toggles and the per-card status badges resolve the SAME color
 * for the same state, keeping the two surfaces visually in sync by
 * construction. The `Record<SpecFilterKey, ...>` shape is compile-time checked,
 * so adding a filter key without a color fails `tsc`.
 */
const COLOR_TOKEN_BY_KEY: Readonly<Record<SpecFilterKey, SpecStatusColorToken>> = {
  completed: 'badge-completed',
  inProgress: 'badge-inProgress',
  notStarted: 'badge-notStarted',
  malformed: 'badge-malformed',
};

/**
 * Resolve the color token of a filter key.
 * @param key The status filter key.
 * @returns The matching color token.
 */
export function colorTokenForFilterKey(key: SpecFilterKey): SpecStatusColorToken {
  return COLOR_TOKEN_BY_KEY[key];
}

/**
 * Resolve the color token of a resolved spec status, via its filter key.
 *
 * Both `Completed` and `FullyCompleted` resolve to the completed color, exactly
 * like the filter grouping, so a card badge and its matching stat toggle always
 * share one color.
 * @param status The resolved spec status.
 * @returns The matching color token.
 */
export function colorTokenForStatus(status: SpecStatus): SpecStatusColorToken {
  return colorTokenForFilterKey(statusToFilterKey(status));
}
