import type { DashboardOutboundMessage, IRenderMessage } from '../core/model/IDashboardMessage';
import type { ISpecCardView } from '../core/model/ISpecCardView';
import type { IScheduler, ScheduleHandle } from '../core/ports/IScheduler';
import { planDashboardRender } from './DashboardRenderPlanner';
import { HoverIntroductionController } from './HoverIntroductionController';
import type { IHoverPanelView } from './IHoverPanelView';
import { DomHoverPanelView } from './DomHoverPanelView';
import { createHoverCloseButton } from './HoverCloseButton';
import { createPreviewIconButton } from './PreviewIconButton';
import { PREVIEW_ICON_CLASS } from './previewDomNames';
import type { IHoverAnchor, IHoverDom, IHoverPanelElement } from './DomHoverPanelView';
import { resolveTrustedOrigin } from './resolveTrustedOrigin';
import { el } from './createElement';
import { icon } from './ToolbarIcon';
import type { IDashboardActions } from './state/IDashboardActions';
import type { IWebviewApi } from './state/IWebviewApi';
import { DashboardStore } from './state/DashboardStore';
import { ViewText } from './state/ViewText';
import { renderGlobalStats, renderStats } from './stats/DashboardStatsView';
import type { ICardDeps } from './card/SpecCardView';
import { renderCard } from './card/SpecCardView';
import type { IToolbarDeps } from './toolbar/IToolbarDeps';
import { applyLayoutToggle, renderToolbar } from './toolbar/DashboardToolbar';
import { filterCards, partitionCards } from './card/CardGrouping';
import { planSpecUpdate } from './card/SpecUpdatePlanner';

declare function acquireVsCodeApi(): IWebviewApi;

const vscodeApi = acquireVsCodeApi();

/** Render state kept between messages (persisted parts go through the webview API). */
const store = new DashboardStore(vscodeApi);

/** Translation surface and the translated core projectors. */
const text = new ViewText();

/**
 * Mounted card nodes keyed by their spec folder path.
 *
 * It lets a scoped `specUpdated` message replace exactly one card node in the
 * DOM instead of rebuilding every card, and is cleared and repopulated on each
 * full render.
 */
const cardNodes = new Map<string, HTMLElement>();

/**
 * Re-render the dashboard. Assigned once {@link render} is defined so the
 * intents below can trigger a redraw without referencing `render` before its
 * definition.
 */
let rerender: () => void = () => undefined;

/**
 * Dashboard intents handed to the views. Each keeps the effect order: mutate and
 * persist the state, then post to the host, then redraw.
 */
const actions: IDashboardActions = {
  toggleStatusFilter: (key) => {
    store.toggleStatusFilter(key);
    rerender();
  },
  toggleFolderFilter: (key) => {
    store.toggleFolderFilter(key);
    rerender();
  },
  selectLayout: (layout) => {
    if (!store.selectLayout(layout)) {
      return;
    }
    vscodeApi.postMessage({ type: 'setLayout', layout: store.layout });
    rerender();
  },
  setQuery: (query) => {
    store.setQuery(query);
    rerender();
  },
  post: (message) => vscodeApi.postMessage(message),
};

/** Dependencies of the toolbar controls. */
const toolbarDeps: IToolbarDeps = { store, text, actions };

/** Dependencies of the card renders. */
const cardDeps: ICardDeps = { store, text, actions, renderPreviewIcon };

/**
 * DOM environment for the hover panel, backed by the real document and the
 * mounted card nodes.
 */
const hoverDom: IHoverDom = {
  findAnchor: (folderPath: string): IHoverAnchor | undefined =>
    cardNodes.get(folderPath)?.querySelector<HTMLElement>(`.${PREVIEW_ICON_CLASS}`) ?? undefined,
  createPanel: (): IHoverPanelElement => el('div', 'card-hover-panel'),
  mountPanel: (panel: IHoverPanelElement): void => {
    document.body.appendChild(panel as HTMLElement);
  },
  createIntro: (intro: string): unknown => el('p', 'card-hover-intro', intro),
  createCloseButton: (): unknown =>
    createHoverCloseButton(text.t('Close preview'), () => hoverController.close()),
  isFocusInside: (panel: IHoverPanelElement): boolean =>
    (panel as HTMLElement).contains(document.activeElement),
  viewport: () => ({ width: window.innerWidth, height: window.innerHeight }),
};
/** DOM-backed adapter driving the floating preview panel. */
const hoverPanelView: IHoverPanelView = new DomHoverPanelView(hoverDom);
/**
 * {@link IScheduler} adapter over `setTimeout`/`clearTimeout`, backing the hover
 * debounce. It keeps the controller's timing deterministic in tests (a manual
 * scheduler is injected there) while using real timers in the webview.
 */
const timeoutScheduler: IScheduler = {
  schedule(callback: () => void, delayMs: number): ScheduleHandle {
    const handle = setTimeout(callback, delayMs);
    return () => clearTimeout(handle);
  },
};

/** The single hover controller owning the request gate, cache and debounce. */
const hoverController = new HoverIntroductionController(
  timeoutScheduler,
  (message) => vscodeApi.postMessage(message),
  hoverPanelView,
);

/**
 * Build a card's eye button opening its entry-document introduction preview,
 * or nothing when the spec has no resolved entry document.
 * @param card The spec card view.
 * @returns The preview button, or `undefined` without an entry document.
 */
function renderPreviewIcon(card: ISpecCardView): HTMLElement | undefined {
  if (undefined === card.entryDocument) {
    return undefined;
  }
  return createPreviewIconButton({
    folderPath: card.folderPath,
    label: text.t('Preview {0}', card.name),
    glyph: icon('eye'),
    controls: hoverController,
  });
}
document.addEventListener('keydown', (event: KeyboardEvent): void => {
  if ('Escape' === event.key) {
    hoverController.close();
  }
});
/** Class of the floating hover panel, whose own inner scroll must not dismiss it. */
const HOVER_PANEL_CLASS = 'card-hover-panel';

/**
 * Dismiss the hover panel when the page scrolls. The dashboard scrolls the
 * document itself, but the listener is registered in the capture phase (scroll
 * does not bubble) so an inner scrolling container is caught too. A scroll inside
 * the panel's own text is ignored. `leave()` is idempotent and cheap, and resets
 * the controller (active target, pending debounced request).
 */
document.addEventListener(
  'scroll',
  (event: Event): void => {
    const { target } = event;
    if (target instanceof Element && null !== target.closest(`.${HOVER_PANEL_CLASS}`)) {
      return;
    }
    hoverController.close();
  },
  { capture: true, passive: true },
);
// A click outside the popin and its icon closes the preview. Registered in the
// capture phase so inner controls that stop propagation cannot hide the click.
document.addEventListener(
  'click',
  (event: MouseEvent): void => {
    const { target } = event;
    const selector = `.${HOVER_PANEL_CLASS}, .${PREVIEW_ICON_CLASS}`;
    if (target instanceof Element && null !== target.closest(selector)) {
      return;
    }
    hoverController.close();
  },
  { capture: true },
);
/**
 * Filter cards by the active status toggles, the active folder filter and the
 * search query.
 * @returns The filtered cards.
 */
function filtered(): readonly ISpecCardView[] {
  return filterCards(store.cards, store.filter, store.folderFilter, store.query);
}

/**
 * Render a grouped section of spec cards, caching each card node by folder path.
 * @param title Section title.
 * @param cards Cards in the section.
 * @returns The section element, or `undefined` when empty.
 */
function renderGroup(title: string, cards: readonly ISpecCardView[]): HTMLElement | undefined {
  if (0 === cards.length) {
    return undefined;
  }
  const section = el('section', `group layout-${store.layout}`);
  section.appendChild(el('h1', 'group-title', title));
  const grid = el('div', `cards layout-${store.layout}`);
  cards.forEach((card) => {
    const node = renderCard(card, cardDeps);
    cardNodes.set(card.folderPath, node);
    grid.appendChild(node);
  });
  section.appendChild(grid);
  return section;
}

/**
 * Refresh the single layout toggle (its flipping glyph, labels and pressed
 * state) to match the current layout, without rebuilding the toolbar (which
 * hosts the search input).
 * @param app The app root hosting the toolbar.
 */
function syncToggleLabel(app: HTMLElement): void {
  const node = app.querySelector('.toolbar .layout-toggles .toggle');
  if (!(node instanceof HTMLElement)) {
    return;
  }
  applyLayoutToggle(node, text.layoutToggle.describeToggle(store.layout));
}

/**
 * Reflect the active folder filter on the persistent toolbar's folder button
 * (a pressed look when at least one folder is selected) without rebuilding the
 * toolbar (which hosts the search input).
 * @param app The app root hosting the toolbar.
 */
function syncFolderFilterButton(app: HTMLElement): void {
  const node = app.querySelector('.toolbar .folder-filter .folder-filter-button');
  if (!(node instanceof HTMLElement)) {
    return;
  }
  const active = !store.folderFilter.isEmpty();
  node.classList.toggle('pressed', active);
  node.setAttribute('aria-pressed', String(active));
}

/**
 * Build the spec groups for the current filter into the content container,
 * rebuilding the card-node cache from scratch.
 * @param content The content container to populate.
 */
function renderContent(content: HTMLElement): void {
  content.replaceChildren();
  cardNodes.clear();
  const [active, done] = partitionCards(filtered());
  const activeGroup = renderGroup(text.t('Active specs'), active);
  const doneGroup = renderGroup(text.t('Completed specs'), done);
  if (undefined !== activeGroup) {
    content.appendChild(activeGroup);
  }
  if (undefined !== doneGroup) {
    content.appendChild(doneGroup);
  }
}

/**
 * Build the whole dashboard shell on the initial mount: stats, the persistent
 * toolbar and an empty content container, in that order.
 * @param app The app root to populate.
 * @returns The content container the subsequent renders rewrite.
 */
function mount(app: HTMLElement): HTMLElement {
  app.replaceChildren();
  app.appendChild(renderStats(store.stats, store.filter, text.statToggles, text, actions));
  app.appendChild(renderGlobalStats(store.globalTaskStats, text));
  app.appendChild(renderToolbar(toolbarDeps));
  const content = el('section', 'content');
  app.appendChild(content);
  return content;
}

/**
 * Render the dashboard into the app root.
 *
 * On the initial mount the full shell is built. On every later pass the
 * {@link DashboardRenderPlanner} keeps the toolbar (and its live search input)
 * in place and rewrites only the stats and content regions, so typing is never
 * interrupted by a render.
 */
function render(): void {
  const app = document.getElementById('app');
  if (null === app) {
    return;
  }
  const plan = planDashboardRender(null === app.querySelector('.toolbar'));
  if (true === plan.buildsToolbar) {
    renderContent(mount(app));
    return;
  }
  const stats = app.querySelector('.stats');
  stats?.replaceWith(renderStats(store.stats, store.filter, text.statToggles, text, actions));
  replaceGlobalStats(app);
  syncToggleLabel(app);
  syncFolderFilterButton(app);
  const content = app.querySelector('.content');
  if (null !== content && content instanceof HTMLElement) {
    renderContent(content);
  }
}

rerender = render;

/**
 * Replace the compact global-stats strip of the live dashboard in place.
 * @param app The app root hosting the global-stats strip.
 */
function replaceGlobalStats(app: HTMLElement): void {
  const strip = app.querySelector('.global-stats');
  strip?.replaceWith(renderGlobalStats(store.globalTaskStats, text));
}

/**
 * Replace the stats region and global-stats strip of the live dashboard in
 * place.
 * @param app The app root hosting the stats regions.
 */
function replaceStats(app: HTMLElement): void {
  const stats = app.querySelector('.stats');
  stats?.replaceWith(renderStats(store.stats, store.filter, text.statToggles, text, actions));
  replaceGlobalStats(app);
}

/**
 * Replace a single card node in place when it stays in the same group, so a
 * scoped update avoids rebuilding every card.
 * @param card The updated card view.
 * @param previous The currently mounted node for this card.
 * @returns `true` when the node was swapped in place, `false` otherwise.
 */
function swapCardNode(card: ISpecCardView, previous: HTMLElement): boolean {
  const next = renderCard(card, cardDeps);
  cardNodes.set(card.folderPath, next);
  previous.replaceWith(next);
  return true;
}

/**
 * Apply a scoped single-card update without rebuilding the whole dashboard.
 *
 * It swaps the one changed card in the store's cards and updates the stats
 * region. When a status change moves the card between the active and completed
 * groups (or the card is not currently mounted), the content is rebuilt via
 * {@link renderContent} so the card lands in the right section; otherwise only
 * that one node is replaced.
 * @param card The updated card view.
 */
function applySpecUpdate(card: ISpecCardView): void {
  const previousCard = store.replaceCard(card);
  const app = document.getElementById('app');
  if (null === app) {
    return;
  }
  replaceStats(app);
  const previousNode = cardNodes.get(card.folderPath);
  const content = app.querySelector('.content');
  if (null === content || !(content instanceof HTMLElement)) {
    render();
    return;
  }
  const action = planSpecUpdate(previousCard, card, undefined !== previousNode);
  if (undefined === previousNode || 'rebuild-content' === action) {
    renderContent(content);
    return;
  }
  swapCardNode(card, previousNode);
}

// Close any open run-scope dropdown when a click lands outside it, so the menu
// behaves like a native popup. The handler only hides already-open menus; it
// never rebuilds the DOM.
document.addEventListener('click', () => {
  document.querySelectorAll('.run-menu').forEach((menu) => {
    if (!(menu instanceof HTMLElement) || menu.hidden) {
      return;
    }
    menu.hidden = true;
    const toggle = menu.parentElement?.querySelector('.run-toggle');
    toggle?.setAttribute('aria-expanded', 'false');
  });
  document.querySelectorAll('.folder-menu').forEach((menu) => {
    if (!(menu instanceof HTMLElement) || menu.hidden) {
      return;
    }
    menu.hidden = true;
    const button = menu.parentElement?.querySelector('.folder-filter-button');
    button?.setAttribute('aria-expanded', 'false');
  });
});

/**
 * Adopt the translated catalogue the host posted and rebuild the UI in that
 * language. The persistent toolbar is dropped so it is rebuilt with the new
 * strings; a first `render` after this message builds it directly translated.
 * @param messages The translated templates keyed by English message.
 */
function applyStrings(messages: Readonly<Record<string, string>>): void {
  text.adopt(messages);
  const app = document.getElementById('app');
  if (null === app) {
    return;
  }
  app.replaceChildren();
  if (store.hasRendered) {
    render();
  }
}
/**
 * Apply a full `render` message: store the new state and redraw.
 * @param message The render message.
 */
function applyRender(message: IRenderMessage): void {
  store.applyRender(message);
  // A full re-render means the specs were re-discovered (workspace change, a
  // entry document added), so clear the hover request gate and cache: a
  // later hover can retry a spec whose reply was lost or whose entry document
  // appeared after the first hover.
  hoverController.reset();
  store.markRendered();
  render();
}
window.addEventListener('message', (event: MessageEvent<DashboardOutboundMessage>) => {
  // Only the webview host (same origin as this document) may drive the
  // dashboard; ignore anything else before reading its data (CWE-940).
  if (event.origin !== resolveTrustedOrigin(window.location.origin)) {
    return;
  }
  const message = event.data;
  if ('strings' === message.type) {
    applyStrings(message.messages);
    return;
  }
  if ('render' === message.type) {
    applyRender(message);
    return;
  }
  if ('specUpdated' === message.type) {
    store.applySpecStats(message.stats, message.globalTaskStats);
    // The entry document may have changed (`.config.kiro`, `bugfix.md` added):
    // drop this card's hover caches so the next hover re-asks the host.
    hoverController.invalidate(message.card.folderPath);
    applySpecUpdate(message.card);
    return;
  }
  if ('toggleLayout' === message.type) {
    store.flipLayout();
    render();
    return;
  }
  if ('introduction' === message.type) {
    hoverController.receive(message.folderPath, message.introduction);
  }
});
// Signal the host that the listener above is wired. VS Code disposes and
// re-creates this webview when the view is hidden and shown again, so on every
// (re)load the document boots with an empty DOM; this handshake tells the host
// to (re)post the current cached state, which is what makes a reopened view
// show the specs without a manual Refresh. Posted after the listener is set up
// so the host's reply can never be missed.
vscodeApi.postMessage({ type: 'ready' });
