import type { ISpecDocuments } from '../model/ISpecDocuments';

/**
 * Port (Dependency Inversion) describing which canonical documents a spec must
 * have to avoid the `Malformed` status.
 *
 * The default policy requires only an exploitable `tasks.md`; a stricter policy
 * may also require `requirements.md` and/or `design.md`. The resolver depends on
 * this abstraction so the threshold is configurable without touching the core
 * state rules.
 */
export interface IDocumentPolicy {
  /**
   * Decide whether the given document presence satisfies the policy.
   * @param documents The presence flags of a spec's documents.
   * @returns `true` when the spec is structurally well-formed.
   */
  isWellFormed(documents: ISpecDocuments): boolean;
}
