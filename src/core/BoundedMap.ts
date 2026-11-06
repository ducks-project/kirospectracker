/** Smallest concurrency treated as valid; a lower limit is clamped to it. */
const MINIMUM_CONCURRENCY = 1;

/**
 * Map over `items` with a bounded number of concurrent workers.
 *
 * It preserves input order in the result and runs at most `max(1, limit)`
 * workers at a time through a shared cursor (worker-pool pattern), so a large
 * cold scan never issues every read at once. Pure and `vscode`-free, with no
 * external dependency. An empty input early-returns `[]`; a `limit < 1` is
 * documented to behave as `1`.
 * @typeParam T The input item type.
 * @typeParam R The worker result type.
 * @param items The items to process, consumed in order.
 * @param limit The maximum number of workers running concurrently.
 * @param worker The async mapper invoked once per item with its index.
 * @returns The results in the same order as `items`.
 */
export async function mapWithLimit<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (0 === items.length) {
    return [];
  }
  const results: R[] = new Array<R>(items.length);
  const concurrency = Math.min(Math.max(MINIMUM_CONCURRENCY, limit), items.length);
  let cursor = 0;
  const runNext = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  };
  const pool = Array.from({ length: concurrency }, () => runNext());
  await Promise.all(pool);
  return results;
}
