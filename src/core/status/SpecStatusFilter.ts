import type { SpecStatus } from '../model/SpecStatus';
import type { SpecFilterKey } from '../model/SpecFilterKey';
import { statusToFilterKey } from '../model/SpecFilterKey';

/**
 * Immutable additive status-filter state machine driving the dashboard's
 * clickable stat toggles.
 *
 * The active filter keys form a set: toggling a key adds it when absent and
 * removes it when present, so the selection is additive and multi-select.
 * Matching is inclusive — a card matches when its status' filter key is active,
 * or when no key is active at all (the "show everything" default). Every
 * mutation returns a new instance, so the value object is safe to persist in the
 * webview state and to reuse across renders. Being pure and `vscode`-free, it is
 * unit- and property-testable without a VS Code host.
 */
export class SpecStatusFilter {
  /** The active filter keys; empty means "no filter, show everything". */
  private readonly activeKeys: ReadonlySet<SpecFilterKey>;

  /**
   * Build a filter over an optional initial set of active keys.
   * @param activeKeys The initially active filter keys (defaults to none).
   */
  public constructor(activeKeys: Iterable<SpecFilterKey> = []) {
    this.activeKeys = new Set<SpecFilterKey>(activeKeys);
  }

  /**
   * Build a filter from an unknown, untrusted list of keys, keeping only the
   * values that are valid {@link SpecFilterKey}s.
   *
   * This is the safe entry point for a set restored from persisted webview
   * state, which must never be trusted to be well-formed.
   * @param keys The candidate keys, possibly containing invalid values.
   * @returns A filter holding only the recognised keys.
   */
  public static fromUnknown(keys: readonly unknown[]): SpecStatusFilter {
    const valid = keys.filter((key): key is SpecFilterKey => SpecStatusFilter.isFilterKey(key));
    return new SpecStatusFilter(valid);
  }

  /**
   * Toggle a filter key: remove it when active, add it otherwise.
   * @param key The filter key to toggle.
   * @returns A new filter reflecting the toggle.
   */
  public toggle(key: SpecFilterKey): SpecStatusFilter {
    const next = new Set<SpecFilterKey>(this.activeKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    return new SpecStatusFilter(next);
  }

  /**
   * Whether a filter key is currently active (pressed).
   * @param key The filter key to test.
   * @returns `true` when the key is active.
   */
  public isActive(key: SpecFilterKey): boolean {
    return this.activeKeys.has(key);
  }

  /**
   * Whether no filter is active, i.e. every card is shown.
   * @returns `true` when the active set is empty.
   */
  public isEmpty(): boolean {
    return 0 === this.activeKeys.size;
  }

  /**
   * Whether a status passes the current filter.
   *
   * An empty filter accepts every status; otherwise the status passes only when
   * its filter key is active.
   * @param status The resolved spec status.
   * @returns `true` when the status is visible under the active filter.
   */
  public matches(status: SpecStatus): boolean {
    if (this.isEmpty()) {
      return true;
    }
    return this.activeKeys.has(statusToFilterKey(status));
  }

  /**
   * The active keys as a plain, serializable array (stable order not guaranteed).
   *
   * Used to persist the filter in the webview state across re-renders.
   * @returns The active filter keys.
   */
  public toArray(): readonly SpecFilterKey[] {
    return [...this.activeKeys];
  }

  /**
   * Whether an unknown value is a valid {@link SpecFilterKey}.
   * @param key The candidate value.
   * @returns `true` when the value is a recognised filter key.
   */
  private static isFilterKey(key: unknown): key is SpecFilterKey {
    return (
      'completed' === key || 'inProgress' === key || 'notStarted' === key || 'malformed' === key
    );
  }
}
