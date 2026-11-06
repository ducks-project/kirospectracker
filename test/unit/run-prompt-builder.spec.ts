import { expect } from 'chai';

import { RunPromptBuilder } from '../../src/core/RunPromptBuilder';

/**
 * Behaviour specification for {@link RunPromptBuilder}.
 */
describe('RunPromptBuilder', () => {
  const builder = new RunPromptBuilder();

  it('names the spec and lists the pending tasks', () => {
    const prompt = builder.build('spec-tracker', ['Parse tasks', 'Resolve status']);
    expect(prompt).to.contain('"spec-tracker"');
    expect(prompt).to.contain('- Parse tasks');
    expect(prompt).to.contain('- Resolve status');
  });

  it('states completion when there is no pending task', () => {
    const prompt = builder.build('done-spec', []);
    expect(prompt).to.contain('All tasks are already completed');
  });

  it('caps the number of listed tasks', () => {
    const capped = new RunPromptBuilder(2);
    const prompt = capped.build('big', ['a', 'b', 'c', 'd']);
    expect(prompt).to.contain('- a');
    expect(prompt).to.contain('- b');
    expect(prompt).to.not.contain('- c');
  });

  it('references no undocumented Kiro command', () => {
    const prompt = builder.build('spec', ['task']);
    expect(prompt).to.not.contain('kiroAgent');
  });
});
