import { expect } from 'chai';
import * as fc from 'fast-check';

import type { ITaskItem } from '../../src/core/model/ITaskItem';
import type { TaskState } from '../../src/core/model/TaskState';
import { GlobalTaskStatsCalculator } from '../../src/core/status/GlobalTaskStatsCalculator';

const calculator = new GlobalTaskStatsCalculator();

/** Arbitrary over the four task states. */
const stateArb = fc.constantFrom<TaskState>('todo', 'done', 'cancelled', 'inProgress');

/** Arbitrary over a flat list of leaf tasks, each carrying a state. */
const treeArb: fc.Arbitrary<ITaskItem[]> = fc.array(stateArb, { maxLength: 20 }).map((states) =>
  states.map((state, index) => ({
    id: String(index + 1),
    title: `Task ${index + 1}`,
    state,
    optional: false,
    children: [],
    requirements: [],
  })),
);

/** Arbitrary over a corpus of per-spec task trees. */
const corpusArb = fc.array(treeArb, { maxLength: 8 });

/**
 * Property-based specification for {@link GlobalTaskStatsCalculator}.
 */
describe('GlobalTaskStatsCalculator (properties)', () => {
  it('buckets sum exactly to the total leaf count', () => {
    fc.assert(
      fc.property(corpusArb, (corpus) => {
        const stats = calculator.calculate(corpus);
        const leafCount = corpus.reduce((sum, tree) => sum + tree.length, 0);
        expect(stats.total).to.equal(leafCount);
        expect(stats.done + stats.cancelled + stats.inProgress + stats.todo).to.equal(leafCount);
      }),
    );
  });

  it('keeps percentComplete within [0, 1]', () => {
    fc.assert(
      fc.property(corpusArb, (corpus) => {
        const stats = calculator.calculate(corpus);
        expect(stats.percentComplete).to.be.at.least(0);
        expect(stats.percentComplete).to.be.at.most(1);
      }),
    );
  });
});
