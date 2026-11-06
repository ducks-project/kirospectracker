import type { ISpecDocuments } from '../model/ISpecDocuments';
import type { IDocumentPolicy } from '../ports/IDocumentPolicy';

/** Document presence keys that may be demanded by a policy. */
type DocumentKey = keyof ISpecDocuments;

/** Documents required by the default policy: only an exploitable `tasks.md`. */
const DEFAULT_REQUIRED_DOCUMENTS: readonly DocumentKey[] = ['tasks'];

/**
 * Default {@link IDocumentPolicy}: a spec is well-formed as soon as it has an
 * exploitable `tasks.md`.
 *
 * Missing `requirements.md` or `design.md` is a warning surfaced elsewhere, not
 * a blocker, matching the steering default threshold. The required set is held
 * as instance state so a stricter policy can be built by passing a wider list.
 */
export class TasksOnlyDocumentPolicy implements IDocumentPolicy {
  private readonly required: readonly DocumentKey[];

  /**
   * Build a policy demanding the given documents.
   * @param required Document keys that must be present (defaults to `tasks`).
   */
  public constructor(required: readonly DocumentKey[] = DEFAULT_REQUIRED_DOCUMENTS) {
    this.required = required;
  }

  /**
   * Decide whether a spec is well-formed under this policy.
   * @param documents The presence flags of a spec's documents.
   * @returns `true` when every required document is present.
   */
  public isWellFormed(documents: ISpecDocuments): boolean {
    return this.required.every((key) => documents[key]);
  }
}
