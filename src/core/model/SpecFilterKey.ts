import { SpecStatus } from './SpecStatus';

/**
 * Identifier of a dashboard status filter, mirroring the four clickable stat
 * toggles shown in the dashboard header.
 *
 * `completed` groups both {@link SpecStatus.Completed} and
 * {@link SpecStatus.FullyCompleted}, consistently with the aggregate counts the
 * dashboard already displays.
 */
export type SpecFilterKey = 'completed' | 'inProgress' | 'notStarted' | 'malformed';

/** Ordered filter keys, matching the stat header display order. */
export const SPEC_FILTER_KEYS: readonly SpecFilterKey[] = [
  'completed',
  'inProgress',
  'notStarted',
  'malformed',
];

/**
 * Map a spec status to the filter key its card answers to.
 * @param status The resolved spec status.
 * @returns The matching filter key.
 */
export function statusToFilterKey(status: SpecStatus): SpecFilterKey {
  if (SpecStatus.Completed === status || SpecStatus.FullyCompleted === status) {
    return 'completed';
  }
  if (SpecStatus.InProgress === status) {
    return 'inProgress';
  }
  if (SpecStatus.NotStarted === status) {
    return 'notStarted';
  }
  return 'malformed';
}
