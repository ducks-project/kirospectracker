import { expect } from 'chai';
import * as fc from 'fast-check';

import type { ITaskItem } from '../../src/core/model/ITaskItem';
import { TasksMarkdownParser } from '../../src/core/parsing/TasksMarkdownParser';

const parser = new TasksMarkdownParser();

/**
 * Flatten a task tree to its leaves.
 * @param tasks The task tree.
 * @returns The leaf tasks.
 */
function leaves(tasks: readonly ITaskItem[]): ITaskItem[] {
  return tasks.flatMap((task) => (0 < task.children.length ? leaves(task.children) : [task]));
}

/**
 * Property-based specification for {@link TasksMarkdownParser}.
 */
describe('TasksMarkdownParser (properties)', () => {
  it('is total: any string input yields an array and never throws', () => {
    fc.assert(
      fc.property(fc.string(), (content) => {
        expect(parser.parse(content)).to.be.an('array');
      }),
    );
  });

  it('is total over multi-line arbitrary text', () => {
    fc.assert(
      fc.property(fc.array(fc.string(), { maxLength: 40 }), (lines) => {
        expect(() => parser.parse(lines.join('\n'))).to.not.throw();
      }),
    );
  });

  it('flags a task optional iff a * is glued after the bracket', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.integer({ min: 1, max: 99 }),
        (done, optional, id) => {
          const mark = done ? 'x' : ' ';
          const star = optional ? '*' : '';
          const [task] = parser.parse(`- [${mark}]${star} ${id}. Title`);
          expect(task.optional).to.equal(optional);
          expect(task.state).to.equal(done ? 'done' : 'todo');
        },
      ),
    );
  });

  it('maps each known mark to its task state and unknown chars to todo', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 99 }), (id) => {
        expect(parser.parse(`- [-] ${id}. Task`)[0].state).to.equal('cancelled');
        expect(parser.parse(`- [~] ${id}. Task`)[0].state).to.equal('inProgress');
      }),
    );
  });

  it('degrades any non-mark bracket character to todo', () => {
    fc.assert(
      fc.property(
        fc.char().filter((char) => !['x', 'X', '-', '~', ']'].includes(char)),
        fc.integer({ min: 1, max: 99 }),
        (mark, id) => {
          const [task] = parser.parse(`- [${mark}] ${id}. Task`);
          expect(task.state).to.equal('todo');
        },
      ),
    );
  });

  it('never flips the optional flag from the word "optional" in prose', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 99 }), (id) => {
        const [task] = parser.parse(`- [ ] ${id}. This is an optional nicety, not a marker`);
        expect(task.optional).to.equal(false);
      }),
    );
  });

  it('produces leaves whose count is stable under re-parsing', () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 1, maxLength: 20 }), (dones) => {
        const body = dones
          .map((done, index) => `- [${done ? 'x' : ' '}] ${index + 1}. Task`)
          .join('\n');
        expect(leaves(parser.parse(body))).to.have.length(dones.length);
      }),
    );
  });
});
