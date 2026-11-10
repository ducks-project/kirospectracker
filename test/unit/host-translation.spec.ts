import { expect } from 'chai';
import type { ISpecSnapshot } from '../../src/core/model/ISpecSnapshot';
import { KiroChatAgentGateway } from '../../src/adapters/agent/KiroChatAgentGateway';
import { SpecAgentActions } from '../../src/adapters/SpecAgentActions';
import { OpenDocumentCommand } from '../../src/adapters/commands/OpenDocumentCommand';
import { SpecRepository } from '../../src/adapters/SpecRepository';
import { SpecSnapshotFactory } from '../../src/core/SpecSnapshotFactory';
import { SpecProgressCalculator } from '../../src/core/status/SpecProgressCalculator';
import { SpecStatusResolver } from '../../src/core/status/SpecStatusResolver';
import { TasksOnlyDocumentPolicy } from '../../src/core/status/TasksOnlyDocumentPolicy';
import { TasksMarkdownParser } from '../../src/core/parsing/TasksMarkdownParser';
import { DictionaryTranslator } from '../helpers/dictionary-translator';
import { FakeCommandGateway } from '../helpers/fake-command-gateway';
import { FakeSpecFileSystem } from '../helpers/fake-spec-file-system';
import { FakeWorkspaceGateway } from '../helpers/fake-workspace-gateway';
import { RecordingDiagnosticSink } from '../helpers/recording-diagnostic-sink';
import { RecordingNotifier } from '../helpers/recording-notifier';
import { RecordingReporter } from '../helpers/recording-reporter';
/** Marker dictionary: every message gets a visible prefix. */
const MARKED = new DictionaryTranslator({
  'No spec found at {0}.': 'FR Aucun spec à {0}.',
  'The {0} document is not present for "{1}".': 'FR Document {0} absent pour « {1} ».',
  'Kiro Spec Tracker: sent to Kiro chat \u2014 "{0}".': 'FR envoyé \u2014 « {0} ».',
  'Kiro Spec Tracker: no Kiro chat command is available to run this action.': 'FR indisponible',
});
const WORKSPACE = '/ws';
const ROOT = `${WORKSPACE}/.kiro/specs`;
/** Build a refreshed repository with one spec (tasks.md and requirements.md). */
async function seededRepository(): Promise<SpecRepository> {
  const fs = new FakeSpecFileSystem(
    [WORKSPACE],
    new Map([
      [`${ROOT}/alpha/tasks.md`, '- [ ] 1. Todo'],
      [`${ROOT}/alpha/requirements.md`, '# Req'],
    ]),
    new Set([`${ROOT}/alpha`]),
  );
  const factory = new SpecSnapshotFactory(
    new TasksMarkdownParser(),
    new SpecProgressCalculator(),
    new SpecStatusResolver(new TasksOnlyDocumentPolicy()),
  );
  const repository = new SpecRepository(fs, factory, fs);
  await repository.refresh();
  return repository;
}
/**
 * Host messages are produced through the injected translator.
 */
describe('host messages through the translator', () => {
  it('translates the open-document refusals', async () => {
    const repository = await seededRepository();
    const gateway = new FakeWorkspaceGateway();
    const command = new OpenDocumentCommand(repository, gateway, MARKED);
    await command.execute(`${ROOT}/alpha`, 'design');
    await command.execute(`${ROOT}/missing`, 'design');
    expect(gateway.errors).to.deep.equal([
      'FR Document design absent pour « alpha ».',
      `FR Aucun spec à ${ROOT}/missing.`,
    ]);
  });
  it('translates the unknown-spec error of the agent actions', async () => {
    const repository = await seededRepository();
    const reporter = new RecordingReporter();
    const gateway = new KiroChatAgentGateway(
      new FakeCommandGateway([]),
      reporter,
      new RecordingNotifier(),
      new RecordingDiagnosticSink(),
    );
    const actions = new SpecAgentActions(repository, gateway, reporter, MARKED);
    await actions.syncTasks('/nowhere');
    expect(reporter.errors).to.deep.equal(['FR Aucun spec à /nowhere.']);
  });
  it('translates the agent toasts but not the English prompt it quotes', async () => {
    const commands = new FakeCommandGateway(
      ['kiroAgent.sessions.create', 'kiroAgent.sessions.sendPrompt', 'kiroAgent.sessions.switch'],
      undefined,
      new Map<string, unknown>([
        ['kiroAgent.sessions.create', { sessionId: 's' }],
        ['kiroAgent.sessions.switch', { accepted: true, sessionId: 's' }],
      ]),
    );
    const notifier = new RecordingNotifier();
    const gateway = new KiroChatAgentGateway(
      commands,
      new RecordingReporter(),
      notifier,
      new RecordingDiagnosticSink(),
      MARKED,
    );
    await gateway.runTasks({ name: 'x', folderPath: '/w/x' } as ISpecSnapshot, 'required');
    expect(notifier.infos).to.deep.equal(['FR envoyé \u2014 « Run all required tasks ».']);
  });
  it('translates the no-command error', async () => {
    const reporter = new RecordingReporter();
    const gateway = new KiroChatAgentGateway(
      new FakeCommandGateway([]),
      reporter,
      new RecordingNotifier(),
      new RecordingDiagnosticSink(),
      MARKED,
    );
    await gateway.runTasks({ name: 'x', folderPath: '/w/x' } as ISpecSnapshot, 'required');
    expect(reporter.errors).to.deep.equal(['FR indisponible']);
  });
});
