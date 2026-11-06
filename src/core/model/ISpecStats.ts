/**
 * Aggregate counts of specs by status, shown in the dashboard header and the
 * explorer summary decoration.
 */
export interface ISpecStats {
  /** Total number of specs discovered. */
  readonly total: number;

  /** Number of `Completed` or `FullyCompleted` specs. */
  readonly completed: number;

  /** Number of `InProgress` specs. */
  readonly inProgress: number;

  /** Number of `NotStarted` (ready/waiting) specs. */
  readonly notStarted: number;

  /** Number of `Malformed` (to finalize) specs. */
  readonly malformed: number;
}
