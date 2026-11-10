import { expect } from 'chai';
import {
  HIDE_SYNC_DELAY_MS,
  HiddenSpecsSynchronizer,
} from '../../src/adapters/HiddenSpecsSynchronizer';
import {
  MementoHiddenSpecsState,
  OWNERSHIP_STATE_KEY,
} from '../../src/adapters/MementoHiddenSpecsState';
import { HideSpecsMode } from '../../src/core/hiding/HideSpecsMode';
import { SpecStatus } from '../../src/core/model/SpecStatus';
import {
  FakeConfigReader,
  FakeSettingsWriter,
  FakeSpecSource,
  RecordingNotifier,
} from '../helpers/hidden-specs-fakes';
import { ManualScheduler } from '../helpers/manual-scheduler';
import { MapState } from '../helpers/map-state';
import { RecordingDiagnosticSink } from '../helpers/recording-diagnostic-sink';
import { buildSnapshot } from '../helpers/spec-snapshot-builder';

const DONE = '**/.kiro/specs/done/**';
const OTHER = '**/.kiro/specs/other/**';

interface IHarness {
  readonly sync: HiddenSpecsSynchronizer;
  readonly source: FakeSpecSource;
  readonly writer: FakeSettingsWriter;
  readonly config: FakeConfigReader;
  readonly notifier: RecordingNotifier;
  readonly sink: RecordingDiagnosticSink;
  readonly scheduler: ManualScheduler;
  readonly backing: MapState;
}

function harness(): IHarness {
  const source = new FakeSpecSource();
  const writer = new FakeSettingsWriter();
  const config = new FakeConfigReader();
  const notifier = new RecordingNotifier();
  const sink = new RecordingDiagnosticSink();
  const scheduler = new ManualScheduler();
  const backing = new MapState();
  const state = new MementoHiddenSpecsState(backing);
  const sync = new HiddenSpecsSynchronizer({
    specs: source,
    config,
    writer,
    store: state,
    ledger: state,
    notifier,
    diagnostics: sink,
    scheduler,
  });
  sync.start();
  return { sync, source, writer, config, notifier, sink, scheduler, backing };
}

function activate(h: IHarness, mode: HideSpecsMode): void {
  h.config.config = { mode, hiddenStatuses: new Set([SpecStatus.Completed]) };
  h.source.specs = [
    buildSnapshot('done', SpecStatus.Completed),
    buildSnapshot('other', SpecStatus.InProgress),
  ];
  h.source.emit({ type: 'fullRefresh' });
}

describe('HiddenSpecsSynchronizer', () => {
  it('never writes while the mode is off', async () => {
    const h = harness();
    activate(h, HideSpecsMode.Off);
    await h.sync.sync();
    expect(h.writer.writes).to.deep.equal([]);
  });

  it('does nothing before the first full refresh', async () => {
    const h = harness();
    h.config.config = {
      mode: HideSpecsMode.Everywhere,
      hiddenStatuses: new Set([SpecStatus.Completed]),
    };
    h.source.emit({ type: 'specChanged', folderPath: '/ws/.kiro/specs/done' });
    await h.sync.sync();
    expect(h.writer.writes).to.deep.equal([]);
  });

  it('writes the selected specs once, to the mode setting only', async () => {
    const h = harness();
    activate(h, HideSpecsMode.SearchAndQuickOpen);
    await h.sync.sync();
    expect(h.writer.writes).to.deep.equal([
      { workspacePath: '/ws', setting: 'search.exclude', value: { [DONE]: true } },
    ]);
  });

  it('is idempotent: a second run writes nothing', async () => {
    const h = harness();
    activate(h, HideSpecsMode.Everywhere);
    await h.sync.sync();
    await h.sync.sync();
    expect(h.writer.writes).to.have.length(1);
  });

  it('preserves the user entries and never owns a pre-existing key', async () => {
    const h = harness();
    h.writer.value('/ws', 'files.exclude', { '**/.git': true, [DONE]: true });
    activate(h, HideSpecsMode.Everywhere);
    await h.sync.sync();
    expect(h.writer.writes).to.deep.equal([]);
    h.source.specs = [buildSnapshot('done', SpecStatus.InProgress)];
    await h.sync.sync();
    expect(h.writer.value('/ws', 'files.exclude')).to.deep.equal({ '**/.git': true, [DONE]: true });
  });

  it('removes an entry when the spec leaves the selected statuses or disappears', async () => {
    const h = harness();
    activate(h, HideSpecsMode.Everywhere);
    await h.sync.sync();
    h.source.specs = [buildSnapshot('done', SpecStatus.InProgress)];
    await h.sync.sync();
    expect(h.writer.value('/ws', 'files.exclude')).to.equal(undefined);
    h.source.specs = [buildSnapshot('done', SpecStatus.Completed)];
    await h.sync.sync();
    h.source.specs = [];
    await h.sync.sync();
    expect(h.writer.value('/ws', 'files.exclude')).to.equal(undefined);
  });

  it('moves entries between settings when the mode switches', async () => {
    const h = harness();
    activate(h, HideSpecsMode.SearchAndQuickOpen);
    await h.sync.sync();
    h.config.config = { ...h.config.config, mode: HideSpecsMode.Everywhere };
    await h.sync.sync();
    expect(h.writer.value('/ws', 'search.exclude')).to.equal(undefined);
    expect(h.writer.value('/ws', 'files.exclude')).to.deep.equal({ [DONE]: true });
  });

  it('removes only its own entries when the mode returns to off', async () => {
    const h = harness();
    h.writer.value('/ws', 'files.exclude', { '**/mine-not': true });
    activate(h, HideSpecsMode.Everywhere);
    await h.sync.sync();
    h.config.config = { ...h.config.config, mode: HideSpecsMode.Off };
    await h.sync.sync();
    expect(h.writer.value('/ws', 'files.exclude')).to.deep.equal({ '**/mine-not': true });
    expect(h.backing.values.size).to.be.greaterThan(0);
    await h.sync.sync();
    expect(h.writer.writes).to.have.length(2);
  });

  it('releases a key the user edited instead of rewriting it', async () => {
    const h = harness();
    activate(h, HideSpecsMode.Everywhere);
    await h.sync.sync();
    h.writer.value('/ws', 'files.exclude', { [DONE]: false });
    h.config.config = { ...h.config.config, mode: HideSpecsMode.Off };
    await h.sync.sync();
    expect(h.writer.writes).to.have.length(1);
    expect(h.writer.value('/ws', 'files.exclude')).to.deep.equal({ [DONE]: false });
  });

  it('does not rewrite a key the user deleted while the spec stays hidden', async () => {
    const h = harness();
    activate(h, HideSpecsMode.Everywhere);
    await h.sync.sync();
    h.writer.value('/ws', 'files.exclude', {});
    await h.sync.sync();
    await h.sync.sync();
    expect(h.writer.writes).to.have.length(1);
    expect(h.writer.value('/ws', 'files.exclude')).to.deep.equal({});
  });
  it('never rewrites nor removes a key the user set to false', async () => {
    const h = harness();
    activate(h, HideSpecsMode.Everywhere);
    await h.sync.sync();
    h.writer.value('/ws', 'files.exclude', { [DONE]: false });
    await h.sync.sync();
    h.source.specs = [buildSnapshot('done', SpecStatus.InProgress)];
    await h.sync.sync();
    expect(h.writer.writes).to.have.length(1);
    expect(h.writer.value('/ws', 'files.exclude')).to.deep.equal({ [DONE]: false });
  });
  it('rewrites a user-deleted key after an unhide then hide cycle', async () => {
    const h = harness();
    activate(h, HideSpecsMode.Everywhere);
    await h.sync.sync();
    h.writer.value('/ws', 'files.exclude', {});
    await h.sync.sync();
    h.source.specs = [buildSnapshot('done', SpecStatus.InProgress)];
    await h.sync.sync();
    h.source.specs = [buildSnapshot('done', SpecStatus.Completed)];
    await h.sync.sync();
    expect(h.writer.value('/ws', 'files.exclude')).to.deep.equal({ [DONE]: true });
  });
  it('forgets a withdrawal when the mode returns to off', async () => {
    const h = harness();
    activate(h, HideSpecsMode.Everywhere);
    await h.sync.sync();
    h.writer.value('/ws', 'files.exclude', {});
    await h.sync.sync();
    h.config.config = { ...h.config.config, mode: HideSpecsMode.Off };
    await h.sync.sync();
    expect(h.backing.values.has(OWNERSHIP_STATE_KEY)).to.equal(false);
    h.config.config = { ...h.config.config, mode: HideSpecsMode.Everywhere };
    await h.sync.sync();
    expect(h.writer.value('/ws', 'files.exclude')).to.deep.equal({ [DONE]: true });
  });
  it('reset clears the remembered withdrawals so the entry comes back', async () => {
    const h = harness();
    activate(h, HideSpecsMode.Everywhere);
    await h.sync.sync();
    h.writer.value('/ws', 'files.exclude', {});
    await h.sync.sync();
    await h.sync.reset();
    expect(h.backing.values.has(OWNERSHIP_STATE_KEY)).to.equal(false);
    await h.sync.sync();
    expect(h.writer.value('/ws', 'files.exclude')).to.deep.equal({ [DONE]: true });
  });
  it('records nothing and counts nothing when the folder is not open, logging once', async () => {
    const h = harness();
    h.writer.missingFolders.add('/ws');
    activate(h, HideSpecsMode.Everywhere);
    await h.sync.sync();
    await h.sync.sync();
    expect(h.writer.writes).to.deep.equal([]);
    expect(h.backing.values.has(OWNERSHIP_STATE_KEY)).to.equal(false);
    expect(h.notifier.firstWrites).to.deep.equal([]);
    expect(h.sink.lines.filter((line) => line.includes('/ws'))).to.have.length(1);
    h.writer.missingFolders.clear();
    await h.sync.sync();
    expect(h.notifier.firstWrites).to.deep.equal([
      { count: 1, setting: 'files.exclude', workspacePath: '/ws' },
    ]);
  });
  it('batches all additions of a folder into a single write per setting', async () => {
    const h = harness();
    h.config.config = {
      mode: HideSpecsMode.Everywhere,
      hiddenStatuses: new Set([SpecStatus.Completed]),
    };
    h.source.specs = [
      buildSnapshot('done', SpecStatus.Completed),
      buildSnapshot('other', SpecStatus.Completed),
    ];
    h.source.emit({ type: 'fullRefresh' });
    await h.sync.sync();
    expect(h.writer.writes).to.have.length(1);
    expect(h.writer.writes[0].value).to.deep.equal({ [DONE]: true, [OTHER]: true });
  });

  it('handles each workspace folder separately', async () => {
    const h = harness();
    h.config.config = {
      mode: HideSpecsMode.Everywhere,
      hiddenStatuses: new Set([SpecStatus.Completed]),
    };
    h.source.specs = [
      buildSnapshot('done', SpecStatus.Completed, '/one'),
      buildSnapshot('done', SpecStatus.Completed, '/two'),
    ];
    h.source.emit({ type: 'fullRefresh' });
    await h.sync.sync();
    expect(h.writer.writes.map((w) => w.workspacePath).sort()).to.deep.equal(['/one', '/two']);
  });

  it('debounces bursts of events into a single run', async () => {
    const h = harness();
    activate(h, HideSpecsMode.Everywhere);
    h.source.emit({ type: 'specChanged', folderPath: '/ws/.kiro/specs/done' });
    h.sync.requestSync();
    expect(h.scheduler.pending).to.equal(1);
    expect(h.scheduler.delays.every((delay) => HIDE_SYNC_DELAY_MS === delay)).to.equal(true);
    h.scheduler.flush();
    await h.sync.sync();
    expect(h.writer.writes).to.have.length(1);
  });

  it('shows the first-write notice once, never again', async () => {
    const h = harness();
    activate(h, HideSpecsMode.Everywhere);
    await h.sync.sync();
    expect(h.notifier.firstWrites).to.deep.equal([
      { count: 1, setting: 'files.exclude', workspacePath: '/ws' },
    ]);
    h.source.specs = [...h.source.specs, buildSnapshot('later', SpecStatus.Completed)];
    await h.sync.sync();
    expect(h.writer.writes).to.have.length(2);
    expect(h.notifier.firstWrites).to.have.length(1);
  });

  it('shows no notice when nothing was added', async () => {
    const h = harness();
    activate(h, HideSpecsMode.Everywhere);
    h.writer.value('/ws', 'files.exclude', { [DONE]: true });
    await h.sync.sync();
    expect(h.notifier.firstWrites).to.deep.equal([]);
  });

  it('logs a skipped spec once and still hides the others', async () => {
    const h = harness();
    activate(h, HideSpecsMode.Everywhere);
    h.source.specs = [...h.source.specs, buildSnapshot('we{ird', SpecStatus.Completed)];
    await h.sync.sync();
    await h.sync.sync();
    expect(h.sink.lines.filter((line) => line.includes('we{ird'))).to.have.length(1);
    expect(h.writer.value('/ws', 'files.exclude')).to.deep.equal({ [DONE]: true });
  });

  it('reports a write failure in the diagnostics without throwing', async () => {
    const h = harness();
    activate(h, HideSpecsMode.Everywhere);
    h.writer.failWith = new Error('disk full');
    await h.sync.sync();
    expect(h.sink.lines.join('\n')).to.contain('disk full');
  });

  it('reset removes every owned entry and only those', async () => {
    const h = harness();
    h.writer.value('/ws', 'files.exclude', { keep: true });
    activate(h, HideSpecsMode.Everywhere);
    await h.sync.sync();
    const removed = await h.sync.reset();
    expect(removed).to.equal(1);
    expect(h.writer.value('/ws', 'files.exclude')).to.deep.equal({ keep: true });
    expect(h.notifier.resets).to.deep.equal([1]);
    expect(await h.sync.reset()).to.equal(0);
  });

  it('stops listening and cancels pending runs once disposed', () => {
    const h = harness();
    activate(h, HideSpecsMode.Everywhere);
    h.sync.dispose();
    expect(h.source.listenerCount).to.equal(0);
    expect(h.scheduler.pending).to.equal(0);
  });
});
