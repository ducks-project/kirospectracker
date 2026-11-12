import type { DashboardLayout, IRenderMessage } from '../../core/model/IDashboardMessage';
import type { IGlobalTaskStats } from '../../core/model/IGlobalTaskStats';
import type { ISpecCardView } from '../../core/model/ISpecCardView';
import type { ISpecStats } from '../../core/model/ISpecStats';
import type { SpecFilterKey } from '../../core/model/SpecFilterKey';
import { SpecFolderFilter } from '../../core/status/SpecFolderFilter';
import { SpecStatusFilter } from '../../core/status/SpecStatusFilter';
import type { IWebviewApi } from './IWebviewApi';

/** Empty global task stats used before the first render arrives. */
const EMPTY_GLOBAL_TASK_STATS: IGlobalTaskStats = {
  done: 0,
  cancelled: 0,
  inProgress: 0,
  todo: 0,
  total: 0,
  percentComplete: 0,
};

/** Empty aggregate stats used before the first render arrives. */
const EMPTY_STATS: ISpecStats = {
  total: 0,
  completed: 0,
  inProgress: 0,
  notStarted: 0,
  malformed: 0,
};

/**
 * Render state kept between messages, with the part that survives re-renders and
 * view reloads (layout, status filter, folder filter) persisted through the
 * webview API.
 *
 * Mutating methods only change and persist the state; posting to the host and
 * redrawing stay with the caller so the effect order is explicit there.
 */
export class DashboardStore {
  public cards: readonly ISpecCardView[] = [];
  public stats: ISpecStats = EMPTY_STATS;
  public globalTaskStats: IGlobalTaskStats = EMPTY_GLOBAL_TASK_STATS;
  public query = '';
  public layout: DashboardLayout;
  public filter: SpecStatusFilter;
  public folderFilter: SpecFolderFilter;
  /** Whether a `render` has been applied, so a late `strings` message can redraw. */
  public hasRendered = false;

  /**
   * Restore the persisted state, if any.
   * @param api The webview API used to read and persist the state.
   */
  public constructor(private readonly api: IWebviewApi) {
    const persisted = api.getState();
    this.layout = persisted?.layout ?? 'list';
    this.filter = SpecStatusFilter.fromUnknown(persisted?.filterKeys ?? []);
    this.folderFilter = SpecFolderFilter.fromUnknown(persisted?.folderKeys ?? []);
  }

  /**
   * Persist the parts of the render state that must survive a re-render or a
   * view reload: the chosen layout and the active status and folder filter keys.
   */
  public persist(): void {
    this.api.setState({
      layout: this.layout,
      filterKeys: this.filter.toArray(),
      folderKeys: this.folderFilter.toArray(),
    });
  }

  /**
   * Toggle a status filter key and persist the new set.
   * @param key The filter key to toggle.
   */
  public toggleStatusFilter(key: SpecFilterKey): void {
    this.filter = this.filter.toggle(key);
    this.persist();
  }

  /**
   * Toggle a folder filter key and persist the new set.
   * @param key The stable folder key to toggle.
   */
  public toggleFolderFilter(key: string): void {
    this.folderFilter = this.folderFilter.toggle(key);
    this.persist();
  }

  /**
   * Switch to a layout and persist it.
   * @param layout The layout to activate.
   * @returns `false` when the layout was already active (nothing changed), `true` otherwise.
   */
  public selectLayout(layout: DashboardLayout): boolean {
    if (layout === this.layout) {
      return false;
    }
    this.layout = layout;
    this.persist();
    return true;
  }

  /** Flip between the list and grid layouts and persist (host `toggleLayout`). */
  public flipLayout(): void {
    this.layout = 'list' === this.layout ? 'grid' : 'list';
    this.persist();
  }

  /**
   * Store the search query.
   * @param query The new query.
   */
  public setQuery(query: string): void {
    this.query = query;
  }

  /**
   * Store the content of a full `render` message.
   * @param message The render message.
   */
  public applyRender(message: IRenderMessage): void {
    this.cards = message.cards;
    this.stats = message.stats;
    this.globalTaskStats = message.globalTaskStats;
  }

  /** Record that a full render has been applied. */
  public markRendered(): void {
    this.hasRendered = true;
  }

  /**
   * Store the header stats carried by a scoped `specUpdated` message.
   * @param stats The aggregate counts.
   * @param globalTaskStats The aggregate global task stats.
   */
  public applySpecStats(stats: ISpecStats, globalTaskStats: IGlobalTaskStats): void {
    this.stats = stats;
    this.globalTaskStats = globalTaskStats;
  }

  /**
   * Replace one card (matched by folder path) in the card list.
   * @param card The updated card view.
   * @returns The previous card with the same folder path, or `undefined`.
   */
  public replaceCard(card: ISpecCardView): ISpecCardView | undefined {
    const previous = this.cards.find((existing) => existing.folderPath === card.folderPath);
    this.cards = this.cards.map((existing) =>
      existing.folderPath === card.folderPath ? card : existing,
    );
    return previous;
  }
}
