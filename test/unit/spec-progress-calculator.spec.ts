import { expect } from 'chai';

import type { ITaskItem } from '../../src/core/model/ITaskItem';
import { SpecProgressCalculator } from '../../src/core/status/SpecProgressCalculator';

/**
 * Build a leaf task for the calculator fixtures.
 * @param id Task identifier.
 * @param done Whether the task is done.
 * @param optional Whether the task is optional.
 * @returns A leaf {@link ITaskItem}.
 */
function leaf(id: string, done: boolean, optional: boolean): ITaskItem {
  return { id, title: id, done, optional, children: [], requirements: [] };
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
      done: true,
      optional: false,
      requirements: [],
      children: [leaf('1.1', true, false), leaf('1.2', false, false)],
    };
    const progress = calculator.calculate([parent]);
    expect(progress.requiredTotal).to.equal(2);
    expect(progress.requiredDone).to.equal(1);
  });

  it('splits leaves into required (no *) and optional (*) sets', () => {
    const progress = calculator.calculate([
      leaf('1', true, false),
      leaf('2', false, false),
      leaf('3', true, true),
    ]);
    expect(progress.requiredTotal).to.equal(2);
    expect(progress.requiredDone).to.equal(1);
    expect(progress.optionalTotal).to.equal(1);
    expect(progress.optionalDone).to.equal(1);
  });

  it('treats the required ratio as 100 % when there is no required task', () => {
    const progress = calculator.calculate([leaf('1', false, true)]);
    expect(progress.requiredTotal).to.equal(0);
    expect(progress.requiredRatio).to.equal(1);
  });

  it('treats the optional ratio as 0 % when there is no optional task', () => {
    const progress = calculator.calculate([leaf('1', false, false)]);
    expect(progress.optionalTotal).to.equal(0);
    expect(progress.optionalRatio).to.equal(0);
  });

  it('computes fractional ratios from done/total counts', () => {
    const progress = calculator.calculate([
      leaf('1', true, false),
      leaf('2', true, false),
      leaf('3', false, false),
      leaf('4', false, false),
    ]);
    expect(progress.requiredRatio).to.equal(0.5);
  });

  it('returns all-zero counts for an empty task list', () => {
    const progress = calculator.calculate([]);
    expect(progress.requiredTotal).to.equal(0);
    expect(progress.optionalTotal).to.equal(0);
    expect(progress.requiredRatio).to.equal(1);
  });
});
