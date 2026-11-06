import { expect } from 'chai';
import * as fc from 'fast-check';

import { mapWithLimit } from '../../src/core/BoundedMap';

/** Smallest concurrency the iterator is allowed to run at. */
const MINIMUM_CONCURRENCY = 1;

/**
 * Sequentially map `items` with the same worker, preserving order.
 * @param items The input items.
 * @param worker The async mapper.
 * @returns The ordered results.
 */
async function sequentialMap<T, R>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await worker(items[index], index));
  }
  return results;
}

/**
 * Property-based specification for {@link mapWithLimit}.
 */
describe('mapWithLimit (properties)', () => {
  it('equals the sequential ordered map for arbitrary arrays and limits', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer()),
        fc.integer({ min: -2, max: 8 }),
        async (items, limit) => {
          const worker = async (item: number, index: number): Promise<number> => item + index;
          const bounded = await mapWithLimit(items, limit, worker);
          const sequential = await sequentialMap(items, worker);
          expect(bounded).to.deep.equal(sequential);
        },
      ),
    );
  });

  it('never runs more than max(1, limit) workers concurrently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer()),
        fc.integer({ min: -2, max: 8 }),
        async (items, limit) => {
          let active = 0;
          let peak = 0;
          const worker = async (item: number): Promise<number> => {
            active += 1;
            peak = Math.max(peak, active);
            await Promise.resolve();
            active -= 1;
            return item;
          };
          await mapWithLimit(items, limit, worker);
          expect(peak).to.be.at.most(Math.max(MINIMUM_CONCURRENCY, limit));
        },
      ),
    );
  });
});
