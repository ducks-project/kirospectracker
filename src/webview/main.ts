import type {
  DashboardLayout,
  DashboardOutboundMessage,
  IRenderMessage,
  SpecDocumentKind,
} from '../core/model/IDashboardMessage';
import type { ISpecCardView } from '../core/model/ISpecCardView';
import type { RunScope } from '../core/ports/ISpecAgentGateway';
import type { SpecFilterKey } from '../core/model/SpecFilterKey';
import type { ISpecLayoutToggleView } from '../core/status/SpecLayoutToggleView';
import type { ISpecFolderToggleView } from '../core/status/SpecFolderToggleView';
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
import { appendCardProgress, renderLinks } from './card/SpecCardView';
import { buildBadgeModel, buildOwnerModel } from './card/CardViewModel';
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
 * Toggle a status filter key, persist the new set and re-render.
 * @param key The filter key to toggle.
 */
function toggleStatusFilter(key: SpecFilterKey): void {
  store.toggleStatusFilter(key);
  rerender();
}

/** Dashboard intents handed to the extracted views. */
const actions: IDashboardActions = {
  toggleStatusFilter: (key) => toggleStatusFilter(key),
  post: (message) => vscodeApi.postMessage(message),
};

/**
 * Toggle a folder filter key, persist the new set and re-render. Shared by the
 * search-box folder menu and the clickable card folder label so both stay in
 * sync over the same {@link SpecFolderFilter}.
 * @param key The stable folder key to toggle.
 */
function toggleFolderFilter(key: string): void {
  store.toggleFolderFilter(key);
  rerender();
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
  const model = buildBadgeModel(card, store.filter, text);
  const badge = el('button', model.cssClass, model.label);
  badge.setAttribute('type', 'button');
  badge.setAttribute('aria-pressed', String(model.pressed));
  badge.setAttribute('aria-label', model.ariaLabel);
  badge.title = model.ariaLabel;
  badge.addEventListener('click', (event) => {
    // The badge is an inner control: stop the click from also triggering the
    // card-body open gesture.
    event.stopPropagation();
    toggleStatusFilter(model.key);
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
    dropdownItem(text.t('Run required tasks'), () => {
      closeMenu();
      postRunTasks(card, 'required');
    }),
  );
  menu.appendChild(
    dropdownItem(text.t('Run required and optional tasks'), () => {
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
  group.title = text.t('A malformed spec cannot be run');
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
  const primary = el('button', 'run run-primary', text.t('Run tasks'));
  primary.setAttribute('type', 'button');
  primary.setAttribute('aria-label', text.t('Run required tasks for {0}', card.name));
  const toggle = el('button', 'run run-toggle', '\u25BE');
  toggle.setAttribute('type', 'button');
  toggle.setAttribute('aria-haspopup', 'true');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', text.t('Choose run scope for {0}', card.name));
  if ('Malformed' === card.status) {
    return disabledRunSplit(primary, toggle);
  }
  const group = el('div', 'run-split');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', text.t('Run tasks for {0}', card.name));
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
  const sync = el('button', 'run sync', text.t('Sync Files'));
  sync.setAttribute('type', 'button');
  sync.setAttribute('aria-label', text.t('Sync files for {0}', card.name));
  if ('Malformed' === card.status) {
    sync.setAttribute('disabled', 'true');
    sync.title = text.t('A malformed spec cannot be synced');
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
  const row = el('div', 'actions');
  row.appendChild(renderSyncButton(card));
  row.appendChild(renderRunButton(card));
  return row;
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
  article.setAttribute('aria-label', text.t('Open {0} for {1}', entry, card.name));
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
  const model = buildOwnerModel(card, store.folderFilter, text);
  const owner = el('button', 'card-owner', card.ownerLabel);
  owner.setAttribute('type', 'button');
  owner.setAttribute('aria-pressed', String(model.pressed));
  owner.setAttribute('aria-label', model.ariaLabel);
  owner.title = model.ariaLabel;
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
  appendCardProgress(article, card, text);
  const links = renderLinks(card, actions);
  if (undefined !== links) {
    article.appendChild(links);
  }
  article.appendChild(renderActions(card));
  wireCardBody(article, card);
  return article;
}

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
  if (!store.selectLayout(layout)) {
    return;
  }
  vscodeApi.postMessage({ type: 'setLayout', layout: store.layout });
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
  const toggle = text.layoutToggle.describeToggle(store.layout);
  applyLayoutToggle(button, toggle);
  button.addEventListener('click', () =>
    selectLayout(text.layoutToggle.describeToggle(store.layout).nextLayout),
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
  search.placeholder = text.t('Search specs by name');
  search.value = store.query;
  search.className = 'search';
  search.addEventListener('input', () => {
    store.setQuery(search.value);
    rerender();
  });
  const clear = el('button', 'search-clear');
  clear.setAttribute('type', 'button');
  clear.setAttribute('aria-label', text.t('Clear search'));
  clear.title = text.t('Clear search');
  clear.appendChild(icon('close'));
  clear.addEventListener('click', () => {
    store.setQuery('');
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
  const items: readonly ISpecFolderToggleView[] = text.folderToggles.build(
    store.cards,
    store.folderFilter,
  );
  if (0 === items.length) {
    const empty = el('span', 'folder-menu-empty', text.t('No folders to filter'));
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
  button.setAttribute('aria-pressed', String(!store.folderFilter.isEmpty()));
  button.setAttribute('aria-label', text.t('Filter by folder'));
  button.title = text.t('Filter by folder');
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
  toggles.setAttribute('aria-label', text.t('Dashboard layout'));
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
  const next = renderCard(card);
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
