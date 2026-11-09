import { expect } from 'chai';

import { BoundedCache } from '../../src/core/BoundedCache';

/**
 * Behaviour specification for {@link BoundedCache}.
 *
 * The cache is a fixed-capacity, insertion-order store that evicts the oldest
 * entry past its capacity and clamps a non-positive capacity to one.
 */
describe('BoundedCache', () => {
  it('reads back a stored value', () => {
    const cache = new BoundedCache<string, number>(4);
    cache.set('a', 1);
    expect(cache.has('a')).to.equal(true);
    expect(cache.get('a')).to.equal(1);
  });

  it('returns undefined and false for an absent key', () => {
    const cache = new BoundedCache<string, number>(4);
    expect(cache.has('missing')).to.equal(false);
    expect(cache.get('missing')).to.equal(undefined);
  });

  it('evicts the oldest entry once the capacity is exceeded', () => {
    const cache = new BoundedCache<string, number>(2);
    cache.set('a', 1).set('b', 2).set('c', 3);
    expect(cache.has('a')).to.equal(false);
    expect(cache.get('b')).to.equal(2);
    expect(cache.get('c')).to.equal(3);
  });

  it('refreshes recency on re-set so an updated key is not evicted first', () => {
    const cache = new BoundedCache<string, number>(2);
    cache.set('a', 1).set('b', 2).set('a', 10).set('c', 3);
    expect(cache.has('b')).to.equal(false);
    expect(cache.get('a')).to.equal(10);
    expect(cache.get('c')).to.equal(3);
  });

  it('clamps a capacity below one to one', () => {
    const cache = new BoundedCache<string, number>(0);
    cache.set('a', 1).set('b', 2);
    expect(cache.has('a')).to.equal(false);
    expect(cache.get('b')).to.equal(2);
  });

  it('can cache an undefined value without re-probing as absent', () => {
    const cache = new BoundedCache<string, number | undefined>(2);
    cache.set('a', undefined);
    expect(cache.has('a')).to.equal(true);
    expect(cache.get('a')).to.equal(undefined);
  });
});
