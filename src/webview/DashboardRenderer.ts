import type { ISpecCardView } from '../core/model/ISpecCardView';
import { filterCards, partitionCards } from './card/CardGrouping';
import { renderCard } from './card/SpecCardView';
import type { ICardDeps } from './card/SpecCardView';
import { planSpecUpdate } from './card/SpecUpdatePlanner';
import { el } from './createElement';
import { planDashboardRender } from './DashboardRenderPlanner';
import { PREVIEW_ICON_CLASS } from './preview/previewDomNames';
import type { IHoverAnchor } from './preview/DomHoverPanelView';
import type { DashboardStore } from './state/DashboardStore';
import type { IDashboardActions } from './state/IDashboardActions';
import type { ViewText } from './state/ViewText';
import { renderGlobalStats, renderStats } from './stats/DashboardStatsView';
import { applyLayoutToggle, renderToolbar } from './toolbar/DashboardToolbar';
import type { IToolbarDeps } from './toolbar/IToolbarDeps';

/**
 * Draws the dashboard into the `#app` root and applies scoped single-card
 * updates.
 *
 * It owns the only DOM-node cache of the webview: the mounted card nodes keyed by
 * their spec folder path. The cache lets a scoped `specUpdated` message replace
 * exactly one card node instead of rebuilding every card, and is cleared and
 * repopulated on each full render.
 */
export class DashboardRenderer {
  private readonly cardNodes = new Map<string, HTMLElement>();
  private readonly toolbarDeps: IToolbarDeps;
  private readonly cardDeps: ICardDeps;

  /**
   * Build the renderer over the live state.
   * @param store The render state.
   * @param text The translation surface and translated projectors.
   * @param actions The dashboard intents handed to the views.
   * @param renderPreviewIcon Factory of a card's preview eye button.
   */
  public constructor(
    private readonly store: DashboardStore,
    private readonly text: ViewText,
    private readonly actions: IDashboardActions,
    renderPreviewIcon: (card: ISpecCardView) => HTMLElement | undefined,
  ) {
    this.toolbarDeps = { store, text, actions };
    this.cardDeps = { store, text, actions, renderPreviewIcon };
  }

  /**
   * Find the mounted preview icon of a card, the anchor of its hover panel.
   * @param folderPath The spec folder path.
   * @returns The preview icon element, or `undefined` when not mounted.
   */
  public findCardAnchor(folderPath: string): IHoverAnchor | undefined {
    return (
      this.cardNodes.get(folderPath)?.querySelector<HTMLElement>(`.${PREVIEW_ICON_CLASS}`) ??
      undefined
    );
  }

  /**
   * Render the dashboard into the app root.
   *
   * On the initial mount the full shell is built. On every later pass the
   * {@link planDashboardRender} plan keeps the toolbar (and its live search input)
   * in place and rewrites only the stats and content regions, so typing is never
   * interrupted by a render.
   */
  public render(): void {
    const app = document.getElementById('app');
    if (null === app) {
      return;
    }
    const plan = planDashboardRender(null === app.querySelector('.toolbar'));
    if (true === plan.buildsToolbar) {
      this.renderContent(this.mount(app));
      return;
    }
    this.replaceStats(app);
    this.syncToggleLabel(app);
    this.syncFolderFilterButton(app);
    const content = app.querySelector('.content');
    if (null !== content && content instanceof HTMLElement) {
      this.renderContent(content);
    }
  }

  /**
   * Apply a scoped single-card update without rebuilding the whole dashboard.
   *
   * It swaps the one changed card in the store's cards and updates the stats
   * region. When a status change moves the card between the active and completed
   * groups (or the card is not currently mounted), the content is rebuilt so the
   * card lands in the right section; otherwise only that one node is replaced.
   * @param card The updated card view.
   */
  public applySpecUpdate(card: ISpecCardView): void {
    const previousCard = this.store.replaceCard(card);
    const app = document.getElementById('app');
    if (null === app) {
      return;
    }
    this.replaceStats(app);
    const previousNode = this.cardNodes.get(card.folderPath);
    const content = app.querySelector('.content');
    if (null === content || !(content instanceof HTMLElement)) {
      this.render();
      return;
    }
    const action = planSpecUpdate(previousCard, card, undefined !== previousNode);
    if (undefined === previousNode || 'rebuild-content' === action) {
      this.renderContent(content);
      return;
    }
    this.swapCardNode(card, previousNode);
  }

  /**
   * Build the whole dashboard shell on the initial mount: stats, the persistent
   * toolbar and an empty content container, in that order.
   * @param app The app root to populate.
   * @returns The content container the subsequent renders rewrite.
   */
  private mount(app: HTMLElement): HTMLElement {
    const { store, text, actions } = this;
    app.replaceChildren();
    app.appendChild(renderStats(store.stats, store.filter, text.statToggles, text, actions));
    app.appendChild(renderGlobalStats(store.globalTaskStats, text));
    app.appendChild(renderToolbar(this.toolbarDeps));
    const content = el('section', 'content');
    app.appendChild(content);
    return content;
  }

  /**
   * Build the spec groups for the current filter into the content container,
   * rebuilding the card-node cache from scratch.
   * @param content The content container to populate.
   */
  private renderContent(content: HTMLElement): void {
    const { store, text } = this;
    content.replaceChildren();
    this.cardNodes.clear();
    const filtered = filterCards(store.cards, store.filter, store.folderFilter, store.query);
    const [active, done] = partitionCards(filtered);
    const activeGroup = this.renderGroup(text.t('Active specs'), active);
    const doneGroup = this.renderGroup(text.t('Completed specs'), done);
    if (undefined !== activeGroup) {
      content.appendChild(activeGroup);
    }
    if (undefined !== doneGroup) {
      content.appendChild(doneGroup);
    }
  }

  /**
   * Render a grouped section of spec cards, caching each card node by folder path.
   * @param title Section title.
   * @param cards Cards in the section.
   * @returns The section element, or `undefined` when empty.
   */
  private renderGroup(title: string, cards: readonly ISpecCardView[]): HTMLElement | undefined {
    if (0 === cards.length) {
      return undefined;
    }
    const { layout } = this.store;
    const section = el('section', `group layout-${layout}`);
    section.appendChild(el('h1', 'group-title', title));
    const grid = el('div', `cards layout-${layout}`);
    cards.forEach((card) => {
      const node = renderCard(card, this.cardDeps);
      this.cardNodes.set(card.folderPath, node);
      grid.appendChild(node);
    });
    section.appendChild(grid);
    return section;
  }

  /**
   * Replace the stats region and global-stats strip of the live dashboard in
   * place.
   * @param app The app root hosting the stats regions.
   */
  private replaceStats(app: HTMLElement): void {
    const { store, text, actions } = this;
    const stats = app.querySelector('.stats');
    stats?.replaceWith(renderStats(store.stats, store.filter, text.statToggles, text, actions));
    const strip = app.querySelector('.global-stats');
    strip?.replaceWith(renderGlobalStats(store.globalTaskStats, text));
  }

  /**
   * Refresh the single layout toggle (its flipping glyph, labels and pressed
   * state) to match the current layout, without rebuilding the toolbar (which
   * hosts the search input).
   * @param app The app root hosting the toolbar.
   */
  private syncToggleLabel(app: HTMLElement): void {
    const node = app.querySelector('.toolbar .layout-toggles .toggle');
    if (!(node instanceof HTMLElement)) {
      return;
    }
    applyLayoutToggle(node, this.text.layoutToggle.describeToggle(this.store.layout));
  }

  /**
   * Reflect the active folder filter on the persistent toolbar's folder button
   * (a pressed look when at least one folder is selected) without rebuilding the
   * toolbar (which hosts the search input).
   * @param app The app root hosting the toolbar.
   */
  private syncFolderFilterButton(app: HTMLElement): void {
    const node = app.querySelector('.toolbar .folder-filter .folder-filter-button');
    if (!(node instanceof HTMLElement)) {
      return;
    }
    const active = !this.store.folderFilter.isEmpty();
    node.classList.toggle('pressed', active);
    node.setAttribute('aria-pressed', String(active));
  }

  /**
   * Replace a single card node in place when it stays in the same group, so a
   * scoped update avoids rebuilding every card.
   * @param card The updated card view.
   * @param previous The currently mounted node for this card.
   */
  private swapCardNode(card: ISpecCardView, previous: HTMLElement): void {
    const next = renderCard(card, this.cardDeps);
    this.cardNodes.set(card.folderPath, next);
    previous.replaceWith(next);
  }
}
