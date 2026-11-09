/**
 * Aggregate task counts across every discovered spec, bucketed by
 * {@link import('./TaskState').TaskState}.
 *
 * It powers the dashboard's compact global-stats strip. Only leaf tasks are
 * counted. `percentComplete` is RESOLVED-based: it counts done AND cancelled
 * tasks over the total, so an all-cancelled corpus reaches 1. It follows the
 * webview PERCENT convention and is expressed as a ratio in `[0, 1]` (the
 * webview multiplies by 100 for display).
 */
export interface IGlobalTaskStats {
  /** Number of `done`-state leaf tasks (excludes cancelled). */
  readonly done: number;

  /** Number of `cancelled`-state leaf tasks. */
  readonly cancelled: number;

  /** Number of `inProgress`-state leaf tasks. */
  readonly inProgress: number;

  /** Number of `todo`-state leaf tasks. */
  readonly todo: number;

  /** Total number of leaf tasks across all specs. */
  readonly total: number;

  /** Resolved (done + cancelled) over total, in `[0, 1]`; 0 when total is 0. */
  readonly percentComplete: number;
}
