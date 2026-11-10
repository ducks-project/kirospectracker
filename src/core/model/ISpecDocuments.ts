/**
 * Presence flags for the documents of a spec.
 *
 * `tasks.md` is the only document required to compute progress; the others are
 * informational. A `false` flag means the file is absent or unreadable.
 */
export interface ISpecDocuments {
  /** Whether an exploitable `tasks.md` is present. */
  readonly tasks: boolean;

  /** Whether `requirements.md` is present. */
  readonly requirements: boolean;

  /** Whether `design.md` is present. */
  readonly design: boolean;

  /** Whether `notes.md` is present. */
  readonly notes: boolean;
  /** Whether `bugfix.md` (the bugfix spec entry document) is present. */
  readonly bugfix: boolean;
}
