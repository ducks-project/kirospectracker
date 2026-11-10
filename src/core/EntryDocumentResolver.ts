import type { IEntryDocumentRule } from './EntryDocumentRules';
import type { ISpecConfig } from './model/ISpecConfig';
import type { ISpecDocuments } from './model/ISpecDocuments';
import type { SpecDocumentKind } from './model/SpecDocumentKind';
import { ENTRY_DOCUMENT_RULES, FALLBACK_ENTRY_ORDER } from './EntryDocumentRules';
/**
 * Pure resolver of the document a spec is entered through (card click and hover).
 *
 * Strategy pattern over a data table: the first matching rule decides; when no
 * rule matches (absent, unreadable or unknown config) or the rule's document is
 * not on disk, the first present document of the fallback order is used. When
 * nothing is present the result is `undefined` (the card is not clickable).
 */
export class EntryDocumentResolver {
  private readonly rules: readonly IEntryDocumentRule[];
  private readonly fallback: readonly SpecDocumentKind[];
  /**
   * Build a resolver, injecting the rules for tests or future extension.
   * @param rules Ordered rules, first match wins.
   * @param fallback Ordered fallback documents.
   */
  public constructor(
    rules: readonly IEntryDocumentRule[] = ENTRY_DOCUMENT_RULES,
    fallback: readonly SpecDocumentKind[] = FALLBACK_ENTRY_ORDER,
  ) {
    this.rules = rules;
    this.fallback = fallback;
  }
  /**
   * Resolve the entry document of a spec.
   * @param config The tolerant spec config.
   * @param documents Presence flags of the spec's documents.
   * @returns The entry document, or `undefined` when none is available.
   */
  public resolve(config: ISpecConfig, documents: ISpecDocuments): SpecDocumentKind | undefined {
    const rule = this.rules.find((candidate) => candidate.matches(config));
    if (undefined !== rule && documents[rule.document]) {
      return rule.document;
    }
    return this.fallback.find((kind) => documents[kind]);
  }
}
