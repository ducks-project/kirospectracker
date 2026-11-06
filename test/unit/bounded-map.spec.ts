import { expect } from 'chai';

import { mapWithLimit } from '../../src/core/BoundedMap';

/**
 * Behaviour specification for {@link mapWithLimit}.
 */
describe('mapWithLimit', () => {
  it('preserves order, matching a plain ordered map', async () => {
    const items = [1, 2, 3, 4, 5];
    const result = await mapWithLimit(items, 2, async (item) => item * 2);
    expect(result).to.deep.equal(items.map((item) => item * 2));
  });

  it('yields [] for empty input without invoking the worker', async () => {
    let calls = 0;
    const result = await mapWithLimit([], 3, async (item: number) => {
      calls += 1;
      return item;
    });
    expect(result).to.deep.equal([]);
    expect(calls).to.equal(0);
  });

  it('works when the limit exceeds the input length', async () => {
    const items = ['a', 'b'];
    const result = await mapWithLimit(items, 10, async (item) => item.toUpperCase());
    expect(result).to.deep.equal(['A', 'B']);
  });

  it('treats a limit below 1 as 1', async () => {
    const order: number[] = [];
    const items = [1, 2, 3];
    const result = await mapWithLimit(items, 0, async (item) => {
      order.push(item);
      return item;
    });
    expect(result).to.deep.equal(items);
    // A single worker consumes items strictly in order.
    expect(order).to.deep.equal(items);
  });
});
