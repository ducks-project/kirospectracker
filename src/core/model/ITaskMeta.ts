/**
 * One property-based-test result recorded for a task in `tasks.meta.json`.
 *
 * Every field is optional: the reader is tolerant and never relies on a
 * particular shape, since the file is a secondary informational signal only.
 */
export interface IPbtResult {
  /** Reported status of the property-based test (e.g. `"passed"`). */
  readonly status?: string;

  /** Epoch milliseconds of the last run, when recorded. */
  readonly lastRunTimestamp?: number;
}

/**
 * One past execution entry recorded for a task in `tasks.meta.json`.
 */
export interface IExecutionHistoryEntry {
  /** Identifier of the execution, when recorded. */
  readonly executionId?: string;

  /** Chat session identifier associated with the execution, when recorded. */
  readonly chatSessionId?: string;

  /** Epoch milliseconds of the execution, when recorded. */
  readonly timestamp?: number;
}

/**
 * Tolerant view of a `tasks.meta.json` file.
 *
 * Both sections are indexed by the full task label (number + title). The file
 * NEVER carries the done/not-done status of a task (that comes only from
 * `tasks.md` checkboxes); it is a secondary signal whose absence or invalidity
 * must never block progress computation.
 */
export interface ITaskMeta {
  /** Property-based-test results per task label. */
  readonly pbtResults: Readonly<Record<string, IPbtResult>>;

  /** Past execution history per task label. */
  readonly executionHistory: Readonly<Record<string, readonly IExecutionHistoryEntry[]>>;
}
