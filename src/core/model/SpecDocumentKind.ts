/**
 * Registry (single source of truth) of the spec document kinds.
 *
 * Every per-kind map in the code base is typed `Record<SpecDocumentKind, ...>`
 * and every per-kind list derives from this array, so adding a document kind is
 * one entry here plus the compiler-guided entries of those maps (file name,
 * tree command id): an additive, localised change rather than a scattered edit.
 * The order is the display order of the dashboard links and the tree menu.
 */
export const SPEC_DOCUMENT_KINDS = ['requirements', 'design', 'tasks', 'notes', 'bugfix'] as const;
/** Document keys the webview can request to open. */
export type SpecDocumentKind = (typeof SPEC_DOCUMENT_KINDS)[number];
