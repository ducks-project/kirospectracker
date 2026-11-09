import { expect } from 'chai';

import type { ISpecCardView } from '../../src/core/model/ISpecCardView';
import { SpecStatus } from '../../src/core/model/SpecStatus';
import { computeFolderOptions } from '../../src/core/status/SpecFolderOptions';

/**
 * Build a minimal card view carrying the fields the helper inspects.
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
    documents: { tasks: true, requirements: false, design: false, notes: false },
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

/**
 * Behaviour specification for {@link computeFolderOptions}.
 */
describe('computeFolderOptions', () => {
  it('returns no option for an empty card list', () => {
    expect(computeFolderOptions([])).to.deep.equal([]);
  });

  it('dedups by folder key and counts the specs per folder', () => {
    const options = computeFolderOptions([
      cardOf('a', '/ws/one', 'one'),
      cardOf('b', '/ws/one', 'one'),
      cardOf('c', '/ws/two', 'two'),
    ]);
    expect(options).to.deep.equal([
      { key: '/ws/one', label: 'one', count: 2 },
      { key: '/ws/two', label: 'two', count: 1 },
    ]);
  });

  it('keeps two folders sharing a basename distinct (keyed on the path)', () => {
    const options = computeFolderOptions([
      cardOf('a', '/a/project', 'project'),
      cardOf('b', '/b/project', 'project'),
    ]);
    expect(options).to.have.length(2);
    expect(options.map((option) => option.key)).to.deep.equal(['/a/project', '/b/project']);
    expect(options.every((option) => 'project' === option.label)).to.equal(true);
  });

  it('sorts deterministically by label then key', () => {
    const options = computeFolderOptions([
      cardOf('a', '/z', 'zeta'),
      cardOf('b', '/a', 'alpha'),
      cardOf('c', '/m', 'mu'),
    ]);
    expect(options.map((option) => option.label)).to.deep.equal(['alpha', 'mu', 'zeta']);
  });
});
