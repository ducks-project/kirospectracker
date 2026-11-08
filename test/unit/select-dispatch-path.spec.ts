import { expect } from 'chai';

import { selectDispatchPath } from '../../src/adapters/agent/KiroChatAgentGateway';

/**
 * Behaviour specification for the pure {@link selectDispatchPath} rule, the
 * single place the send-path order is decided. It has no side effect, so every
 * branch is asserted directly.
 */
describe('selectDispatchPath', () => {
  it('prefers the direct-argument queue command above all others', () => {
    const path = selectDispatchPath([
      'kiroAgent.executions.queueUserMessage',
      'kiroAgent.sendMainUserInput',
      'kiroAgent.focusContinueInput',
      'workbench.action.chat.open',
    ]);
    expect(path).to.equal('queue');
  });

  it('chooses the paste path when only sendMainUserInput is present', () => {
    expect(selectDispatchPath(['kiroAgent.sendMainUserInput'])).to.equal('paste');
  });

  it('chooses the paste path when only focusContinueInput is present', () => {
    expect(selectDispatchPath(['kiroAgent.focusContinueInput'])).to.equal('paste');
  });

  it('prefers the paste path over the generic chat-open fallback', () => {
    const path = selectDispatchPath(['kiroAgent.sendMainUserInput', 'workbench.action.chat.open']);
    expect(path).to.equal('paste');
  });

  it('chooses the generic chat-open fallback when no kiroAgent command exists', () => {
    expect(selectDispatchPath(['workbench.action.chat.open'])).to.equal('chat-open');
  });

  it('chooses none when no usable command surface exists', () => {
    expect(selectDispatchPath(['some.unrelated.command'])).to.equal('none');
    expect(selectDispatchPath([])).to.equal('none');
  });
});
