import type {
  DashboardInboundMessage,
  DashboardLayout,
  DashboardOutboundMessage,
  SpecDocumentKind,
} from '../core/model/IDashboardMessage';
import type { ISpecSnapshot } from '../core/model/ISpecSnapshot';
import type { ISpecStats } from '../core/model/ISpecStats';
import { planDashboardRender } from './DashboardRenderPlanner';

/** Minimal shape of the VS Code webview API injected into the global scope. */
interface IWebviewApi {
  postMessage(message: DashboardInboundMessage): void;
  getState(): { layout?: DashboardLayout } | undefined;
  setState(state: { layout: DashboardLayout }): void;
}

declare function acquireVsCodeApi(): IWebviewApi;

/** Percentage multiplier for the required ratio. */
const PERCENT = 100;

/** Document links rendered per spec, in display order. */
const DOCUMENT_KINDS: readonly SpecDocumentKind[] = ['requirements', 'design', 'tasks', 'notes'];

const vscodeApi = acquireVsCodeApi();

/** Current render state kept between messages. */
const state: {
  snapshots: readonly ISpecSnapshot[];
  stats: ISpecStats;
  query: string;
  layout: DashboardLayout;
} = {
  snapshots: [],
  stats: { total: 0, completed: 0, inProgress: 0, notStarted: 0, malformed: 0 },
  query: '',
  layout: vscodeApi.getState()?.layout ?? 'list',
};

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

/**
 * Render the aggregate statistics header.
 * @param stats The aggregate counts.
 * @returns The header element.
 */
function renderStats(stats: ISpecStats): HTMLElement {
  const header = el('section', 'stats');
  const entries: ReadonlyArray<readonly [string, number]> = [
    ['Completed', stats.completed],
    ['In progress', stats.inProgress],
    ['Not started', stats.notStarted],
    ['Malformed', stats.malformed],
  ];
  entries.forEach(([label, value]) => {
    const card = el('div', 'stat');
    card.appendChild(el('span', 'stat-value', String(value)));
    card.appendChild(el('span', 'stat-label', label));
    header.appendChild(card);
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
 * @param snapshot The spec snapshot.
 * @returns The links container element.
 */
function renderLinks(snapshot: ISpecSnapshot): HTMLElement {
  const links = el('div', 'links');
  DOCUMENT_KINDS.forEach((kind) => {
    const present = Boolean(snapshot.documents[kind]);
    const link = el('button', present ? 'link' : 'link disabled', kind);
    if (present) {
      link.addEventListener('click', () =>
        vscodeApi.postMessage({
          type: 'openDocument',
          folderPath: snapshot.folderPath,
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
 * @param snapshot The spec snapshot.
 * @returns The button element.
 */
function renderRunButton(snapshot: ISpecSnapshot): HTMLElement {
  const run = el('button', 'run', 'Run tasks');
  if ('Malformed' === snapshot.status) {
    run.setAttribute('disabled', 'true');
    run.title = 'A malformed spec cannot be run';
    return run;
  }
  run.addEventListener('click', () =>
    vscodeApi.postMessage({ type: 'runTasks', folderPath: snapshot.folderPath }),
  );
  return run;
}

/**
 * Render one spec card.
 * @param snapshot The spec snapshot.
 * @returns The card element.
 */
function renderCard(snapshot: ISpecSnapshot): HTMLElement {
  const card = el('article', `card status-${snapshot.status}`);
  card.appendChild(el('h2', 'card-title', snapshot.name));
  card.appendChild(el('span', 'card-status', snapshot.status));
  const { progress } = snapshot;
  card.appendChild(
    renderProgress(
      'Required',
      progress.requiredDone,
      progress.requiredTotal,
      progress.requiredRatio,
    ),
  );
  card.appendChild(
    renderProgress(
      'Optional',
      progress.optionalDone,
      progress.optionalTotal,
      progress.optionalRatio,
    ),
  );
  card.appendChild(renderLinks(snapshot));
  card.appendChild(renderRunButton(snapshot));
  return card;
}

/**
 * Filter snapshots by the current search query (case-insensitive name match).
 * @returns The filtered snapshots.
 */
function filtered(): readonly ISpecSnapshot[] {
  const query = state.query.trim().toLowerCase();
  if (0 === query.length) {
    return state.snapshots;
  }
  return state.snapshots.filter((snapshot) => snapshot.name.toLowerCase().includes(query));
}

/**
 * Split snapshots into active and completed groups, completed kept visible but
 * set apart.
 * @param snapshots The snapshots to split.
 * @returns A tuple of active and completed snapshots.
 */
function partition(
  snapshots: readonly ISpecSnapshot[],
): readonly [readonly ISpecSnapshot[], readonly ISpecSnapshot[]] {
  const isDone = (status: string): boolean => 'Completed' === status || 'FullyCompleted' === status;
  return [
    snapshots.filter((snapshot) => !isDone(snapshot.status)),
    snapshots.filter((snapshot) => isDone(snapshot.status)),
  ];
}

/**
 * Render a grouped section of spec cards.
 * @param title Section title.
 * @param snapshots Snapshots in the section.
 * @returns The section element, or `undefined` when empty.
 */
function renderGroup(title: string, snapshots: readonly ISpecSnapshot[]): HTMLElement | undefined {
  if (0 === snapshots.length) {
    return undefined;
  }
  const section = el('section', `group layout-${state.layout}`);
  section.appendChild(el('h1', 'group-title', title));
  const grid = el('div', `cards layout-${state.layout}`);
  snapshots.forEach((snapshot) => grid.appendChild(renderCard(snapshot)));
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
 * Build the persistent toolbar (search box + layout toggle).
 *
 * This element is created once on the initial mount and then reused across
 * every subsequent render, so the live search input keeps its focus and caret
 * position even when a render arrives mid-typing (e.g. a spec file changed).
 * @returns The toolbar element.
 */
function renderToolbar(): HTMLElement {
  const toolbar = el('div', 'toolbar');
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Search specs by name';
  search.value = state.query;
  search.className = 'search';
  search.addEventListener('input', () => {
    state.query = search.value;
    rerender();
  });
  const toggle = el('button', 'toggle', 'list' === state.layout ? 'Grid view' : 'List view');
  toggle.addEventListener('click', () => {
    state.layout = 'list' === state.layout ? 'grid' : 'list';
    vscodeApi.setState({ layout: state.layout });
    vscodeApi.postMessage({ type: 'setLayout', layout: state.layout });
    rerender();
  });
  toolbar.appendChild(search);
  toolbar.appendChild(toggle);
  return toolbar;
}

/**
 * Update the label of the persistent layout toggle to match the current layout.
 * @param app The app root hosting the toolbar.
 */
function syncToggleLabel(app: HTMLElement): void {
  const toggle = app.querySelector('.toolbar .toggle');
  if (null === toggle) {
    return;
  }
  toggle.textContent = 'list' === state.layout ? 'Grid view' : 'List view';
}

/**
 * Build the spec groups for the current filter into the content container.
 * @param content The content container to populate.
 */
function renderContent(content: HTMLElement): void {
  content.replaceChildren();
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

window.addEventListener('message', (event: MessageEvent<DashboardOutboundMessage>) => {
  const message = event.data;
  if ('render' === message.type) {
    state.snapshots = message.snapshots;
    state.stats = message.stats;
    render();
    return;
  }
  if ('toggleLayout' === message.type) {
    state.layout = 'list' === state.layout ? 'grid' : 'list';
    vscodeApi.setState({ layout: state.layout });
    render();
  }
});

render();
