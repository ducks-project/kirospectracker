import type { SpecDocumentKind } from './model/IDashboardMessage';

/** File name of each spec document kind. */
const DOCUMENT_FILE_NAMES: Readonly<Record<SpecDocumentKind, string>> = {
  requirements: 'requirements.md',
  design: 'design.md',
  tasks: 'tasks.md',
  notes: 'notes.md',
};

/**
 * Resolve the file name of a spec document kind.
 * @param kind The document kind.
 * @returns The file name (e.g. `tasks.md`).
 */
export function documentFileName(kind: SpecDocumentKind): string {
  return DOCUMENT_FILE_NAMES[kind];
}
