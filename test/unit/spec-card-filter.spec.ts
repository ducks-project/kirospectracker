import { expect } from 'chai';

import type { ISpecCardView } from '../../src/core/model/ISpecCardView';
import { SpecStatus } from '../../src/core/model/SpecStatus';
import { SpecCardFilter } from '../../src/core/status/SpecCardFilter';
import { SpecFolderFilter } from '../../src/core/status/SpecFolderFilter';
import { SpecStatusFilter } from '../../src/core/status/SpecStatusFilter';

/**
 * Build a minimal card view carrying the fields the filter inspects.
 * @param name The spec name.
 * @param status The spec status.
 * @param folderKey The owning-folder key (defaults to a single shared folder).
 * @returns A card view fixture.
 */
function cardOf(name: string, status: SpecStatus, folderKey = '/ws'): ISpecCardView {
  return {
    name,
    folderPath: `${folderKey}/.kiro/specs/${name}`,
    folderKey,
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
  cardOf('alpha', SpecStatus.Completed, '/ws/one'),
  cardOf('alphabet', SpecStatus.InProgress, '/ws/one'),
  cardOf('beta', SpecStatus.Malformed, '/ws/two'),
];

/** Empty folder filter used by the status/search-only cases. */
const noFolders = new SpecFolderFilter();

/**
 * Behaviour specification for {@link SpecCardFilter}.
 */
describe('SpecCardFilter', () => {
  it('keeps every card when no filter and no query apply', () => {
    const filter = new SpecCardFilter(new SpecStatusFilter(), noFolders, '');
    expect(filter.apply(cards)).to.have.length(3);
  });

  it('applies the status filter alone', () => {
    const filter = new SpecCardFilter(new SpecStatusFilter().toggle('completed'), noFolders, '');
    const visible = filter.apply(cards).map((card) => card.name);
    expect(visible).to.deep.equal(['alpha']);
  });

  it('applies the search query alone (case-insensitive substring)', () => {
    const filter = new SpecCardFilter(new SpecStatusFilter(), noFolders, 'ALPHA');
    const visible = filter.apply(cards).map((card) => card.name);
    expect(visible).to.deep.equal(['alpha', 'alphabet']);
  });

  it('applies the folder filter alone (keyed on the stable folder identity)', () => {
    const filter = new SpecCardFilter(
      new SpecStatusFilter(),
      new SpecFolderFilter().toggle('/ws/two'),
      '',
    );
    const visible = filter.apply(cards).map((card) => card.name);
    expect(visible).to.deep.equal(['beta']);
  });

  it('composes the status filter AND the search query', () => {
    const statusFilter = new SpecStatusFilter().toggle('inProgress');
    const filter = new SpecCardFilter(statusFilter, noFolders, 'alpha');
    const visible = filter.apply(cards).map((card) => card.name);
    expect(visible).to.deep.equal(['alphabet']);
  });

  it('composes status AND folder AND search (exact intersection)', () => {
    const statusFilter = new SpecStatusFilter().toggle('completed').toggle('inProgress');
    const folderFilter = new SpecFolderFilter().toggle('/ws/one');
    const filter = new SpecCardFilter(statusFilter, folderFilter, 'alpha');
    const visible = filter.apply(cards).map((card) => card.name);
    expect(visible).to.deep.equal(['alpha', 'alphabet']);
  });

  it('preserves input order', () => {
    const filter = new SpecCardFilter(new SpecStatusFilter(), noFolders, 'a');
    const visible = filter.apply(cards).map((card) => card.name);
    expect(visible).to.deep.equal(['alpha', 'alphabet', 'beta']);
  });
});
