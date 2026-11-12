import { expect } from 'chai';
import type { IRenderMessage } from '../../src/core/model/IDashboardMessage';
import { SpecStatus } from '../../src/core/model/SpecStatus';
import type { IWebviewApi, IWebviewState } from '../../src/webview/state/IWebviewApi';
import { DashboardStore } from '../../src/webview/state/DashboardStore';
import { buildCardView } from '../helpers/spec-card-view-builder';

/** Fake webview API recording every persisted state. */
class RecordingWebviewApi implements IWebviewApi {
  public readonly saved: IWebviewState[] = [];

  public constructor(private readonly initial: IWebviewState | undefined = undefined) {}

  public postMessage(): void {
    // Not used by the store.
  }

  public getState(): IWebviewState | undefined {
    return this.initial;
  }

  public setState(state: IWebviewState): void {
    this.saved.push(state);
  }
}

describe('DashboardStore', () => {
  it('starts with defaults when nothing is persisted', () => {
    const store = new DashboardStore(new RecordingWebviewApi());
    expect(store.layout).to.equal('list');
    expect(store.query).to.equal('');
    expect(store.cards).to.deep.equal([]);
    expect(store.filter.toArray()).to.deep.equal([]);
    expect(store.folderFilter.toArray()).to.deep.equal([]);
    expect(store.hasRendered).to.equal(false);
  });

  it('restores the persisted layout and filters', () => {
    const store = new DashboardStore(
      new RecordingWebviewApi({ layout: 'grid', filterKeys: ['malformed'], folderKeys: ['/ws'] }),
    );
    expect(store.layout).to.equal('grid');
    expect(store.filter.toArray()).to.deep.equal(['malformed']);
    expect(store.folderFilter.toArray()).to.deep.equal(['/ws']);
  });

  it('ignores unknown persisted filter entries', () => {
    const persisted = {
      filterKeys: ['bogus', 7],
      folderKeys: [7, '/ws'],
    } as unknown as IWebviewState;
    const store = new DashboardStore(new RecordingWebviewApi(persisted));
    expect(store.filter.toArray()).to.deep.equal([]);
    expect(store.folderFilter.toArray()).to.deep.equal(['/ws']);
  });

  it('persists exactly once, with the full payload, when a filter is toggled', () => {
    const api = new RecordingWebviewApi();
    const store = new DashboardStore(api);
    store.toggleStatusFilter('malformed');
    store.toggleFolderFilter('/ws');
    expect(api.saved).to.deep.equal([
      { layout: 'list', filterKeys: ['malformed'], folderKeys: [] },
      { layout: 'list', filterKeys: ['malformed'], folderKeys: ['/ws'] },
    ]);
  });

  it('selectLayout reports no change and does not persist for the active layout', () => {
    const api = new RecordingWebviewApi();
    const store = new DashboardStore(api);
    expect(store.selectLayout('list')).to.equal(false);
    expect(api.saved).to.have.length(0);
    expect(store.selectLayout('grid')).to.equal(true);
    expect(store.layout).to.equal('grid');
    expect(api.saved).to.have.length(1);
  });

  it('flipLayout alternates and persists', () => {
    const api = new RecordingWebviewApi();
    const store = new DashboardStore(api);
    store.flipLayout();
    store.flipLayout();
    expect(api.saved.map((saved) => saved.layout)).to.deep.equal(['grid', 'list']);
  });

  it('setQuery does not persist', () => {
    const api = new RecordingWebviewApi();
    const store = new DashboardStore(api);
    store.setQuery('abc');
    expect(store.query).to.equal('abc');
    expect(api.saved).to.have.length(0);
  });

  it('applyRender stores cards and stats without marking rendered', () => {
    const store = new DashboardStore(new RecordingWebviewApi());
    const card = buildCardView(SpecStatus.InProgress);
    const stats = { total: 1, completed: 0, inProgress: 1, notStarted: 0, malformed: 0 };
    const message = { type: 'render', cards: [card], stats } as unknown as IRenderMessage;
    store.applyRender({ ...message, globalTaskStats: store.globalTaskStats });
    expect(store.cards).to.deep.equal([card]);
    expect(store.stats).to.equal(stats);
    expect(store.hasRendered).to.equal(false);
    store.markRendered();
    expect(store.hasRendered).to.equal(true);
  });

  it('replaceCard returns the previous card or undefined', () => {
    const store = new DashboardStore(new RecordingWebviewApi());
    const first = buildCardView(SpecStatus.InProgress);
    store.applyRender({
      type: 'render',
      cards: [first],
      stats: store.stats,
      globalTaskStats: store.globalTaskStats,
    } as IRenderMessage);
    const updated = buildCardView(SpecStatus.Completed);
    expect(store.replaceCard(updated)).to.equal(first);
    expect(store.cards).to.deep.equal([updated]);
    const other = buildCardView(SpecStatus.Completed, { folderPath: '/other' });
    expect(store.replaceCard(other)).to.equal(undefined);
    expect(store.cards).to.deep.equal([updated]);
  });
});
