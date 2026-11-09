import { expect } from 'chai';

import type { ISpecSnapshot } from '../../src/core/model/ISpecSnapshot';
import { SpecStatus } from '../../src/core/model/SpecStatus';
import { SpecStatsCalculator } from '../../src/core/status/SpecStatsCalculator';

/**
 * Build a minimal snapshot carrying only the status under test.
 * @param status The status to assign.
 * @returns A snapshot fixture.
 */
function snapshotOf(status: SpecStatus): ISpecSnapshot {
  return {
    name: status,
    folderPath: `/ws/.kiro/specs/${status}`,
    workspacePath: '/ws',
    documents: { tasks: true, requirements: true, design: true, notes: false },
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
 * Behaviour specification for {@link SpecStatsCalculator}.
 */
describe('SpecStatsCalculator', () => {
  const calculator = new SpecStatsCalculator();

  it('counts Completed and FullyCompleted together as completed', () => {
    const stats = calculator.calculate([
      snapshotOf(SpecStatus.Completed),
      snapshotOf(SpecStatus.FullyCompleted),
    ]);
    expect(stats.completed).to.equal(2);
  });

  it('counts each remaining status separately', () => {
    const stats = calculator.calculate([
      snapshotOf(SpecStatus.InProgress),
      snapshotOf(SpecStatus.NotStarted),
      snapshotOf(SpecStatus.Malformed),
    ]);
    expect(stats.inProgress).to.equal(1);
    expect(stats.notStarted).to.equal(1);
    expect(stats.malformed).to.equal(1);
    expect(stats.total).to.equal(3);
  });

  it('returns all-zero counts for an empty list', () => {
    const stats = calculator.calculate([]);
    expect(stats).to.deep.equal({
      total: 0,
      completed: 0,
      inProgress: 0,
      notStarted: 0,
      malformed: 0,
    });
  });
});
