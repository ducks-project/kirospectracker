import type { ISpecConfig } from './model/ISpecConfig';
import type { SpecDocumentKind } from './model/SpecDocumentKind';
/**
 * One entry-document rule (Strategy as data): when `matches` accepts the config,
 * the spec is entered through `document`.
 */
export interface IEntryDocumentRule {
  /** Tell whether this rule applies to the given config. */
  readonly matches: (config: ISpecConfig) => boolean;
  /** Document the spec is entered through when the rule applies. */
  readonly document: SpecDocumentKind;
}
/**
 * Ordered rules, first match wins: a bugfix spec starts at `bugfix.md`, a
 * design-first one at `design.md`, a requirements-first one at `requirements.md`.
 * The axes are orthogonal, so `specType` outranks `workflowType`. A new rule is
 * one more entry here (open for extension, closed for modification).
 */
export const ENTRY_DOCUMENT_RULES: readonly IEntryDocumentRule[] = [
  { matches: (config) => 'bugfix' === config.specType, document: 'bugfix' },
  { matches: (config) => 'design-first' === config.workflowType, document: 'design' },
  { matches: (config) => 'requirements-first' === config.workflowType, document: 'requirements' },
];
/** Document order tried when no rule applies or the rule's document is absent. */
export const FALLBACK_ENTRY_ORDER: readonly SpecDocumentKind[] = [
  'requirements',
  'design',
  'tasks',
];
