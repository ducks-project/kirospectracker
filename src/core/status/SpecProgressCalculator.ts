import type { ISpecProgress } from '../model/ISpecProgress';
import type { ITaskItem } from '../model/ITaskItem';

/** Full ratio returned when the required set has no task to complete. */
const FULL_RATIO = 1;

/** Empty ratio returned when the optional set has no task. */
const EMPTY_RATIO = 0;

/** Per-state accumulator for one task set (required or optional). */
interface ICounts {
  done: number;
  cancelled: number;
  inProgress: number;
  todo: number;
  total: number;
}

/**
 * Build an empty per-state accumulator.
 * @returns A fresh accumulator with all counters at zero.
 */
function emptyCounts(): ICounts {
  return { done: 0, cancelled: 0, inProgress: 0, todo: 0, total: 0 };
}

/**
 * Increment exactly one per-state counter for a leaf and bump the total.
 * @param counts The accumulator to mutate.
 * @param state The leaf's task state.
 */
function tally(counts: ICounts, state: ITaskItem['state']): void {
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
 * Walk the tree, counting each leaf into its required or optional set.
 * @param tasks The tasks to walk.
 * @param required The required-set accumulator.
 * @param optional The optional-set accumulator.
 */
function visit(tasks: readonly ITaskItem[], required: ICounts, optional: ICounts): void {
  tasks.forEach((task) => {
    if (0 < task.children.length) {
      visit(task.children, required, optional);
      return;
    }
    tally(task.optional ? optional : required, task.state);
  });
}

/**
 * Compute the RESOLVED count of a set (done + cancelled).
 * @param counts The per-state accumulator.
 * @returns The number of resolved leaves.
 */
function resolved(counts: ICounts): number {
  return counts.done + counts.cancelled;
}

/**
 * Pure calculator turning a task tree into separate required/optional progress.
 *
 * Only leaf tasks count: a task with children contributes its children, not
 * itself, so a parent checkbox is never double-counted. Leaves split into the
 * required set R (no `*`) and the optional set O (`*`). The required ratio is
 * 100 % when R is empty; the optional ratio is 0 % when O is empty.
 */
/**
 * Compute a completion ratio, substituting a fallback when the set is empty.
 * @param counts The done/total counts of the set.
 * @param emptyFallback The ratio to return when `total === 0`.
 * @returns The completion ratio in `[0, 1]`.
 */
function ratio(counts: ICounts, emptyFallback: number): number {
  if (0 === counts.total) {
    return emptyFallback;
  }
  return resolved(counts) / counts.total;
}

export class SpecProgressCalculator {
  /**
   * Full ratio returned for the required set when it has no task; configurable
   * so the empty-set convention stays explicit at the composition root.
   */
  private readonly emptyRequiredRatio: number;

  /** Empty ratio returned for the optional set when it has no task. */
  private readonly emptyOptionalRatio: number;

  /**
   * Build a calculator with the empty-set ratio conventions.
   * @param emptyRequiredRatio Required ratio when R is empty (defaults to 1).
   * @param emptyOptionalRatio Optional ratio when O is empty (defaults to 0).
   */
  public constructor(
    emptyRequiredRatio: number = FULL_RATIO,
    emptyOptionalRatio: number = EMPTY_RATIO,
  ) {
    this.emptyRequiredRatio = emptyRequiredRatio;
    this.emptyOptionalRatio = emptyOptionalRatio;
  }

  /**
   * Compute the required/optional progress of a task tree.
   * @param tasks The parsed top-level tasks.
   * @returns The immutable progress value object.
   */
  public calculate(tasks: readonly ITaskItem[]): ISpecProgress {
    const required: ICounts = emptyCounts();
    const optional: ICounts = emptyCounts();

    visit(tasks, required, optional);

    return {
      requiredDone: resolved(required),
      requiredTotal: required.total,
      optionalDone: resolved(optional),
      optionalTotal: optional.total,
      requiredRatio: ratio(required, this.emptyRequiredRatio),
      optionalRatio: ratio(optional, this.emptyOptionalRatio),
      requiredResolvedDone: required.done,
      requiredResolvedCancelled: required.cancelled,
      requiredInProgress: required.inProgress,
      requiredTodo: required.todo,
      optionalResolvedDone: optional.done,
      optionalResolvedCancelled: optional.cancelled,
      optionalInProgress: optional.inProgress,
      optionalTodo: optional.todo,
    };
  }
}
