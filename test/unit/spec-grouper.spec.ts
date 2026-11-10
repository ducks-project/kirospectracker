import { expect } from 'chai';

import type { ISpecSnapshot } from '../../src/core/model/ISpecSnapshot';
import { SpecStatus } from '../../src/core/model/SpecStatus';
import { SpecGrouper } from '../../src/core/status/SpecGrouper';

/**
 * Build a snapshot carrying the given name and status.
 * @param name Spec name.
 * @param status Spec status.
 * @returns A snapshot fixture.
 */
function snapshotOf(name: string, status: SpecStatus): ISpecSnapshot {
  return {
    name,
    folderPath: `/ws/.kiro/specs/${name}`,
    workspacePath: '/ws',
    documents: { tasks: true, requirements: false, design: false, notes: false, bugfix: false },
    entryDocument: undefined,
    status,
    progress: {
      requiredDone: 0,
      requiredTotal: 0,
      optionalDone: 0,
      optionalTotal: 0,
      requiredRatio: 1,
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
 * Behaviour specification for {@link SpecGrouper}.
 */
describe('SpecGrouper', () => {
  const grouper = new SpecGrouper();

  it('drops empty groups and keeps the display order', () => {
    const groups = grouper.group([
      snapshotOf('b', SpecStatus.InProgress),
      snapshotOf('a', SpecStatus.Malformed),
    ]);
    expect(groups.map((group) => group.status)).to.deep.equal([
      SpecStatus.InProgress,
      SpecStatus.Malformed,
    ]);
  });

  it('sorts specs within a group by name', () => {
    const groups = grouper.group([
      snapshotOf('zeta', SpecStatus.NotStarted),
      snapshotOf('alpha', SpecStatus.NotStarted),
    ]);
    expect(groups[0].specs.map((spec) => spec.name)).to.deep.equal(['alpha', 'zeta']);
  });

  it('returns no group for an empty input', () => {
    expect(grouper.group([])).to.deep.equal([]);
  });
});
/**
 * Group labels come from the injected translator while statuses stay identifiers.
 */
describe('SpecGrouper with a translator', () => {
  const grouper = new SpecGrouper({ t: (key) => ('In progress' === key ? 'En cours' : key) });
  it('translates the label but keeps the status identifier', () => {
    const [group] = grouper.group([snapshotOf('a', SpecStatus.InProgress)]);
    expect(group.label).to.equal('En cours');
    expect(group.status).to.equal(SpecStatus.InProgress);
  });
});
