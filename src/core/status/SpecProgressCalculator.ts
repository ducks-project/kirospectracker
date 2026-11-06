import type { ISpecProgress } from '../model/ISpecProgress';
import type { ITaskItem } from '../model/ITaskItem';

/** Full ratio returned when the required set has no task to complete. */
const FULL_RATIO = 1;

/** Empty ratio returned when the optional set has no task. */
const EMPTY_RATIO = 0;

/** Accumulator of done/total counts for one task set. */
interface ICounts {
  done: number;
  total: number;
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
    const bucket = task.optional ? optional : required;
    bucket.total += 1;
    if (task.done) {
      bucket.done += 1;
    }
  });
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
  return counts.done / counts.total;
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
    const required: ICounts = { done: 0, total: 0 };
    const optional: ICounts = { done: 0, total: 0 };

    visit(tasks, required, optional);

    return {
      requiredDone: required.done,
      requiredTotal: required.total,
      optionalDone: optional.done,
      optionalTotal: optional.total,
      requiredRatio: ratio(required, this.emptyRequiredRatio),
      optionalRatio: ratio(optional, this.emptyOptionalRatio),
    };
  }
}
