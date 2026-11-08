import { expect } from 'chai';

import type { ISpecSnapshot } from '../../src/core/model/ISpecSnapshot';
import { KiroChatAgentGateway } from '../../src/adapters/agent/KiroChatAgentGateway';
import { FakeCommandGateway } from '../helpers/fake-command-gateway';
import { RecordingReporter } from '../helpers/recording-reporter';
import { RecordingNotifier } from '../helpers/recording-notifier';
import { RecordingDiagnosticSink } from '../helpers/recording-diagnostic-sink';

/** A minimal spec snapshot for the tests. */
const SPEC = { name: 'spec-tracker', folderPath: '/w/.kiro/specs/spec-tracker' } as ISpecSnapshot;

/** A no-op sleep so the focus/paste timing never delays the tests. */
const noSleep = async (): Promise<void> => undefined;

/** Build a gateway over a command surface plus fresh recording feedback fakes. */
function buildGateway(commands: FakeCommandGateway): {
  gateway: KiroChatAgentGateway;
  reporter: RecordingReporter;
  notifier: RecordingNotifier;
  diagnostics: RecordingDiagnosticSink;
} {
  const reporter = new RecordingReporter();
  const notifier = new RecordingNotifier();
  const diagnostics = new RecordingDiagnosticSink();
  const gateway = new KiroChatAgentGateway(commands, reporter, notifier, diagnostics, noSleep);
  return { gateway, reporter, notifier, diagnostics };
}

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
    const { gateway, reporter } = buildGateway(commands);

    await gateway.runTasks(SPEC, 'required');

    expect(commands.executed).to.have.length(1);
    expect(commands.executed[0].id).to.equal('kiroAgent.executions.queueUserMessage');
    expect(commands.executed[0].args).to.deep.equal(['Run all required tasks']);
    expect(commands.clipboardWrites).to.have.length(0);
    expect(reporter.errors).to.have.length(0);
  });

  it('confirms an honest "sent" notification on the queue path', async () => {
    const commands = new FakeCommandGateway(['kiroAgent.executions.queueUserMessage']);
    const { gateway, notifier, reporter } = buildGateway(commands);

    await gateway.runTasks(SPEC, 'required');

    expect(notifier.infos).to.deep.equal([
      'Kiro Spec Tracker: sent to Kiro chat \u2014 "Run all required tasks".',
    ]);
    expect(reporter.errors).to.have.length(0);
  });

  it('sends the sync message via the queue command with the spec name', async () => {
    const commands = new FakeCommandGateway(['kiroAgent.executions.queueUserMessage']);
    const { gateway } = buildGateway(commands);

    await gateway.syncTasks(SPEC);

    expect(commands.executed[0].args).to.deep.equal(['Update the tasks for the spec-tracker']);
  });

  it('falls back to the focus + clipboard-paste path and restores the clipboard', async () => {
    const commands = new FakeCommandGateway(
      ['kiroAgent.focusContinueInput', 'kiroAgent.sendMainUserInput'],
      'previous-clipboard',
    );
    const { gateway } = buildGateway(commands);

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

  it('notifies an honest "pasted, press Enter" affordance on the paste path', async () => {
    const commands = new FakeCommandGateway([
      'kiroAgent.focusContinueInput',
      'kiroAgent.sendMainUserInput',
    ]);
    const { gateway, notifier, reporter } = buildGateway(commands);

    await gateway.runTasks(SPEC, 'required');

    expect(notifier.infos).to.deep.equal([
      'Kiro Spec Tracker: pasted "Run all required tasks" into the Kiro chat \u2014 ' +
        'press Enter to run it.',
    ]);
    expect(reporter.errors).to.have.length(0);
  });

  it('restores the clipboard and reports (no success toast) when a paste command throws', async () => {
    const commands = new FakeCommandGateway(
      ['kiroAgent.sendMainUserInput'],
      'keep-me',
      'editor.action.clipboardPasteAction',
    );
    const { gateway, reporter, notifier } = buildGateway(commands);

    await gateway.syncTasks(SPEC);

    // The clipboard was restored to its original content despite the failure.
    expect(commands.clipboardWrites[commands.clipboardWrites.length - 1]).to.equal('keep-me');
    expect(reporter.errors).to.have.length(1);
    // A failed send must never masquerade as a success.
    expect(notifier.infos).to.have.length(0);
  });

  it('uses the generic chat-open fallback when no kiroAgent command exists', async () => {
    const commands = new FakeCommandGateway(['workbench.action.chat.open']);
    const { gateway, notifier } = buildGateway(commands);

    await gateway.runTasks(SPEC, 'required');

    expect(commands.executed).to.have.length(1);
    expect(commands.executed[0].id).to.equal('workbench.action.chat.open');
    expect(commands.executed[0].args).to.deep.equal(['Run all required tasks']);
    expect(notifier.infos).to.deep.equal([
      'Kiro Spec Tracker: opened the chat with "Run all required tasks" \u2014 ' +
        'you may need to send it.',
    ]);
  });

  it('reports honestly and takes no path when no command surface is available', async () => {
    const commands = new FakeCommandGateway(['some.unrelated.command']);
    const { gateway, reporter, notifier } = buildGateway(commands);

    await gateway.syncTasks(SPEC);

    expect(commands.executed).to.have.length(0);
    expect(reporter.errors).to.have.length(1);
    expect(notifier.infos).to.have.length(0);
  });

  it('logs a diagnostic naming the detected ids and chosen path on every action', async () => {
    const commands = new FakeCommandGateway([
      'kiroAgent.executions.queueUserMessage',
      'kiroAgent.focusContinueInput',
      'workbench.action.chat.open',
      'some.unrelated.command',
    ]);
    const { gateway, diagnostics } = buildGateway(commands);

    await gateway.runTasks(SPEC, 'required');

    expect(diagnostics.lines).to.have.length(1);
    expect(diagnostics.lines[0]).to.equal(
      'agent action: path=queue; kiroAgent ids=' +
        '[kiroAgent.executions.queueUserMessage, kiroAgent.focusContinueInput]; ' +
        'generic chat-open=yes',
    );
  });

  it('logs the none path with no kiroAgent ids when nothing is usable', async () => {
    const commands = new FakeCommandGateway(['some.unrelated.command']);
    const { gateway, diagnostics } = buildGateway(commands);

    await gateway.syncTasks(SPEC);

    expect(diagnostics.lines).to.deep.equal([
      'agent action: path=none; kiroAgent ids=[(none)]; generic chat-open=no',
    ]);
  });

  it('always reports availability as integrated (built only when supported)', () => {
    const { gateway } = buildGateway(new FakeCommandGateway([]));
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
