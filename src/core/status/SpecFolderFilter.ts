/**
 * Immutable additive folder-filter state machine driving the dashboard's
 * folder-scoped filtering (the search-box folder menu and the clickable card
 * folder label).
 *
 * The active folder keys form a set: toggling a key adds it when absent and
 * removes it when present, so the selection is additive and multi-select.
 * Matching is inclusive — a card matches when its folder key is active, or when
 * no key is active at all (the "show every folder" default). Every mutation
 * returns a new instance, so the value object is safe to persist in the webview
 * state and to reuse across renders. It mirrors {@link SpecStatusFilter} on
 * purpose (DRY): the folder KEY is the spec's stable owning-folder identity (its
 * workspace folder path), not the human label, so two folders sharing a basename
 * stay distinct. Being pure and `vscode`-free, it is unit- and property-testable
 * without a VS Code host.
 */
export class SpecFolderFilter {
  /** The active folder keys; empty means "no filter, show every folder". */
  private readonly activeKeys: ReadonlySet<string>;

  /**
   * Build a filter over an optional initial set of active folder keys.
   * @param activeKeys The initially active folder keys (defaults to none).
   */
  public constructor(activeKeys: Iterable<string> = []) {
    this.activeKeys = new Set<string>(activeKeys);
  }

  /**
   * Build a filter from an unknown, untrusted list of keys, keeping only the
   * non-empty strings.
   *
   * This is the safe entry point for a set restored from persisted webview
   * state, which must never be trusted to be well-formed: a tampered set cannot
   * inject a non-string (or empty) folder key.
   * @param keys The candidate keys, possibly containing invalid values.
   * @returns A filter holding only the recognised folder keys.
   */
  public static fromUnknown(keys: readonly unknown[]): SpecFolderFilter {
    const valid = keys.filter((key): key is string => SpecFolderFilter.isFolderKey(key));
    return new SpecFolderFilter(valid);
  }

  /**
   * Toggle a folder key: remove it when active, add it otherwise.
   * @param key The folder key to toggle.
   * @returns A new filter reflecting the toggle.
   */
  public toggle(key: string): SpecFolderFilter {
    const next = new Set<string>(this.activeKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    return new SpecFolderFilter(next);
  }

  /**
   * Whether a folder key is currently active (pressed).
   * @param key The folder key to test.
   * @returns `true` when the key is active.
   */
  public isActive(key: string): boolean {
    return this.activeKeys.has(key);
  }

  /**
   * Whether no folder filter is active, i.e. every folder is shown.
   * @returns `true` when the active set is empty.
   */
  public isEmpty(): boolean {
    return 0 === this.activeKeys.size;
  }

  /**
   * Whether a folder key passes the current filter.
   *
   * An empty filter accepts every folder; otherwise the key passes only when it
   * is active.
   * @param key The spec's owning-folder key.
   * @returns `true` when the folder is visible under the active filter.
   */
  public matches(key: string): boolean {
    if (this.isEmpty()) {
      return true;
    }
    return this.activeKeys.has(key);
  }

  /**
   * The active keys as a plain, serializable array (stable order not guaranteed).
   *
   * Used to persist the filter in the webview state across re-renders.
   * @returns The active folder keys.
   */
  public toArray(): readonly string[] {
    return [...this.activeKeys];
  }

  /**
   * Whether an unknown value is a usable folder key (a non-empty string).
   * @param key The candidate value.
   * @returns `true` when the value is a non-empty string.
   */
  private static isFolderKey(key: unknown): key is string {
    return 'string' === typeof key && 0 < key.length;
  }
}
