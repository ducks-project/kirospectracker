import type { ISpecDocuments } from './ISpecDocuments';
import type { ISpecProgress } from './ISpecProgress';
import type { SpecStatus } from './SpecStatus';

/**
 * Lean dashboard projection the webview consumes for one spec card.
 *
 * It carries only the fields a card renders (name, folder path, document
 * presence, status and progress) and deliberately omits the parsed task tree:
 * the webview never needs the tasks, so keeping them out of the `postMessage`
 * payload keeps each scoped update small and lets task parsing move on-demand.
 */
export interface ISpecCardView {
  /** Spec name, i.e. the direct sub-folder name under `.kiro/specs/`. */
  readonly name: string;

  /** Absolute path of the spec folder, as a string (filesystem-agnostic). */
  readonly folderPath: string;

  /**
   * Stable identity of the owning workspace folder (its absolute path), used as
   * the key of the folder-scoped filter. It is distinct from {@link ownerLabel}
   * on purpose: two workspace folders can share a basename (same label) yet have
   * different paths (different keys), so the folder filter keys on this stable
   * value while the menu shows the label.
   */
  readonly folderKey: string;

  /**
   * Concise, human-readable label of the owning workspace folder (its
   * basename), shown discreetly on the card and in the folder-filter menu.
   * Derived by the pure {@link deriveSpecOwnerLabel} helper so it stays testable.
   */
  readonly ownerLabel: string;

  /** Presence flags of the spec's canonical and annex documents. */
  readonly documents: ISpecDocuments;

  /** Resolved lifecycle status of the spec. */
  readonly status: SpecStatus;

  /** Separate required/optional progress ratios and counts. */
  readonly progress: ISpecProgress;
}
