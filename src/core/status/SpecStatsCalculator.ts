import type { ISpecSnapshot } from '../model/ISpecSnapshot';
import type { ISpecStats } from '../model/ISpecStats';
import { SpecStatus } from '../model/SpecStatus';

/** Predicate testing a spec status. */
type StatusPredicate = (status: SpecStatus) => boolean;

/**
 * Count the snapshots whose status matches a predicate.
 * @param snapshots The snapshots to scan.
 * @param predicate Status predicate.
 * @returns The number of matching snapshots.
 */
function countBy(snapshots: readonly ISpecSnapshot[], predicate: StatusPredicate): number {
  return snapshots.filter((snapshot) => predicate(snapshot.status)).length;
}

/**
 * Whether a status counts as completed for the aggregate.
 * @param status The status to test.
 * @returns `true` for `Completed` or `FullyCompleted`.
 */
function isCompleted(status: SpecStatus): boolean {
  return SpecStatus.Completed === status || SpecStatus.FullyCompleted === status;
}

/**
 * Pure calculator aggregating spec snapshots into status counts.
 *
 * `Completed` and `FullyCompleted` both count as completed for the aggregate;
 * the dashboard still distinguishes them per spec. The completed predicate is
 * held as instance state so the aggregate rule stays explicit and overridable.
 */
export class SpecStatsCalculator {
  /** Predicate deciding which statuses count as completed in the aggregate. */
  private readonly completedPredicate: StatusPredicate;

  /**
   * Build a calculator with an optional completed-status predicate.
   * @param completedPredicate Predicate for completed statuses (defaults to
   *   `Completed` or `FullyCompleted`).
   */
  public constructor(completedPredicate: StatusPredicate = isCompleted) {
    this.completedPredicate = completedPredicate;
  }

  /**
   * Aggregate a list of snapshots into status counts.
   * @param snapshots The discovered spec snapshots.
   * @returns The immutable aggregate statistics.
   */
  public calculate(snapshots: readonly ISpecSnapshot[]): ISpecStats {
    return {
      total: snapshots.length,
      completed: countBy(snapshots, this.completedPredicate),
      inProgress: countBy(snapshots, (status) => SpecStatus.InProgress === status),
      notStarted: countBy(snapshots, (status) => SpecStatus.NotStarted === status),
      malformed: countBy(snapshots, (status) => SpecStatus.Malformed === status),
    };
  }
}
