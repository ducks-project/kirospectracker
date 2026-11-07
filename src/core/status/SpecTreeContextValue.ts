import type { ISpecDocuments } from '../model/ISpecDocuments';
import type { SpecDocumentKind } from '../model/IDashboardMessage';
import { SpecStatus } from '../model/SpecStatus';

/** Base token marking a tree node as a spec leaf (always present). */
const SPEC_TOKEN = 'spec';

/** Token appended when the spec is runnable (i.e. not malformed). */
const RUNNABLE_TOKEN = 'runnable';

/** Per-document presence token prefix (e.g. `doc-requirements`). */
const DOCUMENT_TOKEN_PREFIX = 'doc-';

/** Document kinds whose presence is encoded, in menu display order. */
const CONTEXT_DOCUMENT_KINDS: readonly SpecDocumentKind[] = [
  'requirements',
  'design',
  'tasks',
  'notes',
];

/**
 * Build the per-document presence token for a document kind.
 * @param kind The document kind.
 * @returns The token, e.g. `doc-design`.
 */
export function documentContextToken(kind: SpecDocumentKind): string {
  return `${DOCUMENT_TOKEN_PREFIX}${kind}`;
}

/**
 * Canonical vocabulary of every context-value token the builder can emit, in
 * menu display order: the `spec` base token, one `doc-<kind>` token per
 * document kind, and the `runnable` token.
 *
 * This is the single source of truth for the token contract. Both
 * {@link buildSpecTreeContextValue} and the package.json `when`-clause assertion
 * derive from it, so a renamed token fails a test rather than silently breaking
 * the tree context menu. Being pure and `vscode`-free, it is unit-testable in
 * the core.
 */
export const SPEC_TREE_CONTEXT_TOKENS: readonly string[] = [
  SPEC_TOKEN,
  ...CONTEXT_DOCUMENT_KINDS.map(documentContextToken),
  RUNNABLE_TOKEN,
];

/**
 * Subset of {@link SPEC_TREE_CONTEXT_TOKENS} that gates a `view/item/context`
 * menu entry: the four `doc-<kind>` tokens (one per "Open" action) and the
 * `runnable` token ("Run tasks"). The `spec` base token gates nothing on its
 * own, so it is deliberately absent. Each listed token MUST have a matching,
 * word-anchored `when` clause in the manifest; the assertion checks both ways.
 */
export const SPEC_TREE_MENU_GATING_TOKENS: readonly string[] = [
  ...CONTEXT_DOCUMENT_KINDS.map(documentContextToken),
  RUNNABLE_TOKEN,
];

/**
 * Build the `contextValue` of a spec tree item so the declarative
 * `view/item/context` menu can show or hide each entry with a `when` clause.
 *
 * The value is a space-joined token list: the `spec` base token, one
 * `doc-<kind>` token per present document, and a `runnable` token when the spec
 * is not malformed. The package.json menu matches these tokens with
 * `viewItem =~ /.../` regular expressions, hiding an action whose document is
 * absent and refusing "Run tasks" on a malformed spec. Being pure and
 * `vscode`-free, the token contract is unit-testable in the core.
 * @param documents The spec's document presence flags.
 * @param status The resolved spec status.
 * @returns The space-joined context-value token list.
 */
export function buildSpecTreeContextValue(documents: ISpecDocuments, status: SpecStatus): string {
  const tokens: string[] = [SPEC_TOKEN];
  CONTEXT_DOCUMENT_KINDS.forEach((kind) => {
    if (documents[kind]) {
      tokens.push(documentContextToken(kind));
    }
  });
  if (SpecStatus.Malformed !== status) {
    tokens.push(RUNNABLE_TOKEN);
  }
  return tokens.join(' ');
}
