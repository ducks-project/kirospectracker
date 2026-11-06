/**
 * Lifecycle status of a Kiro spec, computed from its `tasks.md` checkboxes and
 * the presence of its canonical documents.
 *
 * The states are ordered from least to most complete; the resolver applies the
 * ordered rules of the `kiro-spec-format` steering and returns the first match.
 */
export enum SpecStatus {
  /** `tasks.md` is missing/unreadable, or a required canonical document is absent. */
  Malformed = 'Malformed',
  /** `tasks.md` is present but no task (required or optional) is done. */
  NotStarted = 'NotStarted',
  /** At least one task is done, but the required set is not fully done. */
  InProgress = 'InProgress',
  /** Every required task is done; optional tasks are ignored for this state. */
  Completed = 'Completed',
  /** Every required task AND every optional task is done. */
  FullyCompleted = 'FullyCompleted',
}
