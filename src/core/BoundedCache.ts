/** Smallest capacity treated as valid; a lower capacity is clamped to it. */
const MINIMUM_CAPACITY = 1;

/**
 * Fixed-capacity insertion-order cache (`vscode`-free, pure data structure).
 *
 * It keeps at most `max(1, capacity)` entries: inserting beyond the capacity
 * evicts the least-recently-set entry, so a large workspace (e.g. 500 specs)
 * can hover many cards without the cache growing unbounded. It is deliberately
 * minimal (no TTL, no async): callers own the value lifecycle and only need
 * {@link get}, {@link has} and {@link set}.
 * @typeParam K The key type.
 * @typeParam V The cached value type.
 */
export class BoundedCache<K, V> {
  private readonly capacity: number;

  private readonly entries: Map<K, V> = new Map<K, V>();

  /**
   * Build a cache bounded to the given capacity.
   * @param capacity The maximum number of entries; a value below one is clamped to one.
   */
  public constructor(capacity: number) {
    this.capacity = Math.max(MINIMUM_CAPACITY, capacity);
  }

  /**
   * Tell whether a key currently holds a cached value.
   * @param key The key to probe.
   * @returns `true` when the key is present.
   */
  public has(key: K): boolean {
    return this.entries.has(key);
  }

  /**
   * Read the value cached for a key.
   * @param key The key to read.
   * @returns The cached value, or `undefined` when the key is absent.
   */
  public get(key: K): V | undefined {
    return this.entries.get(key);
  }

  /**
   * Cache a value, evicting the oldest entry when the capacity is exceeded.
   * @param key The key to store.
   * @param value The value to associate with the key.
   * @returns This cache, for chaining.
   */
  public set(key: K, value: V): this {
    this.entries.delete(key);
    this.entries.set(key, value);
    if (this.entries.size > this.capacity) {
      // Safe assertion: size exceeds capacity (>= 1), so the iterator yields a key.
      const oldest = this.entries.keys().next().value as K;
      this.entries.delete(oldest);
    }
    return this;
  }
}
