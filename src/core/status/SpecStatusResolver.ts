import type { ISpecDocuments } from '../model/ISpecDocuments';
import type { ISpecProgress } from '../model/ISpecProgress';
import type { IDocumentPolicy } from '../ports/IDocumentPolicy';
import { SpecStatus } from '../model/SpecStatus';

/**
 * Pure resolver mapping document presence and progress to a {@link SpecStatus}.
 *
 * It applies the ordered state rules of the `kiro-spec-format` steering, first
 * match wins: Malformed, then NotStarted, InProgress, Completed and finally
 * FullyCompleted. The set of documents whose absence triggers Malformed is
 * delegated to an injected {@link IDocumentPolicy} (default: only `tasks.md`).
 */
export class SpecStatusResolver {
  private readonly policy: IDocumentPolicy;

  /**
   * Build a resolver bound to a document-required policy.
   * @param policy The policy deciding when a spec is malformed.
   */
  public constructor(policy: IDocumentPolicy) {
    this.policy = policy;
  }

  /**
   * Resolve the status of a spec from its documents and progress.
   * @param documents The presence flags of the spec's documents.
   * @param progress The computed required/optional progress.
   * @returns The resolved lifecycle status.
   */
  public resolve(documents: ISpecDocuments, progress: ISpecProgress): SpecStatus {
    if (!this.policy.isWellFormed(documents)) {
      return SpecStatus.Malformed;
    }
    if (SpecStatusResolver.isNotStarted(progress)) {
      return SpecStatus.NotStarted;
    }
    if (progress.requiredDone < progress.requiredTotal) {
      return SpecStatus.InProgress;
    }
    if (SpecStatusResolver.isFullyCompleted(progress)) {
      return SpecStatus.FullyCompleted;
    }
    return SpecStatus.Completed;
  }

  /**
   * Whether no task (required or optional) is done.
   * @param progress The computed progress.
   * @returns `true` when nothing is done.
   */
  private static isNotStarted(progress: ISpecProgress): boolean {
    return 0 === progress.requiredDone && 0 === progress.optionalDone;
  }

  /**
   * Whether every required AND every optional task is done.
   * @param progress The computed progress.
   * @returns `true` when both sets are fully done.
   */
  private static isFullyCompleted(progress: ISpecProgress): boolean {
    return progress.optionalDone === progress.optionalTotal;
  }
}
