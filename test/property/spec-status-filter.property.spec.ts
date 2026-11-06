import { expect } from 'chai';
import * as fc from 'fast-check';

import type { SpecFilterKey } from '../../src/core/model/SpecFilterKey';
import { SpecStatus } from '../../src/core/model/SpecStatus';
import { statusToFilterKey } from '../../src/core/model/SpecFilterKey';
import { SpecStatusFilter } from '../../src/core/status/SpecStatusFilter';

/** Arbitrary over the four filter keys. */
const keyArb = fc.constantFrom<SpecFilterKey>('completed', 'inProgress', 'notStarted', 'malformed');

/** Arbitrary over the lifecycle statuses. */
const statusArb = fc.constantFrom(...Object.values(SpecStatus));

/**
 * Build a filter by replaying a sequence of toggles from an empty filter.
 * @param keys The toggle sequence.
 * @returns The resulting filter.
 */
function replay(keys: readonly SpecFilterKey[]): SpecStatusFilter {
  return keys.reduce((filter, key) => filter.toggle(key), new SpecStatusFilter());
}

/**
 * Property-based specification for {@link SpecStatusFilter}.
 */
describe('SpecStatusFilter (properties)', () => {
  it('accepts every status when empty', () => {
    fc.assert(
      fc.property(statusArb, (status) => {
        expect(new SpecStatusFilter().matches(status)).to.equal(true);
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

  it('a non-empty filter matches a status iff its key is active', () => {
    fc.assert(
      fc.property(fc.array(keyArb, { minLength: 1 }), statusArb, (seed, status) => {
        const filter = replay(seed);
        fc.pre(!filter.isEmpty());
        expect(filter.matches(status)).to.equal(filter.isActive(statusToFilterKey(status)));
      }),
    );
  });

  it('round-trips losslessly through toArray and fromUnknown', () => {
    fc.assert(
      fc.property(fc.array(keyArb), (seed) => {
        const filter = replay(seed);
        const restored = SpecStatusFilter.fromUnknown(filter.toArray());
        (['completed', 'inProgress', 'notStarted', 'malformed'] as SpecFilterKey[]).forEach(
          (key) => {
            expect(restored.isActive(key)).to.equal(filter.isActive(key));
          },
        );
      }),
    );
  });
});
