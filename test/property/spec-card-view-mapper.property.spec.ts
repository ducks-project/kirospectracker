import { expect } from 'chai';
import * as fc from 'fast-check';

import type { ISpecSnapshot } from '../../src/core/model/ISpecSnapshot';
import { SpecStatus } from '../../src/core/model/SpecStatus';
import { SpecCardViewMapper } from '../../src/core/status/SpecCardViewMapper';

const mapper = new SpecCardViewMapper();

/** Arbitrary over the lifecycle statuses. */
const statusArb = fc.constantFrom(...Object.values(SpecStatus));

/** Arbitrary over the progress record. */
const progressArb = fc.record({
  requiredDone: fc.nat(),
  requiredTotal: fc.nat(),
  optionalDone: fc.nat(),
  optionalTotal: fc.nat(),
  requiredRatio: fc.double({ min: 0, max: 1, noNaN: true }),
  optionalRatio: fc.double({ min: 0, max: 1, noNaN: true }),
});

/** Arbitrary over a full snapshot. */
const snapshotArb: fc.Arbitrary<ISpecSnapshot> = fc.record({
  name: fc.string(),
  folderPath: fc.string(),
  workspacePath: fc.string(),
  documents: fc.record({
    tasks: fc.boolean(),
    requirements: fc.boolean(),
    design: fc.boolean(),
    notes: fc.boolean(),
  }),
  status: statusArb,
  progress: progressArb,
});

/**
 * Property-based specification for {@link SpecCardViewMapper}.
 */
describe('SpecCardViewMapper (properties)', () => {
  it('never throws and preserves status and progress exactly', () => {
    fc.assert(
      fc.property(snapshotArb, (snapshot) => {
        const card = mapper.map(snapshot);
        expect(card.status).to.equal(snapshot.status);
        expect(card.progress).to.deep.equal(snapshot.progress);
      }),
    );
  });
});
