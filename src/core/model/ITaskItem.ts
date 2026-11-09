import type { TaskState } from './TaskState';

/**
 * A single parsed task from a `tasks.md` file.
 *
 * Tasks form a tree through {@link ITaskItem.children}; only leaf tasks (those
 * with no children) are counted for progress. The shape is plain and immutable
 * so it can cross the `core`/`adapters` boundary and the webview `postMessage`
 * channel without carrying any `vscode` type.
 */
export interface ITaskItem {
  /** Hierarchical number of the task, e.g. `"1"` or `"1.2"`. */
  readonly id: string;

  /** Human-readable title following the task number on the checkbox line. */
  readonly title: string;

  /** Lifecycle state derived from the checkbox mark (`[ ]`/`[x]`/`[-]`/`[~]`). */
  readonly state: TaskState;

  /** Whether a `*` is glued to the checkbox (`- [ ]* 1.2`), marking it optional. */
  readonly optional: boolean;

  /** Child tasks nested under this one via deeper indentation. */
  readonly children: readonly ITaskItem[];

  /** Requirement identifiers from the `_Requirements: ..._` metadata line. */
  readonly requirements: readonly string[];
}
