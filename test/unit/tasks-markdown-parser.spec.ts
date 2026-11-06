import { expect } from 'chai';

import { TasksMarkdownParser } from '../../src/core/parsing/TasksMarkdownParser';

/**
 * Behaviour specification for {@link TasksMarkdownParser}.
 *
 * The parser is pure and total: it recognises the checkbox variants, the `*`
 * optional marker glued to the bracket, nesting via indentation and the
 * `_Requirements:_` metadata line, and it never throws on malformed input.
 */
describe('TasksMarkdownParser', () => {
  const parser = new TasksMarkdownParser();

  it('recognises an unchecked task as not done', () => {
    const [task] = parser.parse('- [ ] 1. Do the thing');
    expect(task.done).to.equal(false);
    expect(task.id).to.equal('1');
    expect(task.title).to.equal('Do the thing');
  });

  it('recognises a lowercase checked task as done', () => {
    const [task] = parser.parse('- [x] 1. Done thing');
    expect(task.done).to.equal(true);
  });

  it('recognises an uppercase checked task as done', () => {
    const [task] = parser.parse('- [X] 1. Done thing');
    expect(task.done).to.equal(true);
  });

  it('marks a task optional when a * is glued to the bracket', () => {
    const [task] = parser.parse('- [ ]* 1.2 Property tests');
    expect(task.optional).to.equal(true);
  });

  it('tolerates a space between the glued * and the number', () => {
    const [task] = parser.parse('- [x]*  1.3 Property test');
    expect(task.optional).to.equal(true);
    expect(task.done).to.equal(true);
  });

  it('does NOT mark a task optional from the word "optional" in prose', () => {
    const [task] = parser.parse('- [ ] 1. Add an optional parameter to the resolver');
    expect(task.optional).to.equal(false);
  });

  it('nests deeper-indented tasks under their parent', () => {
    const content = ['- [ ] 1. Parent', '  - [x] 1.1 Child one', '  - [ ] 1.2 Child two'].join(
      '\n',
    );
    const [parent] = parser.parse(content);
    expect(parent.children).to.have.length(2);
    expect(parent.children[0].id).to.equal('1.1');
    expect(parent.children[1].done).to.equal(false);
  });

  it('attaches a _Requirements:_ line to the current task as metadata, not a task', () => {
    const content = ['- [ ] 1. Parent', '  - _Requirements: 2.1, 2.2, 3.4_'].join('\n');
    const tasks = parser.parse(content);
    expect(tasks).to.have.length(1);
    expect(tasks[0].requirements).to.deep.equal(['2.1', '2.2', '3.4']);
  });

  it('skips junk and blank lines without producing tasks', () => {
    const content = ['# Heading', '', 'Some prose paragraph.', '> quote'].join('\n');
    expect(parser.parse(content)).to.deep.equal([]);
  });

  it('returns an empty array for empty input', () => {
    expect(parser.parse('')).to.deep.equal([]);
  });

  it('never throws on arbitrary malformed input', () => {
    expect(() => parser.parse('- [z] not a checkbox\n- [ ]]][ broken')).to.not.throw();
  });
});
