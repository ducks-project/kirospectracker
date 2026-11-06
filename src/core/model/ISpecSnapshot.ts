import type { ISpecDocuments } from './ISpecDocuments';
import type { ISpecProgress } from './ISpecProgress';
import type { ITaskItem } from './ITaskItem';
import type { SpecStatus } from './SpecStatus';

/**
 * Immutable, serializable snapshot of one spec handed from the adapters to the
 * presentation layers (explorer decorations, dashboard webview, tree view).
 *
 * It is plain data so it can cross the webview `postMessage` boundary unchanged:
 * the webview never holds a `vscode` object, and the core never holds webview
 * state.
 */
export interface ISpecSnapshot {
  /** Spec name, i.e. the direct sub-folder name under `.kiro/specs/`. */
  readonly name: string;

  /** Absolute path of the spec folder, as a string (filesystem-agnostic). */
  readonly folderPath: string;

  /** Absolute path of the owning workspace folder, as a string. */
  readonly workspacePath: string;

  /** Presence flags of the spec's canonical and annex documents. */
  readonly documents: ISpecDocuments;

  /** Parsed task tree from `tasks.md`; empty when the spec is malformed. */
  readonly tasks: readonly ITaskItem[];

  /** Resolved lifecycle status of the spec. */
  readonly status: SpecStatus;

  /** Separate required/optional progress ratios and counts. */
  readonly progress: ISpecProgress;
}
