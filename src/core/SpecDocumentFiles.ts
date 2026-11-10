import type { ISpecDocuments } from './model/ISpecDocuments';
import type { SpecDocumentKind } from './model/SpecDocumentKind';
import { SPEC_DOCUMENT_KINDS } from './model/SpecDocumentKind';

/** File name of each spec document kind. */
const DOCUMENT_FILE_NAMES: Readonly<Record<SpecDocumentKind, string>> = {
  requirements: 'requirements.md',
  design: 'design.md',
  tasks: 'tasks.md',
  notes: 'notes.md',
  bugfix: 'bugfix.md',
};

/**
 * Resolve the file name of a spec document kind.
 * @param kind The document kind.
 * @returns The file name (e.g. `tasks.md`).
 */
export function documentFileName(kind: SpecDocumentKind): string {
  return DOCUMENT_FILE_NAMES[kind];
}
/**
 * Build the presence flags of a spec from a per-kind predicate, so a new kind in
 * the registry is covered without touching the callers.
 * @param isPresent Tells whether the document of a kind exists.
 * @returns The presence flags of every document kind.
 */
export function buildSpecDocuments(isPresent: (kind: SpecDocumentKind) => boolean): ISpecDocuments {
  const flags: Partial<Record<SpecDocumentKind, boolean>> = {};
  SPEC_DOCUMENT_KINDS.forEach((kind) => {
    flags[kind] = isPresent(kind);
  });
  // Safe assertion: the loop above assigned every kind of the registry.
  return flags as ISpecDocuments;
}
