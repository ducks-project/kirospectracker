import type { ISpecSnapshot } from '../../core/model/ISpecSnapshot';
import type { SpecChangeDelta } from '../../core/model/ISpecChangeDelta';

/** Port exposing the known specs and their change events (a `SpecRepository`). */
export interface ISpecSource {
  /**
   * List the cached snapshots.
   * @returns The snapshots.
   */
  getSpecs(): readonly ISpecSnapshot[];
  /**
   * Subscribe to spec changes.
   * @param listener Called with each change delta.
   * @returns A function removing the subscription.
   */
  onDidChangeSpecs(listener: (delta: SpecChangeDelta) => void): () => void;
}
