import { expect } from 'chai';

import type { ISpecCardView } from '../../src/core/model/ISpecCardView';
import { SpecStatus } from '../../src/core/model/SpecStatus';
import { SpecFolderFilter } from '../../src/core/status/SpecFolderFilter';
import { SpecFolderToggleView } from '../../src/core/status/SpecFolderToggleView';

const view = new SpecFolderToggleView();

/**
 * Build a minimal card view carrying the fields the mapper inspects.
 * @param name The spec name.
 * @param folderKey The stable owning-folder key.
 * @param ownerLabel The display label for that folder.
 * @returns A card view fixture.
 */
function cardOf(name: string, folderKey: string, ownerLabel: string): ISpecCardView {
  return {
    name,
    folderPath: `${folderKey}/.kiro/specs/${name}`,
    folderKey,
    ownerLabel,
    documents: { tasks: true, requirements: false, design: false, notes: false, bugfix: false },
    entryDocument: undefined,
    status: SpecStatus.InProgress,
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
  cardOf('a', '/ws/one', 'one'),
  cardOf('b', '/ws/one', 'one'),
  cardOf('c', '/ws/two', 'two'),
];

/**
 * Behaviour specification for {@link SpecFolderToggleView}.
 */
describe('SpecFolderToggleView', () => {
  it('projects one menu item per distinct folder with its label and count', () => {
    const items = view.build(cards, new SpecFolderFilter());
    expect(items.map((item) => item.key)).to.deep.equal(['/ws/one', '/ws/two']);
    expect(items.map((item) => item.label)).to.deep.equal(['one', 'two']);
    expect(items.map((item) => item.count)).to.deep.equal([2, 1]);
  });

  it('reflects the pressed state of the active folder filter', () => {
    const filter = new SpecFolderFilter().toggle('/ws/two');
    const items = view.build(cards, filter);
    const byKey = new Map(items.map((item) => [item.key, item.pressed]));
    expect(byKey.get('/ws/one')).to.equal(false);
    expect(byKey.get('/ws/two')).to.equal(true);
  });

  it('is empty for an empty card list', () => {
    expect(view.build([], new SpecFolderFilter())).to.deep.equal([]);
  });
});
