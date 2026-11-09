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

  it('recognises an unchecked task as todo', () => {
    const [task] = parser.parse('- [ ] 1. Do the thing');
    expect(task.state).to.equal('todo');
    expect(task.id).to.equal('1');
    expect(task.title).to.equal('Do the thing');
  });

  it('recognises a lowercase checked task as done', () => {
    const [task] = parser.parse('- [x] 1. Done thing');
    expect(task.state).to.equal('done');
  });

  it('recognises an uppercase checked task as done', () => {
    const [task] = parser.parse('- [X] 1. Done thing');
    expect(task.state).to.equal('done');
  });

  it('recognises a cancelled task from the [-] mark', () => {
    const [task] = parser.parse('- [-] 1. Abandoned thing');
    expect(task.state).to.equal('cancelled');
  });

  it('recognises an in-progress task from the [~] mark', () => {
    const [task] = parser.parse('- [~] 1. Ongoing thing');
    expect(task.state).to.equal('inProgress');
  });

  it('degrades an unknown bracket character to todo', () => {
    const [task] = parser.parse('- [?] 1. Mystery thing');
    expect(task.state).to.equal('todo');
  });

  it('marks a task optional when a * is glued to the bracket', () => {
    const [task] = parser.parse('- [ ]* 1.2 Property tests');
    expect(task.optional).to.equal(true);
  });

  it('tolerates a space between the glued * and the number', () => {
    const [task] = parser.parse('- [x]*  1.3 Property test');
    expect(task.optional).to.equal(true);
    expect(task.state).to.equal('done');
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
    expect(parent.children[1].state).to.equal('todo');
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
