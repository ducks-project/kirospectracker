import type { ISpecDocuments } from './ISpecDocuments';
import type { ISpecProgress } from './ISpecProgress';
import type { SpecDocumentKind } from './SpecDocumentKind';
import type { SpecStatus } from './SpecStatus';

/**
 * Immutable, serializable snapshot of one spec handed from the adapters to the
 * presentation layers (explorer decorations, dashboard webview, tree view).
 *
 * It is plain data so it can cross the webview `postMessage` boundary unchanged:
 * the webview never holds a `vscode` object, and the core never holds webview
 * state.
 *
 * Progress and status are precomputed here; the full parsed task tree is NOT
 * retained on the snapshot. `RunTasksCommand` parses `tasks.md` on demand when
 * the user runs a spec, so the repository never caches the task trees.
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

  /** Resolved lifecycle status of the spec. */
  readonly status: SpecStatus;

  /** Separate required/optional progress ratios and counts. */
  readonly progress: ISpecProgress;
  /**
   * Document the card click and hover introduction open, resolved from
   * `.config.kiro` with a fallback; `undefined` when no document is available.
   */
  readonly entryDocument: SpecDocumentKind | undefined;
}
