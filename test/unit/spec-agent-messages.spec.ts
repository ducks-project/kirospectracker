import { expect } from 'chai';

import { runMessageForScope, SPEC_AGENT_MESSAGES } from '../../src/core/SpecAgentMessages';

/**
 * Behaviour specification for {@link SPEC_AGENT_MESSAGES} and
 * {@link runMessageForScope}: the produced strings must be the exact ROADMAP
 * v0.7.0 templates, with only the spec name interpolated.
 */
describe('SpecAgentMessages', () => {
  it('produces the exact sync-tasks message with the spec name interpolated', () => {
    expect(SPEC_AGENT_MESSAGES.syncTasks('spec-tracker')).to.equal(
      'Update the tasks for the spec-tracker',
    );
  });

  it('produces the exact run-required message', () => {
    expect(SPEC_AGENT_MESSAGES.runRequired()).to.equal('Run all required tasks');
  });

  it('produces the exact run-required-and-optional message', () => {
    expect(SPEC_AGENT_MESSAGES.runRequiredAndOptional()).to.equal(
      'Run required and optional tasks',
    );
  });

  it('maps the required scope to the run-required message', () => {
    expect(runMessageForScope('required')).to.equal('Run all required tasks');
  });

  it('maps the required-and-optional scope to its message', () => {
    expect(runMessageForScope('required-and-optional')).to.equal('Run required and optional tasks');
  });

  it('interpolates only the spec name, building no instruction from free text', () => {
    const message = SPEC_AGENT_MESSAGES.syncTasks('weird name <with> chars');
    expect(message).to.equal('Update the tasks for the weird name <with> chars');
  });

  it('references no undocumented Kiro command', () => {
    expect(SPEC_AGENT_MESSAGES.runRequired()).to.not.contain('kiroAgent');
    expect(SPEC_AGENT_MESSAGES.syncTasks('x')).to.not.contain('kiroAgent');
  });
});
