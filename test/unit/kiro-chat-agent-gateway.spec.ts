import { expect } from 'chai';

import type { ISpecSnapshot } from '../../src/core/model/ISpecSnapshot';
import { KiroChatAgentGateway } from '../../src/adapters/agent/KiroChatAgentGateway';
import { FakeCommandGateway } from '../helpers/fake-command-gateway';
import { RecordingReporter } from '../helpers/recording-reporter';
import { RecordingNotifier } from '../helpers/recording-notifier';
import { RecordingDiagnosticSink } from '../helpers/recording-diagnostic-sink';

/** A minimal spec snapshot for the tests. */
const SPEC = { name: 'spec-tracker', folderPath: '/w/.kiro/specs/spec-tracker' } as ISpecSnapshot;

/** The preferred-path command ids (new session + real submit). */
const SESSIONS_CREATE = 'kiroAgent.sessions.create';
const SESSIONS_SEND_PROMPT = 'kiroAgent.sessions.sendPrompt';
const FOCUS_CHAT_INPUT = 'kiroAgent.focusChatInput';
const GENERIC_CHAT_OPEN = 'workbench.action.chat.open';

/** A `sessions.create` result map yielding a non-empty session id. */
function createResult(sessionId: string): ReadonlyMap<string, unknown> {
  return new Map<string, unknown>([[SESSIONS_CREATE, { sessionId }]]);
}

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
  const gateway = new KiroChatAgentGateway(commands, reporter, notifier, diagnostics);
  return { gateway, reporter, notifier, diagnostics };
}

/**
 * Behaviour specification for the capability-probed, cascading dispatch logic of
 * {@link KiroChatAgentGateway} against a fake command gateway.
 */
describe('KiroChatAgentGateway', () => {
  describe('create + sendPrompt (preferred path)', () => {
    it('creates a NEW session and submits the prompt POSITIONALLY', async () => {
      const commands = new FakeCommandGateway(
        [SESSIONS_CREATE, SESSIONS_SEND_PROMPT, FOCUS_CHAT_INPUT, GENERIC_CHAT_OPEN],
        undefined,
        createResult('sess-1'),
      );
      const { gateway, reporter } = buildGateway(commands);

      await gateway.runTasks(SPEC, 'required');

      expect(commands.executed.map((entry) => entry.id)).to.deep.equal([
        SESSIONS_CREATE,
        SESSIONS_SEND_PROMPT,
      ]);
      expect(commands.executed[0].args).to.deep.equal([]);
      // POSITIONAL (sessionId, prompt), NOT an options object.
      expect(commands.executed[1].args).to.deep.equal(['sess-1', 'Run all required tasks']);
      expect(reporter.errors).to.have.length(0);
    });

    it('confirms an honest "sent" notification on the create+sendPrompt path', async () => {
      const commands = new FakeCommandGateway(
        [SESSIONS_CREATE, SESSIONS_SEND_PROMPT],
        undefined,
        createResult('sess-1'),
      );
      const { gateway, notifier, reporter } = buildGateway(commands);

      await gateway.runTasks(SPEC, 'required');

      expect(notifier.infos).to.deep.equal([
        'Kiro Spec Tracker: sent to Kiro chat \u2014 "Run all required tasks".',
      ]);
      expect(reporter.errors).to.have.length(0);
    });

    it('interpolates the spec name into the submitted sync message', async () => {
      const commands = new FakeCommandGateway(
        [SESSIONS_CREATE, SESSIONS_SEND_PROMPT],
        undefined,
        createResult('sess-1'),
      );
      const { gateway } = buildGateway(commands);

      await gateway.syncTasks(SPEC);

      expect(commands.executed[1].args).to.deep.equal([
        'sess-1',
        'Update the tasks for the spec-tracker',
      ]);
    });

    it('logs the create+sendPrompt diagnostic path', async () => {
      const commands = new FakeCommandGateway(
        [SESSIONS_CREATE, SESSIONS_SEND_PROMPT],
        undefined,
        createResult('sess-1'),
      );
      const { gateway, diagnostics } = buildGateway(commands);

      await gateway.runTasks(SPEC, 'required');

      expect(diagnostics.lines[0]).to.contain('path=create+sendPrompt');
    });

    it('falls through to focusInput-submit when create returns no session id', async () => {
      const commands = new FakeCommandGateway([
        SESSIONS_CREATE,
        SESSIONS_SEND_PROMPT,
        FOCUS_CHAT_INPUT,
      ]);
      const { gateway, notifier, diagnostics } = buildGateway(commands);

      await gateway.runTasks(SPEC, 'required');

      // create ran, but sendPrompt must NOT be called without a valid session id.
      const executedIds = commands.executed.map((entry) => entry.id);
      expect(executedIds).to.not.include(SESSIONS_SEND_PROMPT);
      expect(executedIds[0]).to.equal(SESSIONS_CREATE);
      expect(executedIds).to.include(FOCUS_CHAT_INPUT);
      expect(diagnostics.lines[0]).to.contain('path=focusInput-submit');
      expect(notifier.infos).to.deep.equal([
        'Kiro Spec Tracker: sent to Kiro chat \u2014 "Run all required tasks".',
      ]);
    });

    it('falls through when create returns an empty-string session id', async () => {
      const commands = new FakeCommandGateway(
        [SESSIONS_CREATE, SESSIONS_SEND_PROMPT, FOCUS_CHAT_INPUT],
        undefined,
        createResult(''),
      );
      const { gateway, diagnostics } = buildGateway(commands);

      await gateway.runTasks(SPEC, 'required');

      const executedIds = commands.executed.map((entry) => entry.id);
      expect(executedIds).to.not.include(SESSIONS_SEND_PROMPT);
      expect(diagnostics.lines[0]).to.contain('path=focusInput-submit');
    });

    it('falls through to the next path when sendPrompt throws', async () => {
      const commands = new FakeCommandGateway(
        [SESSIONS_CREATE, SESSIONS_SEND_PROMPT, FOCUS_CHAT_INPUT],
        SESSIONS_SEND_PROMPT,
        createResult('sess-1'),
      );
      const { gateway, diagnostics } = buildGateway(commands);

      await gateway.runTasks(SPEC, 'required');

      expect(diagnostics.lines[0]).to.contain('path=focusInput-submit');
    });
  });

  describe('focusChatInput submit (fallback A)', () => {
    it('opens a NEW session and submits via focusChatInput', async () => {
      const commands = new FakeCommandGateway([FOCUS_CHAT_INPUT]);
      const { gateway, notifier } = buildGateway(commands);

      await gateway.runTasks(SPEC, 'required');

      expect(commands.executed).to.have.length(1);
      expect(commands.executed[0].id).to.equal(FOCUS_CHAT_INPUT);
      expect(commands.executed[0].args).to.deep.equal([
        { prompt: 'Run all required tasks', submit: true, newSession: true },
      ]);
      expect(notifier.infos).to.deep.equal([
        'Kiro Spec Tracker: sent to Kiro chat \u2014 "Run all required tasks".',
      ]);
    });

    it('logs the focusInput-submit diagnostic path', async () => {
      const commands = new FakeCommandGateway([FOCUS_CHAT_INPUT]);
      const { gateway, diagnostics } = buildGateway(commands);

      await gateway.runTasks(SPEC, 'required');

      expect(diagnostics.lines[0]).to.contain('path=focusInput-submit');
    });
  });

  describe('focusChatInput fill-only (fallback B)', () => {
    it('fills only and tells the user to press Enter when submit throws', async () => {
      // focusChatInput fails only on the FIRST (submit) call; the fill-only
      // retry uses a distinct options object, so configure a one-shot failure.
      const commands = new OneShotFailingFocus();
      const { gateway, notifier, diagnostics } = buildGateway(
        commands as unknown as FakeCommandGateway,
      );

      await gateway.runTasks(SPEC, 'required');

      expect(diagnostics.lines[0]).to.contain('path=focusInput-fill');
      expect(notifier.infos).to.deep.equal([
        'Kiro Spec Tracker: filled the chat with "Run all required tasks" \u2014 ' +
          'press Enter to run it.',
      ]);
    });
  });

  describe('generic chat-open (fallback C)', () => {
    it('uses the generic chat-open fallback when no kiroAgent command exists', async () => {
      const commands = new FakeCommandGateway([GENERIC_CHAT_OPEN]);
      const { gateway, notifier } = buildGateway(commands);

      await gateway.runTasks(SPEC, 'required');

      expect(commands.executed).to.have.length(1);
      expect(commands.executed[0].id).to.equal(GENERIC_CHAT_OPEN);
      expect(commands.executed[0].args).to.deep.equal(['Run all required tasks']);
      expect(notifier.infos).to.deep.equal([
        'Kiro Spec Tracker: opened the chat with "Run all required tasks" \u2014 ' +
          'you may need to send it.',
      ]);
    });

    it('logs the chat-open diagnostic path', async () => {
      const commands = new FakeCommandGateway([GENERIC_CHAT_OPEN]);
      const { gateway, diagnostics } = buildGateway(commands);

      await gateway.syncTasks(SPEC);

      expect(diagnostics.lines[0]).to.contain('path=chat-open');
    });
  });

  describe('none (no usable surface)', () => {
    it('reports honestly and takes no path when no command surface is available', async () => {
      const commands = new FakeCommandGateway(['some.unrelated.command']);
      const { gateway, reporter, notifier } = buildGateway(commands);

      await gateway.syncTasks(SPEC);

      expect(commands.executed).to.have.length(0);
      expect(reporter.errors).to.have.length(1);
      expect(notifier.infos).to.have.length(0);
    });

    it('falls through to none (error toast) when the chat-open fallback throws', async () => {
      const commands = new FakeCommandGateway([GENERIC_CHAT_OPEN], GENERIC_CHAT_OPEN);
      const { gateway, reporter, notifier, diagnostics } = buildGateway(commands);

      await gateway.syncTasks(SPEC);

      expect(diagnostics.lines[0]).to.contain('path=none');
      expect(reporter.errors).to.have.length(1);
      expect(notifier.infos).to.have.length(0);
    });

    it('never throws and reports when probing the command surface fails', async () => {
      const commands = new ThrowingGetCommands();
      const { gateway, reporter, notifier } = buildGateway(
        commands as unknown as FakeCommandGateway,
      );

      await gateway.syncTasks(SPEC);

      expect(reporter.errors).to.have.length(1);
      expect(reporter.errors[0]).to.contain('could not be completed');
      expect(notifier.infos).to.have.length(0);
    });

    it('logs the none path with no kiroAgent ids when nothing is usable', async () => {
      const commands = new FakeCommandGateway(['some.unrelated.command']);
      const { gateway, diagnostics } = buildGateway(commands);

      await gateway.syncTasks(SPEC);

      expect(diagnostics.lines).to.deep.equal([
        'agent action: path=none; kiroAgent ids=[(none)]; generic chat-open=no',
      ]);
    });
  });

  it('logs a diagnostic naming the detected ids and chosen path on every action', async () => {
    const commands = new FakeCommandGateway(
      [SESSIONS_CREATE, SESSIONS_SEND_PROMPT, FOCUS_CHAT_INPUT, GENERIC_CHAT_OPEN],
      undefined,
      createResult('sess-1'),
    );
    const { gateway, diagnostics } = buildGateway(commands);

    await gateway.runTasks(SPEC, 'required');

    expect(diagnostics.lines).to.have.length(1);
    expect(diagnostics.lines[0]).to.equal(
      'agent action: path=create+sendPrompt; kiroAgent ids=' +
        `[${SESSIONS_CREATE}, ${SESSIONS_SEND_PROMPT}, ${FOCUS_CHAT_INPUT}]; ` +
        'generic chat-open=yes',
    );
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
      expect(KiroChatAgentGateway.isSupported([GENERIC_CHAT_OPEN])).to.equal(true);
    });

    it('is false when neither is present', () => {
      expect(KiroChatAgentGateway.isSupported(['x.y', 'z'])).to.equal(false);
    });
  });
});

/**
 * A command gateway exposing only `focusChatInput` whose FIRST execution throws
 * (the submit attempt) and whose SECOND succeeds (the fill-only retry), so the
 * dispatch chain is driven from `focusInput-submit` down to `focusInput-fill`.
 */
class OneShotFailingFocus {
  public readonly executed: { id: string; args: readonly unknown[] }[] = [];

  private calls = 0;

  // eslint-disable-next-line class-methods-use-this
  public async getCommands(): Promise<readonly string[]> {
    return [FOCUS_CHAT_INPUT];
  }

  public async executeCommand<T = void>(id: string, ...args: readonly unknown[]): Promise<T> {
    this.executed.push({ id, args });
    this.calls += 1;
    if (1 === this.calls) {
      throw new Error('submit unavailable');
    }
    return undefined as T;
  }
}

/**
 * A command gateway whose capability probe (`getCommands`) throws, driving the
 * adapter's outer try/catch so the action is reported, never thrown, to the UI.
 */
class ThrowingGetCommands {
  // eslint-disable-next-line class-methods-use-this
  public async getCommands(): Promise<readonly string[]> {
    throw new Error('probe failed');
  }

  // eslint-disable-next-line class-methods-use-this
  public async executeCommand<T = void>(): Promise<T> {
    return undefined as T;
  }
}
