import { expect } from 'chai';

import type { ISpecSnapshot } from '../../src/core/model/ISpecSnapshot';
import type { IAgentErrorReporter } from '../../src/adapters/ports/IAgentErrorReporter';
import { KiroChatAgentGateway } from '../../src/adapters/agent/KiroChatAgentGateway';
import { FakeCommandGateway } from '../helpers/fake-command-gateway';

/** Error reporter recording surfaced messages. */
class RecordingReporter implements IAgentErrorReporter {
  public readonly errors: string[] = [];

  public showError(message: string): void {
    this.errors.push(message);
  }
}

/** A minimal spec snapshot for the tests. */
const SPEC = { name: 'spec-tracker', folderPath: '/w/.kiro/specs/spec-tracker' } as ISpecSnapshot;

/** A no-op sleep so the focus/paste timing never delays the tests. */
const noSleep = async (): Promise<void> => undefined;

/**
 * Behaviour specification for the selection/sequencing logic of
 * {@link KiroChatAgentGateway} against a fake command gateway.
 */
describe('KiroChatAgentGateway', () => {
  it('prefers the direct-argument queue command and uses no clipboard', async () => {
    const commands = new FakeCommandGateway([
      'kiroAgent.executions.queueUserMessage',
      'kiroAgent.sendMainUserInput',
    ]);
    const reporter = new RecordingReporter();
    const gateway = new KiroChatAgentGateway(commands, reporter, noSleep);

    await gateway.runTasks(SPEC, 'required');

    expect(commands.executed).to.have.length(1);
    expect(commands.executed[0].id).to.equal('kiroAgent.executions.queueUserMessage');
    expect(commands.executed[0].args).to.deep.equal(['Run all required tasks']);
    expect(commands.clipboardWrites).to.have.length(0);
    expect(reporter.errors).to.have.length(0);
  });

  it('sends the sync message via the queue command with the spec name', async () => {
    const commands = new FakeCommandGateway(['kiroAgent.executions.queueUserMessage']);
    const gateway = new KiroChatAgentGateway(commands, new RecordingReporter(), noSleep);

    await gateway.syncTasks(SPEC);

    expect(commands.executed[0].args).to.deep.equal(['Update the tasks for the spec-tracker']);
  });

  it('falls back to the focus + clipboard-paste path and restores the clipboard', async () => {
    const commands = new FakeCommandGateway(
      ['kiroAgent.focusContinueInput', 'kiroAgent.sendMainUserInput'],
      'previous-clipboard',
    );
    const gateway = new KiroChatAgentGateway(commands, new RecordingReporter(), noSleep);

    await gateway.runTasks(SPEC, 'required-and-optional');

    const executedIds = commands.executed.map((entry) => entry.id);
    expect(executedIds).to.deep.equal([
      'kiroAgent.focusContinueInput',
      'editor.action.clipboardPasteAction',
      'kiroAgent.sendMainUserInput',
    ]);
    // The message is written, then the original clipboard is restored last.
    expect(commands.clipboardWrites).to.deep.equal([
      'Run required and optional tasks',
      'previous-clipboard',
    ]);
  });

  it('restores the clipboard even when a paste-path command throws', async () => {
    const commands = new FakeCommandGateway(
      ['kiroAgent.sendMainUserInput'],
      'keep-me',
      'editor.action.clipboardPasteAction',
    );
    const reporter = new RecordingReporter();
    const gateway = new KiroChatAgentGateway(commands, reporter, noSleep);

    await gateway.syncTasks(SPEC);

    // The clipboard was restored to its original content despite the failure.
    expect(commands.clipboardWrites[commands.clipboardWrites.length - 1]).to.equal('keep-me');
    expect(reporter.errors).to.have.length(1);
  });

  it('uses the generic chat-open fallback when no kiroAgent command exists', async () => {
    const commands = new FakeCommandGateway(['workbench.action.chat.open']);
    const gateway = new KiroChatAgentGateway(commands, new RecordingReporter(), noSleep);

    await gateway.runTasks(SPEC, 'required');

    expect(commands.executed).to.have.length(1);
    expect(commands.executed[0].id).to.equal('workbench.action.chat.open');
    expect(commands.executed[0].args).to.deep.equal(['Run all required tasks']);
  });

  it('reports honestly and takes no path when no command surface is available', async () => {
    const commands = new FakeCommandGateway(['some.unrelated.command']);
    const reporter = new RecordingReporter();
    const gateway = new KiroChatAgentGateway(commands, reporter, noSleep);

    await gateway.syncTasks(SPEC);

    expect(commands.executed).to.have.length(0);
    expect(reporter.errors).to.have.length(1);
  });

  it('always reports availability as integrated (built only when supported)', () => {
    const gateway = new KiroChatAgentGateway(
      new FakeCommandGateway([]),
      new RecordingReporter(),
      noSleep,
    );
    expect(gateway.availability()).to.equal('integrated');
  });

  describe('isSupported', () => {
    it('is true for any kiroAgent.* command', () => {
      expect(KiroChatAgentGateway.isSupported(['kiroAgent.whatever'])).to.equal(true);
    });

    it('is true for the generic chat-open command', () => {
      expect(KiroChatAgentGateway.isSupported(['workbench.action.chat.open'])).to.equal(true);
    });

    it('is false when neither is present', () => {
      expect(KiroChatAgentGateway.isSupported(['x.y', 'z'])).to.equal(false);
    });
  });
});
