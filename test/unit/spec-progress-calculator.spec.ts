import { expect } from 'chai';

import type { ITaskItem } from '../../src/core/model/ITaskItem';
import type { TaskState } from '../../src/core/model/TaskState';
import { SpecProgressCalculator } from '../../src/core/status/SpecProgressCalculator';

/**
 * Build a leaf task for the calculator fixtures.
 * @param id Task identifier.
 * @param state The task's lifecycle state.
 * @param optional Whether the task is optional.
 * @returns A leaf {@link ITaskItem}.
 */
function leaf(id: string, state: TaskState, optional: boolean): ITaskItem {
  return { id, title: id, state, optional, children: [], requirements: [] };
}

/**
 * Behaviour specification for {@link SpecProgressCalculator}.
 */
describe('SpecProgressCalculator', () => {
  const calculator = new SpecProgressCalculator();

  it('counts only leaves, never the parent of a subtree', () => {
    const parent: ITaskItem = {
      id: '1',
      title: '1',
      state: 'done',
      optional: false,
      requirements: [],
      children: [leaf('1.1', 'done', false), leaf('1.2', 'todo', false)],
    };
    const progress = calculator.calculate([parent]);
    expect(progress.requiredTotal).to.equal(2);
    expect(progress.requiredDone).to.equal(1);
  });

  it('splits leaves into required (no *) and optional (*) sets', () => {
    const progress = calculator.calculate([
      leaf('1', 'done', false),
      leaf('2', 'todo', false),
      leaf('3', 'done', true),
    ]);
    expect(progress.requiredTotal).to.equal(2);
    expect(progress.requiredDone).to.equal(1);
    expect(progress.optionalTotal).to.equal(1);
    expect(progress.optionalDone).to.equal(1);
  });

  it('treats the required ratio as 100 % when there is no required task', () => {
    const progress = calculator.calculate([leaf('1', 'todo', true)]);
    expect(progress.requiredTotal).to.equal(0);
    expect(progress.requiredRatio).to.equal(1);
  });

  it('treats the optional ratio as 0 % when there is no optional task', () => {
    const progress = calculator.calculate([leaf('1', 'todo', false)]);
    expect(progress.optionalTotal).to.equal(0);
    expect(progress.optionalRatio).to.equal(0);
  });

  it('computes fractional ratios from resolved/total counts', () => {
    const progress = calculator.calculate([
      leaf('1', 'done', false),
      leaf('2', 'done', false),
      leaf('3', 'todo', false),
      leaf('4', 'todo', false),
    ]);
    expect(progress.requiredRatio).to.equal(0.5);
  });

  it('counts a cancelled task as resolved in numerator and denominator', () => {
    const progress = calculator.calculate([leaf('1', 'cancelled', false)]);
    expect(progress.requiredTotal).to.equal(1);
    expect(progress.requiredDone).to.equal(1);
    expect(progress.requiredRatio).to.equal(1);
    expect(progress.requiredResolvedCancelled).to.equal(1);
    expect(progress.requiredResolvedDone).to.equal(0);
  });

  it('exposes the per-state breakdown for required and optional sets', () => {
    const progress = calculator.calculate([
      leaf('1', 'done', false),
      leaf('2', 'cancelled', false),
      leaf('3', 'inProgress', false),
      leaf('4', 'todo', false),
      leaf('5', 'inProgress', true),
    ]);
    expect(progress.requiredResolvedDone).to.equal(1);
    expect(progress.requiredResolvedCancelled).to.equal(1);
    expect(progress.requiredInProgress).to.equal(1);
    expect(progress.requiredTodo).to.equal(1);
    expect(progress.optionalInProgress).to.equal(1);
  });

  it('returns all-zero counts for an empty task list', () => {
    const progress = calculator.calculate([]);
    expect(progress.requiredTotal).to.equal(0);
    expect(progress.optionalTotal).to.equal(0);
    expect(progress.requiredRatio).to.equal(1);
  });
});
