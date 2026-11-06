import type {
  DashboardInboundMessage,
  DashboardLayout,
  DashboardOutboundMessage,
  SpecDocumentKind,
} from '../core/model/IDashboardMessage';
import type { ISpecCardView } from '../core/model/ISpecCardView';
import type { ISpecStats } from '../core/model/ISpecStats';
import type { SpecFilterKey } from '../core/model/SpecFilterKey';
import type { ISpecLayoutOptionView } from '../core/status/SpecLayoutToggleView';
import type { ISpecStatToggleView } from '../core/status/SpecStatToggleView';
import { planDashboardRender } from './DashboardRenderPlanner';
import { SpecCardFilter } from '../core/status/SpecCardFilter';
import { SpecLayoutToggleView } from '../core/status/SpecLayoutToggleView';
import { SpecStatToggleView } from '../core/status/SpecStatToggleView';
import { SpecStatusFilter } from '../core/status/SpecStatusFilter';

/** Persisted webview state surviving re-renders and view reloads. */
interface IWebviewState {
  readonly layout?: DashboardLayout;
  readonly filterKeys?: readonly SpecFilterKey[];
}

/** Minimal shape of the VS Code webview API injected into the global scope. */
interface IWebviewApi {
  postMessage(message: DashboardInboundMessage): void;
  getState(): IWebviewState | undefined;
  setState(state: IWebviewState): void;
}

declare function acquireVsCodeApi(): IWebviewApi;

/** Percentage multiplier for the required ratio. */
const PERCENT = 100;

/** Document links rendered per spec, in display order. */
const DOCUMENT_KINDS: readonly SpecDocumentKind[] = ['requirements', 'design', 'tasks', 'notes'];

/** Pure core projectors shared across renders. */
const statToggleView = new SpecStatToggleView();
const layoutToggleView = new SpecLayoutToggleView();

const vscodeApi = acquireVsCodeApi();

const persistedState = vscodeApi.getState();

/** Current render state kept between messages. */
const state: {
  cards: readonly ISpecCardView[];
  stats: ISpecStats;
  query: string;
  layout: DashboardLayout;
  filter: SpecStatusFilter;
} = {
  cards: [],
  stats: { total: 0, completed: 0, inProgress: 0, notStarted: 0, malformed: 0 },
  query: '',
  layout: persistedState?.layout ?? 'list',
  filter: SpecStatusFilter.fromUnknown(persistedState?.filterKeys ?? []),
};

/**
 * Persist the parts of the render state that must survive a re-render or a view
 * reload: the chosen layout and the active status-filter keys.
 */
function persistState(): void {
  vscodeApi.setState({ layout: state.layout, filterKeys: state.filter.toArray() });
}

/**
 * Mounted card nodes keyed by their spec folder path.
 *
 * It lets a scoped `specUpdated` message replace exactly one card node in the
 * DOM instead of rebuilding every card, and is cleared and repopulated on each
 * full render.
 */
const cardNodes = new Map<string, HTMLElement>();

/**
 * Create an element with optional class and text.
 * @param tag Element tag name.
 * @param className Optional class name.
 * @param text Optional text content (assigned via textContent, never HTML).
 * @returns The created element.
 */
function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (undefined !== className) {
    node.className = className;
  }
  if (undefined !== text) {
    node.textContent = text;
  }
  return node;
}

/** SVG namespace used to build the toolbar icon glyphs. */
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Icon viewBox side length (a 16x16 grid, codicon convention). */
const ICON_SIZE = 16;

/** Path data for each representative toolbar glyph, drawn on a 16x16 grid. */
const ICON_PATHS: Readonly<Record<string, string>> = {
  // Three stacked rows, i.e. a list.
  list: 'M2 3h12v2H2V3zm0 4h12v2H2V7zm0 4h12v2H2v-2z',
  // Four cells, i.e. a grid.
  grid: 'M2 2h5v5H2V2zm7 0h5v5H9V2zM2 9h5v5H2V9zm7 0h5v5H9V9z',
  // A diagonal cross, i.e. a clear/close glyph.
  close: 'M4 3L3 4l3.5 3.5L3 11l1 1 3.5-3.5L11 12l1-1-3.5-3.5L12 4l-1-1-3.5 3.5L4 3z',
};

/**
 * Build a static, decorative SVG icon for a known glyph name.
 *
 * The icon is assembled with `createElementNS`/`setAttribute` only (never
 * `innerHTML`), uses `currentColor` so it inherits the button's theme color, and
 * is marked `aria-hidden` because the hosting button already carries the label.
 * @param glyph The glyph name (a key of {@link ICON_PATHS}).
 * @returns The SVG element.
 */
function icon(glyph: string): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${ICON_SIZE} ${ICON_SIZE}`);
  svg.setAttribute('width', String(ICON_SIZE));
  svg.setAttribute('height', String(ICON_SIZE));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('icon');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICON_PATHS[glyph] ?? '');
  path.setAttribute('fill', 'currentColor');
  svg.appendChild(path);
  return svg;
}

/**
 * Toggle a status filter key, persist the new set and re-render.
 * @param key The filter key to toggle.
 */
function toggleStatusFilter(key: SpecFilterKey): void {
  state.filter = state.filter.toggle(key);
  persistState();
  rerender();
}

/**
 * Render one clickable statistic toggle as an accessible pressed-state button.
 * @param toggle The stat toggle view (key, label, value, pressed).
 * @returns The button element.
 */
function renderStatToggle(toggle: ISpecStatToggleView): HTMLElement {
  const button = el('button', toggle.pressed ? 'stat pressed' : 'stat');
  button.setAttribute('type', 'button');
  button.setAttribute('aria-pressed', String(toggle.pressed));
  button.setAttribute('aria-label', `Filter by ${toggle.label}`);
  button.title = `Filter by ${toggle.label}`;
  button.appendChild(el('span', 'stat-value', String(toggle.value)));
  button.appendChild(el('span', 'stat-label', toggle.label));
  button.addEventListener('click', () => toggleStatusFilter(toggle.key));
  return button;
}

/**
 * Render the aggregate statistics header as additive toggle filters.
 * @param stats The aggregate counts.
 * @returns The header element.
 */
function renderStats(stats: ISpecStats): HTMLElement {
  const header = el('section', 'stats');
  header.setAttribute('role', 'group');
  header.setAttribute('aria-label', 'Filter specs by status');
  statToggleView.build(stats, state.filter).forEach((toggle) => {
    header.appendChild(renderStatToggle(toggle));
  });
  return header;
}

/**
 * Render one progress bar.
 * @param label Row label.
 * @param done Done count.
 * @param total Total count.
 * @param ratio Completion ratio in [0, 1].
 * @returns The progress row element.
 */
function renderProgress(label: string, done: number, total: number, ratio: number): HTMLElement {
  const row = el('div', 'progress');
  row.appendChild(el('span', 'progress-label', `${label}: ${done}/${total}`));
  const track = el('div', 'progress-track');
  const fill = el('div', 'progress-fill');
  fill.style.width = `${Math.round(ratio * PERCENT)}%`;
  track.appendChild(fill);
  row.appendChild(track);
  return row;
}

/**
 * Render the document links for a spec, disabling absent documents.
 * @param card The spec card view.
 * @returns The links container element.
 */
function renderLinks(card: ISpecCardView): HTMLElement {
  const links = el('div', 'links');
  DOCUMENT_KINDS.forEach((kind) => {
    const present = Boolean(card.documents[kind]);
    const link = el('button', present ? 'link' : 'link disabled', kind);
    if (present) {
      link.addEventListener('click', () =>
        vscodeApi.postMessage({
          type: 'openDocument',
          folderPath: card.folderPath,
          document: kind,
        }),
      );
    } else {
      link.setAttribute('disabled', 'true');
      link.title = 'Document not present';
    }
    links.appendChild(link);
  });
  return links;
}

/**
 * Render the "Run tasks" button for a spec, disabled for a malformed spec.
 * @param card The spec card view.
 * @returns The button element.
 */
function renderRunButton(card: ISpecCardView): HTMLElement {
  const run = el('button', 'run', 'Run tasks');
  if ('Malformed' === card.status) {
    run.setAttribute('disabled', 'true');
    run.title = 'A malformed spec cannot be run';
    return run;
  }
  run.addEventListener('click', () =>
    vscodeApi.postMessage({ type: 'runTasks', folderPath: card.folderPath }),
  );
  return run;
}

/**
 * Render one spec card.
 * @param card The spec card view.
 * @returns The card element.
 */
function renderCard(card: ISpecCardView): HTMLElement {
  const article = el('article', `card status-${card.status}`);
  article.appendChild(el('h2', 'card-title', card.name));
  article.appendChild(el('span', 'card-status', card.status));
  const { progress } = card;
  article.appendChild(
    renderProgress(
      'Required',
      progress.requiredDone,
      progress.requiredTotal,
      progress.requiredRatio,
    ),
  );
  article.appendChild(
    renderProgress(
      'Optional',
      progress.optionalDone,
      progress.optionalTotal,
      progress.optionalRatio,
    ),
  );
  article.appendChild(renderLinks(card));
  article.appendChild(renderRunButton(card));
  return article;
}

/**
 * Filter cards by the active status toggles and the search query, composed by
 * the pure {@link SpecCardFilter}.
 * @returns The filtered cards.
 */
function filtered(): readonly ISpecCardView[] {
  return new SpecCardFilter(state.filter, state.query).apply(state.cards);
}

/**
 * Whether a status places a card in the completed group.
 * @param status The spec status string.
 * @returns `true` for `Completed` or `FullyCompleted`.
 */
function isDoneStatus(status: string): boolean {
  return 'Completed' === status || 'FullyCompleted' === status;
}

/**
 * Split cards into active and completed groups, completed kept visible but set
 * apart.
 * @param cards The cards to split.
 * @returns A tuple of active and completed cards.
 */
function partition(
  cards: readonly ISpecCardView[],
): readonly [readonly ISpecCardView[], readonly ISpecCardView[]] {
  return [
    cards.filter((card) => !isDoneStatus(card.status)),
    cards.filter((card) => isDoneStatus(card.status)),
  ];
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
  const section = el('section', `group layout-${state.layout}`);
  section.appendChild(el('h1', 'group-title', title));
  const grid = el('div', `cards layout-${state.layout}`);
  cards.forEach((card) => {
    const node = renderCard(card);
    cardNodes.set(card.folderPath, node);
    grid.appendChild(node);
  });
  section.appendChild(grid);
  return section;
}

/**
 * Re-render the dashboard. Assigned once {@link render} is defined so the
 * toolbar's event handlers can trigger a redraw without referencing `render`
 * before its definition.
 */
let rerender: () => void = () => undefined;

/**
 * Switch the dashboard to a given layout, persisting it and informing the host.
 * @param layout The layout to activate.
 */
function selectLayout(layout: DashboardLayout): void {
  if (layout === state.layout) {
    return;
  }
  state.layout = layout;
  persistState();
  vscodeApi.postMessage({ type: 'setLayout', layout: state.layout });
  rerender();
}

/**
 * Render one icon layout toggle as an accessible pressed-state button.
 * @param option The layout option (layout, codicon glyph, label).
 * @returns The button element.
 */
function renderLayoutToggle(option: ISpecLayoutOptionView): HTMLElement {
  const pressed = layoutToggleView.isPressed(option, state.layout);
  const button = el('button', pressed ? 'toggle pressed' : 'toggle');
  button.setAttribute('type', 'button');
  button.setAttribute('data-layout', option.layout);
  button.setAttribute('aria-pressed', String(pressed));
  button.setAttribute('aria-label', option.label);
  button.title = option.label;
  button.appendChild(icon(option.glyph));
  button.addEventListener('click', () => selectLayout(option.layout));
  return button;
}

/**
 * Build the search box together with its enlarged, accessible clear button.
 *
 * The clear button is a comfortably sized target (see the stylesheet): clicking
 * anywhere in it clears the query and refocuses the input, so the v0.1.1 focus
 * fix is preserved.
 * @returns The search wrapper element.
 */
function renderSearch(): HTMLElement {
  const wrapper = el('div', 'search-box');
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Search specs by name';
  search.value = state.query;
  search.className = 'search';
  search.addEventListener('input', () => {
    state.query = search.value;
    rerender();
  });
  const clear = el('button', 'search-clear');
  clear.setAttribute('type', 'button');
  clear.setAttribute('aria-label', 'Clear search');
  clear.title = 'Clear search';
  clear.appendChild(icon('close'));
  clear.addEventListener('click', () => {
    state.query = '';
    search.value = '';
    search.focus();
    rerender();
  });
  wrapper.appendChild(search);
  wrapper.appendChild(clear);
  return wrapper;
}

/**
 * Build the persistent toolbar (search box + icon layout toggles).
 *
 * This element is created once on the initial mount and then reused across
 * every subsequent render, so the live search input keeps its focus and caret
 * position even when a render arrives mid-typing (e.g. a spec file changed).
 * @returns The toolbar element.
 */
function renderToolbar(): HTMLElement {
  const toolbar = el('div', 'toolbar');
  toolbar.appendChild(renderSearch());
  const toggles = el('div', 'layout-toggles');
  toggles.setAttribute('role', 'group');
  toggles.setAttribute('aria-label', 'Dashboard layout');
  layoutToggleView.listOptions().forEach((option) => {
    toggles.appendChild(renderLayoutToggle(option));
  });
  toolbar.appendChild(toggles);
  return toolbar;
}

/**
 * Refresh the pressed state of the persistent layout toggles to match the
 * current layout, without rebuilding the toolbar (which hosts the search input).
 * @param app The app root hosting the toolbar.
 */
function syncToggleLabel(app: HTMLElement): void {
  const toggles = app.querySelectorAll('.toolbar .layout-toggles .toggle');
  toggles.forEach((node) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }
    const pressed = node.getAttribute('data-layout') === state.layout;
    node.setAttribute('aria-pressed', String(pressed));
    node.classList.toggle('pressed', pressed);
  });
}

/**
 * Build the spec groups for the current filter into the content container,
 * rebuilding the card-node cache from scratch.
 * @param content The content container to populate.
 */
function renderContent(content: HTMLElement): void {
  content.replaceChildren();
  cardNodes.clear();
  const [active, done] = partition(filtered());
  const activeGroup = renderGroup('Active specs', active);
  const doneGroup = renderGroup('Completed specs', done);
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
  app.appendChild(renderStats(state.stats));
  app.appendChild(renderToolbar());
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
  stats?.replaceWith(renderStats(state.stats));
  syncToggleLabel(app);
  const content = app.querySelector('.content');
  if (null !== content && content instanceof HTMLElement) {
    renderContent(content);
  }
}

rerender = render;

/**
 * Replace the stats region of the live dashboard in place.
 * @param app The app root hosting the stats region.
 */
function replaceStats(app: HTMLElement): void {
  const stats = app.querySelector('.stats');
  stats?.replaceWith(renderStats(state.stats));
}

/**
 * Replace a single card node in place when it stays in the same group, so a
 * scoped update avoids rebuilding every card.
 * @param card The updated card view.
 * @param previous The currently mounted node for this card.
 * @returns `true` when the node was swapped in place, `false` otherwise.
 */
function swapCardNode(card: ISpecCardView, previous: HTMLElement): boolean {
  const next = renderCard(card);
  cardNodes.set(card.folderPath, next);
  previous.replaceWith(next);
  return true;
}

/**
 * Apply a scoped single-card update without rebuilding the whole dashboard.
 *
 * It swaps the one changed card in {@link state.cards} and updates the stats
 * region. When a status change moves the card between the active and completed
 * groups (or the card is not currently mounted), the content is rebuilt via
 * {@link renderContent} so the card lands in the right section; otherwise only
 * that one node is replaced.
 * @param card The updated card view.
 */
function applySpecUpdate(card: ISpecCardView): void {
  const previousCard = state.cards.find((existing) => existing.folderPath === card.folderPath);
  state.cards = state.cards.map((existing) =>
    existing.folderPath === card.folderPath ? card : existing,
  );
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
  const movesGroup =
    undefined === previousCard || isDoneStatus(previousCard.status) !== isDoneStatus(card.status);
  if (undefined === previousNode || movesGroup) {
    renderContent(content);
    return;
  }
  swapCardNode(card, previousNode);
}

window.addEventListener('message', (event: MessageEvent<DashboardOutboundMessage>) => {
  const message = event.data;
  if ('render' === message.type) {
    state.cards = message.cards;
    state.stats = message.stats;
    render();
    return;
  }
  if ('specUpdated' === message.type) {
    state.stats = message.stats;
    applySpecUpdate(message.card);
    return;
  }
  if ('toggleLayout' === message.type) {
    state.layout = 'list' === state.layout ? 'grid' : 'list';
    persistState();
    render();
  }
});

render();

// Signal the host that the listener above is wired. VS Code disposes and
// re-creates this webview when the view is hidden and shown again, so on every
// (re)load the document boots with an empty DOM; this handshake tells the host
// to (re)post the current cached state, which is what makes a reopened view
// show the specs without a manual Refresh. Posted after the listener is set up
// so the host's reply can never be missed.
vscodeApi.postMessage({ type: 'ready' });
