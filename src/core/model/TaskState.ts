/**
 * The lifecycle state of a single parsed task, derived from its checkbox mark.
 *
 * It is a discriminated union, never a floating string: `'todo'` (`[ ]`),
 * `'done'` (`[x]`/`[X]`), `'cancelled'` (`[-]`) and `'inProgress'` (`[~]`). A
 * task is RESOLVED when it is `'done'` or `'cancelled'`; resolved tasks count in
 * both the numerator AND the denominator of progress.
 */
export type TaskState = 'todo' | 'done' | 'cancelled' | 'inProgress';

/** Mark of a done checkbox in lowercase form. */
const MARK_DONE_LOWER = 'x';

/** Mark of a done checkbox in uppercase form. */
const MARK_DONE_UPPER = 'X';

/** Mark of a cancelled checkbox. */
const MARK_CANCELLED = '-';

/** Mark of an in-progress checkbox. */
const MARK_IN_PROGRESS = '~';

/**
 * Map a single bracket mark character to its {@link TaskState}.
 *
 * This is the ONLY place that reads a raw bracket mark. It is tolerant: any
 * character other than `x`/`X`, `-` or `~` (including a space) maps to `'todo'`.
 * @param mark The single character found between the brackets.
 * @returns The task state the mark represents.
 */
export function taskStateFromMark(mark: string): TaskState {
  if (MARK_DONE_LOWER === mark || MARK_DONE_UPPER === mark) {
    return 'done';
  }
  if (MARK_CANCELLED === mark) {
    return 'cancelled';
  }
  if (MARK_IN_PROGRESS === mark) {
    return 'inProgress';
  }
  return 'todo';
}

/**
 * Whether a task state counts as resolved (done OR cancelled).
 * @param state The task state to test.
 * @returns `true` for `'done'` or `'cancelled'`, `false` otherwise.
 */
export function isResolved(state: TaskState): boolean {
  return 'done' === state || 'cancelled' === state;
}
