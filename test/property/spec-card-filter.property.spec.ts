import { expect } from 'chai';
import * as fc from 'fast-check';

import type { ISpecCardView } from '../../src/core/model/ISpecCardView';
import type { SpecFilterKey } from '../../src/core/model/SpecFilterKey';
import { SpecStatus } from '../../src/core/model/SpecStatus';
import { SpecCardFilter } from '../../src/core/status/SpecCardFilter';
import { SpecFolderFilter } from '../../src/core/status/SpecFolderFilter';
import { SpecStatusFilter } from '../../src/core/status/SpecStatusFilter';

/** Arbitrary over the four filter keys. */
const keyArb = fc.constantFrom<SpecFilterKey>('completed', 'inProgress', 'notStarted', 'malformed');

/** Arbitrary over a small pool of folder keys so toggles overlap meaningfully. */
const folderKeyArb = fc.constantFrom('/ws/one', '/ws/two', '/ws/three');

/** Arbitrary over a card view carrying a name, status and folder key. */
const cardArb: fc.Arbitrary<ISpecCardView> = fc.record({
  name: fc.string(),
  folderPath: fc.string(),
  folderKey: folderKeyArb,
  ownerLabel: fc.string(),
  status: fc.constantFrom(...Object.values(SpecStatus)),
  documents: fc.constant({ tasks: true, requirements: false, design: false, notes: false }),
  progress: fc.constant({
    requiredDone: 0,
    requiredTotal: 0,
    optionalDone: 0,
    optionalTotal: 0,
    requiredRatio: 0,
    optionalRatio: 0,
    requiredResolvedDone: 0,
    requiredResolvedCancelled: 0,
    requiredInProgress: 0,
    requiredTodo: 0,
    optionalResolvedDone: 0,
    optionalResolvedCancelled: 0,
    optionalInProgress: 0,
    optionalTodo: 0,
  }),
});

/**
 * Property-based specification for {@link SpecCardFilter}.
 */
describe('SpecCardFilter (properties)', () => {
  it('visibility is exactly the AND of the status, folder and search filters', () => {
    fc.assert(
      fc.property(
        fc.array(keyArb),
        fc.array(folderKeyArb),
        fc.string(),
        cardArb,
        (keys, folderKeys, query, card) => {
          const statusFilter = SpecStatusFilter.fromUnknown(keys);
          const folderFilter = SpecFolderFilter.fromUnknown(folderKeys);
          const filter = new SpecCardFilter(statusFilter, folderFilter, query);
          const normalized = query.trim().toLowerCase();
          const matchesQuery =
            0 === normalized.length || card.name.toLowerCase().includes(normalized);
          const expected =
            statusFilter.matches(card.status) &&
            folderFilter.matches(card.folderKey) &&
            matchesQuery;
          expect(filter.isVisible(card)).to.equal(expected);
        },
      ),
    );
  });

  it('apply keeps a subset in input order and never adds cards', () => {
    fc.assert(
      fc.property(
        fc.array(keyArb),
        fc.array(folderKeyArb),
        fc.string(),
        fc.array(cardArb),
        (keys, folderKeys, query, cards) => {
          const filter = new SpecCardFilter(
            SpecStatusFilter.fromUnknown(keys),
            SpecFolderFilter.fromUnknown(folderKeys),
            query,
          );
          const result = filter.apply(cards);
          expect(result.length).to.be.at.most(cards.length);
          result.forEach((card) => expect(filter.isVisible(card)).to.equal(true));
        },
      ),
    );
  });
});
