import type { IGlobalTaskStats } from '../model/IGlobalTaskStats';
import type { ITaskItem } from '../model/ITaskItem';

/** Empty percentage returned when there is no task to complete. */
const EMPTY_PERCENT = 0;

/** Mutable per-state accumulator used while walking the trees. */
interface IMutableGlobalCounts {
  done: number;
  cancelled: number;
  inProgress: number;
  todo: number;
  total: number;
}

/**
 * Increment exactly one per-state counter for a leaf and bump the total.
 * @param counts The accumulator to mutate.
 * @param state The leaf's task state.
 */
function tally(counts: IMutableGlobalCounts, state: ITaskItem['state']): void {
  counts.total += 1;
  if ('done' === state) {
    counts.done += 1;
    return;
  }
  if ('cancelled' === state) {
    counts.cancelled += 1;
    return;
  }
  if ('inProgress' === state) {
    counts.inProgress += 1;
    return;
  }
  counts.todo += 1;
}

/**
 * Walk a task tree, tallying each leaf into the accumulator.
 * @param tasks The tasks to walk.
 * @param counts The accumulator to mutate.
 */
function visit(tasks: readonly ITaskItem[], counts: IMutableGlobalCounts): void {
  tasks.forEach((task) => {
    if (0 < task.children.length) {
      visit(task.children, counts);
      return;
    }
    tally(counts, task.state);
  });
}

/**
 * Pure, vscode-free calculator aggregating the leaf tasks of every spec into a
 * single {@link IGlobalTaskStats}.
 *
 * It walks each tree ONCE, bucketing leaves by task state. `percentComplete` is
 * RESOLVED-based (done + cancelled over total), so a corpus made only of
 * cancelled tasks still reaches 1; an empty corpus yields 0.
 */
export class GlobalTaskStatsCalculator {
  /**
   * Aggregate the task trees of every spec into global statistics.
   * @param trees One task tree per spec; each is a list of top-level tasks.
   * @returns The immutable global task statistics.
   */
  public calculate(trees: readonly (readonly ITaskItem[])[]): IGlobalTaskStats {
    const counts: IMutableGlobalCounts = {
      done: 0,
      cancelled: 0,
      inProgress: 0,
      todo: 0,
      total: 0,
    };

    trees.forEach((tree) => visit(tree, counts));

    const resolved = counts.done + counts.cancelled;
    return {
      done: counts.done,
      cancelled: counts.cancelled,
      inProgress: counts.inProgress,
      todo: counts.todo,
      total: counts.total,
      percentComplete: 0 < counts.total ? resolved / counts.total : EMPTY_PERCENT,
    };
  }
}
