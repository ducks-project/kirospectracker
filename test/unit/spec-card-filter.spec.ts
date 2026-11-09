import { expect } from 'chai';

import type { ISpecCardView } from '../../src/core/model/ISpecCardView';
import { SpecStatus } from '../../src/core/model/SpecStatus';
import { SpecCardFilter } from '../../src/core/status/SpecCardFilter';
import { SpecStatusFilter } from '../../src/core/status/SpecStatusFilter';

/**
 * Build a minimal card view carrying the fields the filter inspects.
 * @param name The spec name.
 * @param status The spec status.
 * @returns A card view fixture.
 */
function cardOf(name: string, status: SpecStatus): ISpecCardView {
  return {
    name,
    folderPath: `/ws/.kiro/specs/${name}`,
    ownerLabel: 'ws',
    documents: { tasks: true, requirements: false, design: false, notes: false },
    status,
    progress: {
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
    },
  };
}

const cards: readonly ISpecCardView[] = [
  cardOf('alpha', SpecStatus.Completed),
  cardOf('alphabet', SpecStatus.InProgress),
  cardOf('beta', SpecStatus.Malformed),
];

/**
 * Behaviour specification for {@link SpecCardFilter}.
 */
describe('SpecCardFilter', () => {
  it('keeps every card when no filter and no query apply', () => {
    const filter = new SpecCardFilter(new SpecStatusFilter(), '');
    expect(filter.apply(cards)).to.have.length(3);
  });

  it('applies the status filter alone', () => {
    const filter = new SpecCardFilter(new SpecStatusFilter().toggle('completed'), '');
    const visible = filter.apply(cards).map((card) => card.name);
    expect(visible).to.deep.equal(['alpha']);
  });

  it('applies the search query alone (case-insensitive substring)', () => {
    const filter = new SpecCardFilter(new SpecStatusFilter(), 'ALPHA');
    const visible = filter.apply(cards).map((card) => card.name);
    expect(visible).to.deep.equal(['alpha', 'alphabet']);
  });

  it('composes the status filter AND the search query', () => {
    const statusFilter = new SpecStatusFilter().toggle('inProgress');
    const filter = new SpecCardFilter(statusFilter, 'alpha');
    const visible = filter.apply(cards).map((card) => card.name);
    expect(visible).to.deep.equal(['alphabet']);
  });

  it('preserves input order', () => {
    const filter = new SpecCardFilter(new SpecStatusFilter(), 'a');
    const visible = filter.apply(cards).map((card) => card.name);
    expect(visible).to.deep.equal(['alpha', 'alphabet', 'beta']);
  });
});
