import type { ISpecDocuments } from '../../core/model/ISpecDocuments';
import type { SpecDocumentKind } from '../../core/model/SpecDocumentKind';

/**
 * Decide which document links a card renders: only the kinds whose document is
 * present, in the given display order. Absent documents get no link at all.
 * @param documents Presence flags of the spec documents.
 * @param kinds All document kinds, in display order.
 * @returns The kinds to render a link for (empty when the spec has no document).
 */
export function visibleDocumentKinds(
  documents: ISpecDocuments,
  kinds: readonly SpecDocumentKind[],
): readonly SpecDocumentKind[] {
  return kinds.filter((kind) => Boolean(documents[kind]));
}
