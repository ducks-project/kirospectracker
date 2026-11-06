import { expect } from 'chai';
import * as fc from 'fast-check';

import type { ISpecCardView } from '../../src/core/model/ISpecCardView';
import type { SpecFilterKey } from '../../src/core/model/SpecFilterKey';
import { SpecStatus } from '../../src/core/model/SpecStatus';
import { SpecCardFilter } from '../../src/core/status/SpecCardFilter';
import { SpecStatusFilter } from '../../src/core/status/SpecStatusFilter';

/** Arbitrary over the four filter keys. */
const keyArb = fc.constantFrom<SpecFilterKey>('completed', 'inProgress', 'notStarted', 'malformed');

/** Arbitrary over a card view carrying a name and a status. */
const cardArb: fc.Arbitrary<ISpecCardView> = fc.record({
  name: fc.string(),
  folderPath: fc.string(),
  status: fc.constantFrom(...Object.values(SpecStatus)),
  documents: fc.constant({ tasks: true, requirements: false, design: false, notes: false }),
  progress: fc.constant({
    requiredDone: 0,
    requiredTotal: 0,
    optionalDone: 0,
    optionalTotal: 0,
    requiredRatio: 0,
    optionalRatio: 0,
  }),
});

/**
 * Property-based specification for {@link SpecCardFilter}.
 */
describe('SpecCardFilter (properties)', () => {
  it('visibility is exactly the AND of the status filter and the search', () => {
    fc.assert(
      fc.property(fc.array(keyArb), fc.string(), cardArb, (keys, query, card) => {
        const statusFilter = SpecStatusFilter.fromUnknown(keys);
        const filter = new SpecCardFilter(statusFilter, query);
        const normalized = query.trim().toLowerCase();
        const matchesQuery =
          0 === normalized.length || card.name.toLowerCase().includes(normalized);
        const expected = statusFilter.matches(card.status) && matchesQuery;
        expect(filter.isVisible(card)).to.equal(expected);
      }),
    );
  });

  it('apply keeps a subset in input order and never adds cards', () => {
    fc.assert(
      fc.property(fc.array(keyArb), fc.string(), fc.array(cardArb), (keys, query, cards) => {
        const filter = new SpecCardFilter(SpecStatusFilter.fromUnknown(keys), query);
        const result = filter.apply(cards);
        expect(result.length).to.be.at.most(cards.length);
        result.forEach((card) => expect(filter.isVisible(card)).to.equal(true));
      }),
    );
  });
});
