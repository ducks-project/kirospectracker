import { expect } from 'chai';

import type { ITaskItem } from '../../src/core/model/ITaskItem';
import type { TaskState } from '../../src/core/model/TaskState';
import { GlobalTaskStatsCalculator } from '../../src/core/status/GlobalTaskStatsCalculator';

/**
 * Build a leaf task carrying a state.
 * @param id Task identifier.
 * @param state The task's lifecycle state.
 * @returns A leaf {@link ITaskItem}.
 */
function leaf(id: string, state: TaskState): ITaskItem {
  return { id, title: id, state, optional: false, children: [], requirements: [] };
}

/**
 * Behaviour specification for {@link GlobalTaskStatsCalculator}.
 */
describe('GlobalTaskStatsCalculator', () => {
  const calculator = new GlobalTaskStatsCalculator();

  it('aggregates leaf counts across multiple specs', () => {
    const stats = calculator.calculate([
      [leaf('1', 'done'), leaf('2', 'todo')],
      [leaf('1', 'cancelled'), leaf('2', 'inProgress'), leaf('3', 'done')],
    ]);
    expect(stats.done).to.equal(2);
    expect(stats.cancelled).to.equal(1);
    expect(stats.inProgress).to.equal(1);
    expect(stats.todo).to.equal(1);
    expect(stats.total).to.equal(5);
  });

  it('counts only leaves, never the parent of a subtree', () => {
    const parent: ITaskItem = {
      id: '1',
      title: '1',
      state: 'done',
      optional: false,
      requirements: [],
      children: [leaf('1.1', 'done'), leaf('1.2', 'todo')],
    };
    const stats = calculator.calculate([[parent]]);
    expect(stats.total).to.equal(2);
    expect(stats.done).to.equal(1);
    expect(stats.todo).to.equal(1);
  });

  it('counts cancelled tasks as resolved in percentComplete', () => {
    const stats = calculator.calculate([[leaf('1', 'cancelled'), leaf('2', 'cancelled')]]);
    expect(stats.percentComplete).to.equal(1);
  });

  it('mixes done and cancelled into the resolved percentage', () => {
    const stats = calculator.calculate([
      [leaf('1', 'done'), leaf('2', 'cancelled'), leaf('3', 'todo'), leaf('4', 'inProgress')],
    ]);
    expect(stats.percentComplete).to.equal(0.5);
  });

  it('yields all-zero stats and a 0 percentage for an empty corpus', () => {
    const stats = calculator.calculate([]);
    expect(stats).to.deep.equal({
      done: 0,
      cancelled: 0,
      inProgress: 0,
      todo: 0,
      total: 0,
      percentComplete: 0,
    });
  });
});
