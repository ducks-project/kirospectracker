import type {
  DashboardInboundMessage,
  DashboardLayout,
  DashboardOutboundMessage,
  IRenderMessage,
  SpecDocumentKind,
} from '../core/model/IDashboardMessage';
import type { IGlobalTaskStats } from '../core/model/IGlobalTaskStats';
import type { ISpecCardView } from '../core/model/ISpecCardView';
import type { ISpecStats } from '../core/model/ISpecStats';
import type { WebviewMessageKey } from '../core/i18n/messages';
import type { ITranslator } from '../core/ports/ITranslator';
import { CatalogTranslator } from '../core/i18n/CatalogTranslator';
import { IDENTITY_TRANSLATOR } from '../core/i18n/IdentityTranslator';
import type { PluralMessageKey } from '../core/i18n/pluralMessage';
import { translatePlural } from '../core/i18n/pluralMessage';
import { statusLabel } from '../core/status/SpecStatusLabel';
import type { RunScope } from '../core/ports/ISpecAgentGateway';
import type { SpecFilterKey } from '../core/model/SpecFilterKey';
import type { ISpecLayoutToggleView } from '../core/status/SpecLayoutToggleView';
import type { ISpecStatToggleView } from '../core/status/SpecStatToggleView';
import type { ISpecFolderToggleView } from '../core/status/SpecFolderToggleView';
import type { IScheduler, ScheduleHandle } from '../core/ports/IScheduler';
import { planDashboardRender } from './DashboardRenderPlanner';
import { visibleDocumentKinds } from './visibleDocumentKinds';
import { HoverIntroductionController } from './HoverIntroductionController';
import type { IHoverPanelView } from './IHoverPanelView';
import { DomHoverPanelView } from './DomHoverPanelView';
import { createHoverCloseButton } from './HoverCloseButton';
import { createPreviewIconButton } from './PreviewIconButton';
import { PREVIEW_ICON_CLASS } from './previewDomNames';
import type { IHoverAnchor, IHoverDom, IHoverPanelElement } from './DomHoverPanelView';
import { SpecCardFilter } from '../core/status/SpecCardFilter';
import { SpecFolderFilter } from '../core/status/SpecFolderFilter';
import { SpecFolderToggleView } from '../core/status/SpecFolderToggleView';
import { SpecLayoutToggleView } from '../core/status/SpecLayoutToggleView';
import { SpecStatToggleView } from '../core/status/SpecStatToggleView';
import { SPEC_DOCUMENT_KINDS } from '../core/model/SpecDocumentKind';
import { SpecStatusFilter } from '../core/status/SpecStatusFilter';
import { colorTokenForStatus } from '../core/status/SpecStatusColor';
import { statusToFilterKey } from '../core/model/SpecFilterKey';
import { resolveTrustedOrigin } from './resolveTrustedOrigin';

/** Persisted webview state surviving re-renders and view reloads. */
interface IWebviewState {
  readonly layout?: DashboardLayout;
  readonly filterKeys?: readonly SpecFilterKey[];
  readonly folderKeys?: readonly string[];
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
const DOCUMENT_KINDS: readonly SpecDocumentKind[] = SPEC_DOCUMENT_KINDS;

/**
 * Translator for the webview. It starts as the English identity and is replaced
 * by a catalogue-backed one when the host posts its `strings` message.
 */
let translator: ITranslator = IDENTITY_TRANSLATOR;
/**
 * Translate a webview message. The `WebviewMessageKey` type makes the compiler
 * refuse any message the host does not put in the catalogue sent to the webview.
 * @param key The English message.
 * @param args Positional values for `{0}`, `{1}`.
 * @returns The translated message.
 */
function tw(key: WebviewMessageKey, ...args: ReadonlyArray<string | number>): string {
  return translator.t(key, ...args);
}
/**
 * Translate a plural webview message and agree it with a count.
 * @param key The plural English message.
 * @param count The count, also substituted for `{0}`.
 * @returns The translated phrase in the form matching the count.
 */
function twp(key: Extract<WebviewMessageKey, PluralMessageKey>, count: number): string {
  return translatePlural(translator, key, count);
}
/** Pure core projectors shared across renders (rebuilt when the strings arrive). */
let statToggleView = new SpecStatToggleView(translator);
let layoutToggleView = new SpecLayoutToggleView(translator);
const folderToggleView = new SpecFolderToggleView();

const vscodeApi = acquireVsCodeApi();

const persistedState = vscodeApi.getState();

/** Empty global task stats used before the first render arrives. */
const EMPTY_GLOBAL_TASK_STATS: IGlobalTaskStats = {
  done: 0,
  cancelled: 0,
  inProgress: 0,
  todo: 0,
  total: 0,
  percentComplete: 0,
};

/** Current render state kept between messages. */
const state: {
  cards: readonly ISpecCardView[];
  stats: ISpecStats;
  globalTaskStats: IGlobalTaskStats;
  query: string;
  layout: DashboardLayout;
  filter: SpecStatusFilter;
  folderFilter: SpecFolderFilter;
} = {
  cards: [],
  stats: { total: 0, completed: 0, inProgress: 0, notStarted: 0, malformed: 0 },
  globalTaskStats: EMPTY_GLOBAL_TASK_STATS,
  query: '',
  layout: persistedState?.layout ?? 'list',
  filter: SpecStatusFilter.fromUnknown(persistedState?.filterKeys ?? []),
  folderFilter: SpecFolderFilter.fromUnknown(persistedState?.folderKeys ?? []),
};

/**
 * Persist the parts of the render state that must survive a re-render or a view
 * reload: the chosen layout, the active status-filter keys and the active
 * folder-filter keys.
 */
function persistState(): void {
  vscodeApi.setState({
    layout: state.layout,
    filterKeys: state.filter.toArray(),
    folderKeys: state.folderFilter.toArray(),
  });
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
  // A funnel, i.e. a filter glyph (matching the Extensions view affordance).
  filter: 'M1 2h14v2l-5 5v5l-4-2V9L1 4V2z',
  // An eye (almond outline plus pupil), i.e. a preview glyph; drawn for the even-odd rule.
  eye: 'M8 3C4.5 3 2 6 1 8c1 2 3.5 5 7 5s6-3 7-5c-1-2-3.5-5-7-5zM8 4.2C5.4 4.2 3.4 6.4 2.4 8c1 1.6 3 3.8 5.6 3.8s4.6-2.2 5.6-3.8C12.6 6.4 10.6 4.2 8 4.2zM8 5.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z',
};
/** Glyphs whose sub-paths overlap and need the even-odd fill rule. */
const EVEN_ODD_GLYPHS: ReadonlySet<string> = new Set(['eye']);

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
  if (EVEN_ODD_GLYPHS.has(glyph)) {
    path.setAttribute('fill-rule', 'evenodd');
  }
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
 * Toggle a folder filter key, persist the new set and re-render. Shared by the
 * search-box folder menu and the clickable card folder label so both stay in
 * sync over the same {@link SpecFolderFilter}.
 * @param key The stable folder key to toggle.
 */
function toggleFolderFilter(key: string): void {
  state.folderFilter = state.folderFilter.toggle(key);
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
  button.setAttribute('aria-label', tw('Filter by {0}', toggle.label));
  button.title = tw('Filter by {0}', toggle.label);
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
  header.setAttribute('aria-label', tw('Filter specs by status'));
  statToggleView.build(stats, state.filter).forEach((toggle) => {
    header.appendChild(renderStatToggle(toggle));
  });
  return header;
}

/**
 * Append one labelled task-count item to the global-stats strip.
 * @param strip The strip element to append to.
 * @param cssClass Extra class applied to the item for its state color.
 * @param label The human-readable state label.
 * @param value The count to show.
 */
function appendGlobalStatItem(
  strip: HTMLElement,
  cssClass: string,
  label: string,
  value: number,
): void {
  const item = el('span', `global-stat ${cssClass}`);
  item.appendChild(el('span', 'global-stat-value', String(value)));
  item.appendChild(el('span', 'global-stat-label', label));
  strip.appendChild(item);
}

/**
 * Render the compact global task-statistics strip.
 *
 * It is a single discreet line summarising the aggregate leaf tasks across
 * every spec (done, cancelled, in-progress, to-do) plus the overall resolved
 * percentage. It is intentionally non-dominating: a small strip, not a header.
 * @param stats The aggregate global task stats.
 * @returns The strip element.
 */
function renderGlobalStats(stats: IGlobalTaskStats): HTMLElement {
  const strip = el('section', 'global-stats');
  strip.setAttribute('aria-label', tw('Global task statistics'));
  appendGlobalStatItem(strip, 'global-stat-done', twp('done|done', stats.done), stats.done);
  appendGlobalStatItem(
    strip,
    'global-stat-cancelled',
    twp('cancelled|cancelled', stats.cancelled),
    stats.cancelled,
  );
  appendGlobalStatItem(strip, 'global-stat-inProgress', tw('in progress'), stats.inProgress);
  appendGlobalStatItem(strip, 'global-stat-todo', tw('to-do'), stats.todo);
  const percent = Math.round(stats.percentComplete * PERCENT);
  const overall = el('span', 'global-stat global-stat-overall');
  overall.appendChild(el('span', 'global-stat-value', tw('{0}%', percent)));
  overall.appendChild(el('span', 'global-stat-label', tw('resolved')));
  strip.appendChild(overall);
  return strip;
}

/**
 * Render one progress bar.
 * @param text Translated row text, including the counts.
 * @param ratio Completion ratio in [0, 1].
 * @returns The progress row element.
 */
function renderProgress(text: string, ratio: number): HTMLElement {
  const row = el('div', 'progress');
  row.appendChild(el('span', 'progress-label', text));
  const track = el('div', 'progress-track');
  const fill = el('div', 'progress-fill');
  fill.style.width = `${Math.round(ratio * PERCENT)}%`;
  track.appendChild(fill);
  row.appendChild(track);
  return row;
}

/**
 * Append one per-state count to a card's breakdown row when it is non-zero.
 *
 * Zero-count states are omitted to keep the row compact; each shown state wears
 * its own class so the stylesheet renders done normally, cancelled dimmed and
 * struck through, and in-progress in a subtle style.
 * @param row The breakdown row element.
 * @param cssClass The per-state class driving its theme-aware look.
 * @param text The translated text, including the count.
 * @param count The leaf count for this state (required + optional).
 */
function appendBreakdownItem(
  row: HTMLElement,
  cssClass: string,
  text: string,
  count: number,
): void {
  if (0 === count) {
    return;
  }
  row.appendChild(el('span', `task-state ${cssClass}`, text));
}

/**
 * Render the per-state task breakdown of a card.
 *
 * It sums the required and optional per-state counts from the card's progress
 * and shows done, cancelled and in-progress distinctly (to-do is implied by the
 * progress bar and omitted to stay compact). The whole row is hidden when the
 * spec has no leaf task.
 * @param card The spec card view.
 * @returns The breakdown row, or `undefined` when there is nothing to show.
 */
function renderCardBreakdown(card: ISpecCardView): HTMLElement | undefined {
  const { progress } = card;
  const done = progress.requiredResolvedDone + progress.optionalResolvedDone;
  const cancelled = progress.requiredResolvedCancelled + progress.optionalResolvedCancelled;
  const inProgress = progress.requiredInProgress + progress.optionalInProgress;
  if (0 === done && 0 === cancelled && 0 === inProgress) {
    return undefined;
  }
  const row = el('div', 'task-states');
  appendBreakdownItem(row, 'task-state-done', twp('{0} done|{0} done', done), done);
  appendBreakdownItem(
    row,
    'task-state-cancelled',
    twp('{0} cancelled|{0} cancelled', cancelled),
    cancelled,
  );
  appendBreakdownItem(row, 'task-state-inProgress', tw('{0} in progress', inProgress), inProgress);
  return row;
}

/**
 * Render the document links for a spec: only present documents get a link.
 * @param card The spec card view.
 * @returns The links container, or `undefined` when the spec has no document.
 */
function renderLinks(card: ISpecCardView): HTMLElement | undefined {
  const kinds = visibleDocumentKinds(card.documents, DOCUMENT_KINDS);
  if (0 === kinds.length) {
    return undefined;
  }
  const links = el('div', 'links');
  kinds.forEach((kind) => {
    const link = el('button', 'link', kind);
    link.setAttribute('type', 'button');
    link.addEventListener('click', (event) => {
      // Inner control: do not also trigger the card-body open gesture.
      event.stopPropagation();
      vscodeApi.postMessage({
        type: 'openDocument',
        folderPath: card.folderPath,
        document: kind,
      });
    });
    links.appendChild(link);
  });
  return links;
}

/**
 * Render the clickable status badge for a spec.
 *
 * The badge is a real button toggling the status filter for its status, exactly
 * as the matching toolbar stat toggle does (both call {@link toggleStatusFilter}
 * over the same {@link SpecStatusFilter}, so they stay in sync). Its color class
 * comes from the shared {@link colorTokenForStatus} mapping, and `aria-pressed`
 * reflects whether that status filter is currently active.
 * @param card The spec card view.
 * @returns The badge button element.
 */
function renderStatusBadge(card: ISpecCardView): HTMLElement {
  const key = statusToFilterKey(card.status);
  const pressed = state.filter.isActive(key);
  const label = statusLabel(card.status, translator);
  const badge = el('button', `card-status badge ${colorTokenForStatus(card.status)}`, label);
  badge.setAttribute('type', 'button');
  badge.setAttribute('aria-pressed', String(pressed));
  badge.setAttribute('aria-label', tw('Filter by {0} status', label));
  badge.title = tw('Filter by {0} status', label);
  badge.addEventListener('click', (event) => {
    // The badge is an inner control: stop the click from also triggering the
    // card-body open gesture.
    event.stopPropagation();
    toggleStatusFilter(key);
  });
  return badge;
}

/** Keys that activate or close the run-scope dropdown from the keyboard. */
const DROPDOWN_KEYS: ReadonlySet<string> = new Set(['Enter', ' ', 'Escape']);

/**
 * Post a scoped run-tasks intent for a spec.
 * @param card The spec card view.
 * @param scope The run scope.
 */
function postRunTasks(card: ISpecCardView, scope: RunScope): void {
  vscodeApi.postMessage({ type: 'runTasks', folderPath: card.folderPath, scope });
}

/**
 * Build one keyboard-accessible menu item of the run-scope dropdown.
 * @param label The visible label.
 * @param onActivate The action run on click or Enter/Space.
 * @returns The menu-item button element.
 */
function dropdownItem(label: string, onActivate: () => void): HTMLElement {
  const item = el('button', 'run-menu-item', label);
  item.setAttribute('type', 'button');
  item.setAttribute('role', 'menuitem');
  item.addEventListener('click', (event) => {
    event.stopPropagation();
    onActivate();
  });
  return item;
}

/**
 * Populate the run-scope dropdown menu with its two keyboard-accessible items.
 * @param menu The menu element to populate.
 * @param card The spec card view.
 * @param closeMenu Callback hiding the menu after an item activates.
 */
function buildRunMenu(menu: HTMLElement, card: ISpecCardView, closeMenu: () => void): void {
  menu.setAttribute('role', 'menu');
  menu.hidden = true;
  menu.appendChild(
    dropdownItem(tw('Run required tasks'), () => {
      closeMenu();
      postRunTasks(card, 'required');
    }),
  );
  menu.appendChild(
    dropdownItem(tw('Run required and optional tasks'), () => {
      closeMenu();
      postRunTasks(card, 'required-and-optional');
    }),
  );
}

/**
 * Build a split button disabled because the spec is malformed.
 * @param primary The primary action button.
 * @param toggle The dropdown toggle button.
 * @returns The disabled split-button group.
 */
function disabledRunSplit(primary: HTMLElement, toggle: HTMLElement): HTMLElement {
  const group = el('div', 'run-split');
  group.setAttribute('role', 'group');
  primary.setAttribute('disabled', 'true');
  toggle.setAttribute('disabled', 'true');
  group.title = tw('A malformed spec cannot be run');
  group.appendChild(primary);
  group.appendChild(toggle);
  return group;
}

/**
 * Wire the primary and toggle buttons of the run split button to their actions:
 * the primary runs the required tasks, the toggle opens/closes the menu by
 * mouse and keyboard (Enter/Space toggle, Escape closes).
 * @param card The spec card view.
 * @param primary The primary action button.
 * @param toggle The dropdown toggle button.
 * @param menu The dropdown menu element.
 */
function wireRunSplit(
  card: ISpecCardView,
  primary: HTMLElement,
  toggle: HTMLElement,
  menu: HTMLElement,
): void {
  const setExpanded = (open: boolean): void => {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  };
  buildRunMenu(menu, card, () => setExpanded(false));
  primary.addEventListener('click', (event) => {
    // Inner control: do not also trigger the card-body open gesture.
    event.stopPropagation();
    postRunTasks(card, 'required');
  });
  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    setExpanded(menu.hidden);
  });
  toggle.addEventListener('keydown', (event) => handleToggleKey(event, menu, setExpanded));
}

/**
 * Handle a keydown on the run-scope toggle: Escape closes the menu, Enter/Space
 * toggle it.
 * @param event The keyboard event.
 * @param menu The dropdown menu element.
 * @param setExpanded Callback setting the open/closed state.
 */
function handleToggleKey(
  event: KeyboardEvent,
  menu: HTMLElement,
  setExpanded: (open: boolean) => void,
): void {
  if ('Escape' === event.key) {
    setExpanded(false);
    return;
  }
  if (!DROPDOWN_KEYS.has(event.key)) {
    return;
  }
  event.preventDefault();
  setExpanded(menu.hidden);
}

/**
 * Render the "Run tasks" split button: a primary action running the required
 * tasks and a keyboard-accessible dropdown toggle exposing both run scopes. The
 * whole control is disabled for a malformed spec.
 * @param card The spec card view.
 * @returns The split-button element.
 */
function renderRunButton(card: ISpecCardView): HTMLElement {
  const primary = el('button', 'run run-primary', tw('Run tasks'));
  primary.setAttribute('type', 'button');
  primary.setAttribute('aria-label', tw('Run required tasks for {0}', card.name));
  const toggle = el('button', 'run run-toggle', '\u25BE');
  toggle.setAttribute('type', 'button');
  toggle.setAttribute('aria-haspopup', 'true');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', tw('Choose run scope for {0}', card.name));
  if ('Malformed' === card.status) {
    return disabledRunSplit(primary, toggle);
  }
  const group = el('div', 'run-split');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', tw('Run tasks for {0}', card.name));
  const menu = el('div', 'run-menu');
  wireRunSplit(card, primary, toggle, menu);
  group.appendChild(primary);
  group.appendChild(toggle);
  group.appendChild(menu);
  return group;
}

/**
 * Render the "Sync Files" button for a spec, disabled for a malformed spec.
 * @param card The spec card view.
 * @returns The button element.
 */
function renderSyncButton(card: ISpecCardView): HTMLElement {
  const sync = el('button', 'run sync', tw('Sync Files'));
  sync.setAttribute('type', 'button');
  sync.setAttribute('aria-label', tw('Sync files for {0}', card.name));
  if ('Malformed' === card.status) {
    sync.setAttribute('disabled', 'true');
    sync.title = tw('A malformed spec cannot be synced');
    return sync;
  }
  sync.addEventListener('click', (event) => {
    // Inner control: do not also trigger the card-body open gesture.
    event.stopPropagation();
    vscodeApi.postMessage({ type: 'syncFiles', folderPath: card.folderPath });
  });
  return sync;
}

/**
 * Render the task-action row (Sync Files + the Run tasks split button).
 * @param card The spec card view.
 * @returns The action-row element.
 */
function renderActions(card: ISpecCardView): HTMLElement {
  const actions = el('div', 'actions');
  actions.appendChild(renderSyncButton(card));
  actions.appendChild(renderRunButton(card));
  return actions;
}

/** Keys that activate the card-body open gesture from the keyboard. */
const ACTIVATION_KEYS: ReadonlySet<string> = new Set(['Enter', ' ']);

/**
 * Open a spec's resolved entry document through the existing openDocument intent.
 * @param card The spec card view (with a resolved entry document).
 * @param entry The entry document to open.
 */
function openCardEntry(card: ISpecCardView, entry: SpecDocumentKind): void {
  vscodeApi.postMessage({
    type: 'openDocument',
    folderPath: card.folderPath,
    document: entry,
  });
}

/**
 * Make the card body a keyboard-accessible button opening the spec's entry
 * document (resolved on the host from `.config.kiro`, with a fallback).
 *
 * Only the card background is the open gesture: inner controls (document links,
 * run button, status badge) stop click propagation, so a click on them never
 * also opens the card. When no entry document exists the card-body open is a
 * disabled no-op (no role, no tabstop, no handler). The actual open reuses the
 * existing openDocument postMessage path.
 * @param article The card element.
 * @param card The spec card view.
 */
function wireCardBody(article: HTMLElement, card: ISpecCardView): void {
  const entry = card.entryDocument;
  if (undefined === entry) {
    article.classList.add('card-disabled');
    return;
  }
  article.classList.add('card-clickable');
  article.setAttribute('role', 'button');
  article.setAttribute('tabindex', '0');
  article.setAttribute('aria-label', tw('Open {0} for {1}', entry, card.name));
  article.addEventListener('click', () => openCardEntry(card, entry));
  article.addEventListener('keydown', (event) => {
    if (!ACTIVATION_KEYS.has(event.key)) {
      return;
    }
    // Prevent the space key from scrolling and activate the open gesture.
    event.preventDefault();
    openCardEntry(card, entry);
  });
}

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
  createIntro: (text: string): unknown => el('p', 'card-hover-intro', text),
  createCloseButton: (): unknown =>
    createHoverCloseButton(tw('Close preview'), () => hoverController.close()),
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
    label: tw('Preview {0}', card.name),
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
 * Append the required/optional progress bars and the per-state breakdown row to
 * a card.
 * @param article The card element to populate.
 * @param card The spec card view.
 */
function appendCardProgress(article: HTMLElement, card: ISpecCardView): void {
  const { progress } = card;
  article.appendChild(
    renderProgress(
      tw('Required: {0}/{1}', progress.requiredDone, progress.requiredTotal),
      progress.requiredRatio,
    ),
  );
  article.appendChild(
    renderProgress(
      tw('Optional: {0}/{1}', progress.optionalDone, progress.optionalTotal),
      progress.optionalRatio,
    ),
  );
  const breakdown = renderCardBreakdown(card);
  if (undefined !== breakdown) {
    article.appendChild(breakdown);
  }
}

/**
 * Render the owning-folder label of a card as a clickable toggle button.
 *
 * Clicking it toggles that folder in the shared {@link SpecFolderFilter}, so it
 * stays in sync with the search-box folder menu. It keeps its discreet styling,
 * is an accessible button (`aria-pressed` reflecting whether that folder filter
 * is active), and stops click propagation so it never also triggers the
 * card-body open gesture (consistent with the status badge and the other inner
 * controls).
 * @param card The spec card view.
 * @returns The owner-label button element.
 */
function renderOwnerLabel(card: ISpecCardView): HTMLElement {
  const pressed = state.folderFilter.isActive(card.folderKey);
  const owner = el('button', 'card-owner', card.ownerLabel);
  owner.setAttribute('type', 'button');
  owner.setAttribute('aria-pressed', String(pressed));
  owner.setAttribute('aria-label', tw('Filter by {0} folder', card.ownerLabel));
  owner.title = tw('Filter by {0} folder', card.ownerLabel);
  owner.addEventListener('click', (event) => {
    // Inner control: do not also trigger the card-body open gesture.
    event.stopPropagation();
    toggleFolderFilter(card.folderKey);
  });
  return owner;
}

/**
 * Render one spec card.
 * @param card The spec card view.
 * @returns The card element.
 */
function renderCard(card: ISpecCardView): HTMLElement {
  const article = el('article', `card status-${card.status}`);
  const header = el('div', 'card-header');
  const heading = el('div', 'card-heading');
  heading.appendChild(el('h2', 'card-title', card.name));
  const preview = renderPreviewIcon(card);
  if (undefined !== preview) {
    heading.appendChild(preview);
  }
  header.appendChild(heading);
  header.appendChild(renderStatusBadge(card));
  article.appendChild(header);
  article.appendChild(renderOwnerLabel(card));
  appendCardProgress(article, card);
  const links = renderLinks(card);
  if (undefined !== links) {
    article.appendChild(links);
  }
  article.appendChild(renderActions(card));
  wireCardBody(article, card);
  return article;
}

/**
 * Filter cards by the active status toggles, the active folder filter and the
 * search query, composed (logical AND) by the pure {@link SpecCardFilter}.
 * @returns The filtered cards.
 */
function filtered(): readonly ISpecCardView[] {
  return new SpecCardFilter(state.filter, state.folderFilter, state.query).apply(state.cards);
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
 * Apply a single layout toggle view to a button element: its flipping glyph,
 * labels and pressed state.
 * @param button The toggle button to update.
 * @param toggle The current single-toggle view from the core mapper.
 */
function applyLayoutToggle(button: HTMLElement, toggle: ISpecLayoutToggleView): void {
  button.setAttribute('data-next-layout', toggle.nextLayout);
  button.setAttribute('aria-pressed', String(toggle.pressed));
  button.setAttribute('aria-label', toggle.label);
  button.title = toggle.label;
  button.classList.toggle('pressed', toggle.pressed);
  button.replaceChildren(icon(toggle.glyph));
}

/**
 * Render the single, flipping icon layout toggle as an accessible button.
 *
 * One button replaces the former two side-by-side toggles: it shows the glyph
 * of the layout a click will switch TO and flips on every click. The pure
 * {@link SpecLayoutToggleView} decides the glyph, label and pressed state.
 * @returns The toggle button element.
 */
function renderLayoutToggle(): HTMLElement {
  const button = el('button', 'toggle');
  button.setAttribute('type', 'button');
  const toggle = layoutToggleView.describeToggle(state.layout);
  applyLayoutToggle(button, toggle);
  button.addEventListener('click', () =>
    selectLayout(layoutToggleView.describeToggle(state.layout).nextLayout),
  );
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
  search.placeholder = tw('Search specs by name');
  search.value = state.query;
  search.className = 'search';
  search.addEventListener('input', () => {
    state.query = search.value;
    rerender();
  });
  const clear = el('button', 'search-clear');
  clear.setAttribute('type', 'button');
  clear.setAttribute('aria-label', tw('Clear search'));
  clear.title = tw('Clear search');
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
 * Populate the folder-filter menu with one accessible toggle item per distinct
 * spec-owning folder, rebuilt from the current cards and folder filter.
 *
 * The menu is (re)filled every time it opens, so it always reflects the folders
 * currently loaded and their pressed state without rebuilding the persistent
 * toolbar. An empty-folder case shows a discreet, non-interactive hint.
 * @param menu The menu element to populate.
 * @param closeMenu Callback hiding the menu after an item activates.
 */
function buildFolderMenu(menu: HTMLElement, closeMenu: () => void): void {
  menu.replaceChildren();
  const items: readonly ISpecFolderToggleView[] = folderToggleView.build(
    state.cards,
    state.folderFilter,
  );
  if (0 === items.length) {
    const empty = el('span', 'folder-menu-empty', tw('No folders to filter'));
    menu.appendChild(empty);
    return;
  }
  items.forEach((item) => menu.appendChild(folderMenuItem(item, closeMenu)));
}

/**
 * Build one keyboard-accessible folder-filter menu item.
 * @param item The folder toggle view (key, label, count, pressed).
 * @param closeMenu Callback hiding the menu after activation.
 * @returns The menu-item button element.
 */
function folderMenuItem(item: ISpecFolderToggleView, closeMenu: () => void): HTMLElement {
  const button = el('button', item.pressed ? 'folder-menu-item pressed' : 'folder-menu-item');
  button.setAttribute('type', 'button');
  button.setAttribute('role', 'menuitemcheckbox');
  button.setAttribute('aria-checked', String(item.pressed));
  button.appendChild(el('span', 'folder-menu-label', item.label));
  button.appendChild(el('span', 'folder-menu-count', String(item.count)));
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    closeMenu();
    toggleFolderFilter(item.key);
  });
  return button;
}

/** Keys that toggle or close the folder-filter menu from the keyboard. */
const FOLDER_MENU_KEYS: ReadonlySet<string> = new Set(['Enter', ' ', 'Escape']);

/**
 * Wire the folder-filter button and menu to open/close by mouse and keyboard
 * (click or Enter/Space toggle, Escape closes), rebuilding the menu on each open
 * so it always reflects the current folders and their pressed state.
 * @param button The folder-filter toggle button.
 * @param menu The folder-filter dropdown menu.
 */
function wireFolderFilter(button: HTMLElement, menu: HTMLElement): void {
  const setExpanded = (open: boolean): void => {
    if (open) {
      buildFolderMenu(menu, () => setExpanded(false));
    }
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  };
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    setExpanded(menu.hidden);
  });
  button.addEventListener('keydown', (event) => {
    if ('Escape' === event.key) {
      setExpanded(false);
      return;
    }
    if (!FOLDER_MENU_KEYS.has(event.key)) {
      return;
    }
    event.preventDefault();
    setExpanded(menu.hidden);
  });
}

/**
 * Build the folder-filter control: an Extensions-view-style filter button that
 * opens a menu listing the distinct spec-owning folders as additive toggles.
 *
 * The button lives in the persistent toolbar (built once), but its menu is
 * rebuilt on every open from the current state, so it always reflects the loaded
 * folders and their pressed state. It is keyboard-accessible (Enter/Space toggle
 * the menu, Escape closes it) with `aria-haspopup`/`aria-expanded`.
 * @returns The folder-filter control element.
 */
function renderFolderFilter(): HTMLElement {
  const group = el('div', 'folder-filter');
  const button = el('button', 'folder-filter-button');
  button.setAttribute('type', 'button');
  button.setAttribute('aria-haspopup', 'true');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-pressed', String(!state.folderFilter.isEmpty()));
  button.setAttribute('aria-label', tw('Filter by folder'));
  button.title = tw('Filter by folder');
  button.appendChild(icon('filter'));
  const menu = el('div', 'folder-menu');
  menu.setAttribute('role', 'menu');
  menu.hidden = true;
  wireFolderFilter(button, menu);
  group.appendChild(button);
  group.appendChild(menu);
  return group;
}

/**
 * Build the persistent toolbar (search box + folder filter + layout toggle).
 *
 * This element is created once on the initial mount and then reused across
 * every subsequent render, so the live search input keeps its focus and caret
 * position even when a render arrives mid-typing (e.g. a spec file changed).
 * @returns The toolbar element.
 */
function renderToolbar(): HTMLElement {
  const toolbar = el('div', 'toolbar');
  toolbar.appendChild(renderSearch());
  toolbar.appendChild(renderFolderFilter());
  const toggles = el('div', 'layout-toggles');
  toggles.setAttribute('role', 'group');
  toggles.setAttribute('aria-label', tw('Dashboard layout'));
  toggles.appendChild(renderLayoutToggle());
  toolbar.appendChild(toggles);
  return toolbar;
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
  applyLayoutToggle(node, layoutToggleView.describeToggle(state.layout));
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
  const active = !state.folderFilter.isEmpty();
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
  const [active, done] = partition(filtered());
  const activeGroup = renderGroup(tw('Active specs'), active);
  const doneGroup = renderGroup(tw('Completed specs'), done);
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
  app.appendChild(renderGlobalStats(state.globalTaskStats));
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
  strip?.replaceWith(renderGlobalStats(state.globalTaskStats));
}

/**
 * Replace the stats region and global-stats strip of the live dashboard in
 * place.
 * @param app The app root hosting the stats regions.
 */
function replaceStats(app: HTMLElement): void {
  const stats = app.querySelector('.stats');
  stats?.replaceWith(renderStats(state.stats));
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

/** Whether a `render` has been applied, so a late `strings` message can redraw. */
let hasRendered = false;
/**
 * Adopt the translated catalogue the host posted and rebuild the UI in that
 * language. The persistent toolbar is dropped so it is rebuilt with the new
 * strings; a first `render` after this message builds it directly translated.
 * @param messages The translated templates keyed by English message.
 */
function applyStrings(messages: Readonly<Record<string, string>>): void {
  translator = new CatalogTranslator(messages);
  statToggleView = new SpecStatToggleView(translator);
  layoutToggleView = new SpecLayoutToggleView(translator);
  const app = document.getElementById('app');
  if (null === app) {
    return;
  }
  app.replaceChildren();
  if (hasRendered) {
    render();
  }
}
/**
 * Apply a full `render` message: store the new state and redraw.
 * @param message The render message.
 */
function applyRender(message: IRenderMessage): void {
  state.cards = message.cards;
  state.stats = message.stats;
  state.globalTaskStats = message.globalTaskStats;
  // A full re-render means the specs were re-discovered (workspace change, a
  // entry document added), so clear the hover request gate and cache: a
  // later hover can retry a spec whose reply was lost or whose entry document
  // appeared after the first hover.
  hoverController.reset();
  hasRendered = true;
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
    state.stats = message.stats;
    state.globalTaskStats = message.globalTaskStats;
    // The entry document may have changed (`.config.kiro`, `bugfix.md` added):
    // drop this card's hover caches so the next hover re-asks the host.
    hoverController.invalidate(message.card.folderPath);
    applySpecUpdate(message.card);
    return;
  }
  if ('toggleLayout' === message.type) {
    state.layout = 'list' === state.layout ? 'grid' : 'list';
    persistState();
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
