import { expect } from 'chai';
import * as fc from 'fast-check';

import type { ITaskItem } from '../../src/core/model/ITaskItem';
import type { TaskState } from '../../src/core/model/TaskState';
import { SpecStatus } from '../../src/core/model/SpecStatus';
import { SpecProgressCalculator } from '../../src/core/status/SpecProgressCalculator';
import { SpecStatusResolver } from '../../src/core/status/SpecStatusResolver';
import { TasksOnlyDocumentPolicy } from '../../src/core/status/TasksOnlyDocumentPolicy';

const calculator = new SpecProgressCalculator();
const resolver = new SpecStatusResolver(new TasksOnlyDocumentPolicy());

/** All documents present. */
const ALL_DOCS = { tasks: true, requirements: true, design: true, notes: true, bugfix: false };

/** Arbitrary over the four task states. */
const stateArb = fc.constantFrom<TaskState>('todo', 'done', 'cancelled', 'inProgress');

/** Arbitrary generating a flat list of leaf tasks. */
const leavesArb = fc.array(fc.record({ state: stateArb, optional: fc.boolean() }), {
  maxLength: 30,
});

/**
 * Build leaf tasks from a generated descriptor list.
 * @param descriptors The generated state/optional flags.
 * @returns The leaf tasks.
 */
function toTasks(descriptors: ReadonlyArray<{ state: TaskState; optional: boolean }>): ITaskItem[] {
  return descriptors.map((descriptor, index) => ({
    id: String(index + 1),
    title: `Task ${index + 1}`,
    state: descriptor.state,
    optional: descriptor.optional,
    children: [],
    requirements: [],
  }));
}

/** Rank of a status for monotonicity comparison. */
const RANK: Readonly<Record<SpecStatus, number>> = {
  [SpecStatus.Malformed]: -1,
  [SpecStatus.NotStarted]: 0,
  [SpecStatus.InProgress]: 1,
  [SpecStatus.Completed]: 2,
  [SpecStatus.FullyCompleted]: 3,
};

/**
 * Property-based specification for the progress calculator and status resolver.
 */
describe('SpecProgress and SpecStatus (properties)', () => {
  it('keeps done counts within their totals', () => {
    fc.assert(
      fc.property(leavesArb, (descriptors) => {
        const progress = calculator.calculate(toTasks(descriptors));
        expect(progress.requiredDone).to.be.at.most(progress.requiredTotal);
        expect(progress.optionalDone).to.be.at.most(progress.optionalTotal);
      }),
    );
  });

  it('counts every leaf exactly once across the two sets', () => {
    fc.assert(
      fc.property(leavesArb, (descriptors) => {
        const progress = calculator.calculate(toTasks(descriptors));
        expect(progress.requiredTotal + progress.optionalTotal).to.equal(descriptors.length);
      }),
    );
  });

  it('never moves the status backward as more required tasks are checked', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constant(false), { minLength: 1, maxLength: 12 }),
        fc.nat(),
        (base, checkCount) => {
          const before = toTasks(base.map(() => ({ state: 'todo' as TaskState, optional: false })));
          const toCheck = Math.min(checkCount, base.length);
          const after = toTasks(
            base.map((_value, index) => ({
              state: (index < toCheck ? 'done' : 'todo') as TaskState,
              optional: false,
            })),
          );
          const statusBefore = resolver.resolve(ALL_DOCS, calculator.calculate(before));
          const statusAfter = resolver.resolve(ALL_DOCS, calculator.calculate(after));
          expect(RANK[statusAfter]).to.be.at.least(RANK[statusBefore]);
        },
      ),
    );
  });
});
