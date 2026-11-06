import type { ISpecCardView } from '../model/ISpecCardView';
import type { SpecStatusFilter } from './SpecStatusFilter';

/**
 * Pure composition of the status filter and the free-text search applied to the
 * dashboard cards.
 *
 * A card is visible when it passes BOTH the active status filter and the search
 * query (case-insensitive substring match on the spec name). The two criteria
 * are independent and composed with a logical AND, matching the dashboard
 * requirement that the status toggles and the search box narrow the list
 * together. Being `vscode`- and DOM-free, it is unit- and property-testable in
 * the core; the webview only applies the decision.
 */
export class SpecCardFilter {
  /** The active additive status filter. */
  private readonly statusFilter: SpecStatusFilter;

  /** The normalized (trimmed, lower-cased) search query. */
  private readonly normalizedQuery: string;

  /**
   * Build a card filter over a status filter and a raw search query.
   * @param statusFilter The active additive status filter.
   * @param query The raw search query (trimmed and lower-cased internally).
   */
  public constructor(statusFilter: SpecStatusFilter, query: string) {
    this.statusFilter = statusFilter;
    this.normalizedQuery = query.trim().toLowerCase();
  }

  /**
   * Whether a single card is visible under both criteria.
   * @param card The card view to test.
   * @returns `true` when the card passes the status filter and the search.
   */
  public isVisible(card: ISpecCardView): boolean {
    return this.statusFilter.matches(card.status) && this.matchesQuery(card);
  }

  /**
   * Keep only the visible cards, preserving their input order.
   * @param cards The card views to filter.
   * @returns The visible cards in the same order.
   */
  public apply(cards: readonly ISpecCardView[]): readonly ISpecCardView[] {
    return cards.filter((card) => this.isVisible(card));
  }

  /**
   * Whether a card's name matches the search query.
   * @param card The card view to test.
   * @returns `true` when the query is empty or a substring of the name.
   */
  private matchesQuery(card: ISpecCardView): boolean {
    if (0 === this.normalizedQuery.length) {
      return true;
    }
    return card.name.toLowerCase().includes(this.normalizedQuery);
  }
}
