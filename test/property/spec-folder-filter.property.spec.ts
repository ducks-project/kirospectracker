import { expect } from 'chai';
import * as fc from 'fast-check';

import { SpecFolderFilter } from '../../src/core/status/SpecFolderFilter';

/** Arbitrary over a small pool of folder keys so toggles overlap meaningfully. */
const keyArb = fc.constantFrom('/ws/one', '/ws/two', '/ws/three', '/a/project', '/b/project');

/**
 * Build a filter by replaying a sequence of toggles from an empty filter.
 * @param keys The toggle sequence.
 * @returns The resulting filter.
 */
function replay(keys: readonly string[]): SpecFolderFilter {
  return keys.reduce((filter, key) => filter.toggle(key), new SpecFolderFilter());
}

/**
 * Property-based specification for {@link SpecFolderFilter}.
 */
describe('SpecFolderFilter (properties)', () => {
  it('accepts every folder when empty', () => {
    fc.assert(
      fc.property(keyArb, (key) => {
        expect(new SpecFolderFilter().matches(key)).to.equal(true);
      }),
    );
  });

  it('toggling the same key twice is identity on membership', () => {
    fc.assert(
      fc.property(fc.array(keyArb), keyArb, (seed, key) => {
        const base = replay(seed);
        const twice = base.toggle(key).toggle(key);
        expect(twice.isActive(key)).to.equal(base.isActive(key));
      }),
    );
  });

  it('a non-empty filter matches a key iff it is active', () => {
    fc.assert(
      fc.property(fc.array(keyArb, { minLength: 1 }), keyArb, (seed, key) => {
        const filter = replay(seed);
        fc.pre(!filter.isEmpty());
        expect(filter.matches(key)).to.equal(filter.isActive(key));
      }),
    );
  });

  it('round-trips losslessly through toArray and fromUnknown', () => {
    fc.assert(
      fc.property(fc.array(keyArb), (seed) => {
        const filter = replay(seed);
        const restored = SpecFolderFilter.fromUnknown(filter.toArray());
        [...filter.toArray(), '/ws/one', '/b/project'].forEach((key) => {
          expect(restored.isActive(key)).to.equal(filter.isActive(key));
        });
      }),
    );
  });
});
