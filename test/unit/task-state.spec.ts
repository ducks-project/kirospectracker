import { expect } from 'chai';

import type { TaskState } from '../../src/core/model/TaskState';
import { isResolved, taskStateFromMark } from '../../src/core/model/TaskState';

/**
 * Behaviour specification for the {@link taskStateFromMark} and
 * {@link isResolved} helpers, the single source of truth for task state.
 */
describe('TaskState helpers', () => {
  describe('taskStateFromMark', () => {
    it('maps a space to todo', () => {
      expect(taskStateFromMark(' ')).to.equal('todo');
    });

    it('maps lowercase and uppercase x to done', () => {
      expect(taskStateFromMark('x')).to.equal('done');
      expect(taskStateFromMark('X')).to.equal('done');
    });

    it('maps a dash to cancelled', () => {
      expect(taskStateFromMark('-')).to.equal('cancelled');
    });

    it('maps a tilde to inProgress', () => {
      expect(taskStateFromMark('~')).to.equal('inProgress');
    });

    it('maps any unknown character to todo', () => {
      expect(taskStateFromMark('?')).to.equal('todo');
      expect(taskStateFromMark('z')).to.equal('todo');
      expect(taskStateFromMark('')).to.equal('todo');
    });
  });

  describe('isResolved', () => {
    const truthTable: ReadonlyArray<{ state: TaskState; resolved: boolean }> = [
      { state: 'todo', resolved: false },
      { state: 'done', resolved: true },
      { state: 'cancelled', resolved: true },
      { state: 'inProgress', resolved: false },
    ];

    truthTable.forEach(({ state, resolved }) => {
      it(`returns ${resolved} for ${state}`, () => {
        expect(isResolved(state)).to.equal(resolved);
      });
    });
  });
});
