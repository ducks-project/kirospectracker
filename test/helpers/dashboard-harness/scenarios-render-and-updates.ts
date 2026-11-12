import { SpecStatus } from '../../../src/core/model/SpecStatus';
import type { ISpecCardView } from '../../../src/core/model/ISpecCardView';
import type { DashboardDriver } from './DashboardDriver';
import type { IDashboardScenario } from './run-dashboard-scenario';
import {
  ALPHA,
  BETA,
  FULL_CARDS,
  GAMMA,
  GLOBAL_TASK_STATS,
  SMALL_CARDS,
  card,
  FOLDER_B,
  progress,
  renderMessage,
  statsOf,
} from './dashboard-card-fixtures';

/**
 * Build a `specUpdated` message that replaces one card of a card set.
 * @param cards The cards currently known by the dashboard.
 * @param updated The new version of one card.
 * @returns The message, with stats recomputed over the resulting set.
 */
function specUpdated(cards: readonly ISpecCardView[], updated: ISpecCardView): object {
  const next = cards.map((existing) =>
    existing.folderPath === updated.folderPath ? updated : existing,
  );
  return {
    type: 'specUpdated',
    card: updated,
    stats: statsOf(next),
    globalTaskStats: { ...GLOBAL_TASK_STATS, done: GLOBAL_TASK_STATS.done + 1 },
  };
}

/**
 * Play a `specUpdated` and record which card nodes survived.
 * @param d The driver.
 * @param cards The cards currently known.
 * @param updated The new version of one card.
 * @param label Checkpoint label.
 */
function updateAndObserve(
  d: DashboardDriver,
  cards: readonly ISpecCardView[],
  updated: ISpecCardView,
  label: string,
): void {
  const before = d.cardNodes();
  d.post(specUpdated(cards, updated));
  d.noteNodeReuse(before, `${label}: card nodes`);
  d.checkpoint(label);
}

/** The alpha spec after more tasks were completed (same status, same group). */
const ALPHA_PROGRESSED = {
  ...ALPHA,
  progress: progress({ requiredDone: 5, requiredCancelled: 1, requiredTodo: 1 }),
};
/** The alpha spec once every task is resolved. */
const ALPHA_COMPLETED = {
  ...ALPHA,
  status: SpecStatus.Completed,
  progress: progress({ requiredDone: 7, requiredCancelled: 1 }),
};
/** The gamma spec re-opened by a new task. */
const GAMMA_REOPENED = {
  ...GAMMA,
  status: SpecStatus.InProgress,
  progress: progress({ requiredDone: 5, requiredTodo: 1 }),
};
/** A card the dashboard has never been told about. */
const NEWCOMER = card({
  name: 'newcomer',
  folder: FOLDER_B,
  status: SpecStatus.NotStarted,
  docs: ['tasks'],
  entry: 'tasks',
  counts: { requiredTodo: 1 },
});

/** Scenarios about full renders and targeted `specUpdated` updates. */
export const RENDER_AND_UPDATE_SCENARIOS: readonly IDashboardScenario[] = [
  {
    name: 'render-full-fixture',
    run: (d) => {
      d.post(renderMessage(FULL_CARDS));
      d.checkpoint('render: every status, malformed, no entry document, two folders');
    },
  },
  {
    name: 'render-no-specs',
    run: (d) => {
      d.post(
        renderMessage([], {
          ...GLOBAL_TASK_STATS,
          done: 0,
          cancelled: 0,
          inProgress: 0,
          todo: 0,
          total: 0,
          percentComplete: 0,
        }),
      );
      d.checkpoint('render of an empty workspace');
    },
  },
  {
    name: 'render-twice-keeps-the-toolbar-and-search',
    run: (d) => {
      d.post(renderMessage(SMALL_CARDS));
      const search = d.query('input.search');
      search.focus();
      d.type(search, 'a');
      const toolbar = d.query('.toolbar');
      d.checkpoint('typed in the search box');
      d.post(renderMessage(FULL_CARDS));
      d.note(`toolbar node kept: ${toolbar === d.query('.toolbar')}`);
      d.note(`search node kept: ${search === d.query('input.search')}`);
      d.checkpoint('a second render rewrites stats and content but keeps the toolbar and focus');
    },
  },
  {
    name: 'spec-updated-replaces-a-single-node',
    run: (d) => {
      d.post(renderMessage(SMALL_CARDS));
      updateAndObserve(d, SMALL_CARDS, ALPHA_PROGRESSED, 'same group: one node replaced');
    },
  },
  {
    name: 'spec-updated-active-to-completed-rebuilds-content',
    run: (d) => {
      d.post(renderMessage(SMALL_CARDS));
      updateAndObserve(d, SMALL_CARDS, ALPHA_COMPLETED, 'active to completed: content rebuilt');
    },
  },
  {
    name: 'spec-updated-completed-to-active-rebuilds-content',
    run: (d) => {
      d.post(renderMessage(SMALL_CARDS));
      updateAndObserve(d, SMALL_CARDS, GAMMA_REOPENED, 'completed to active: content rebuilt');
    },
  },
  {
    name: 'spec-updated-of-a-filtered-out-card',
    run: (d) => {
      d.post(renderMessage(SMALL_CARDS));
      d.type(d.query('input.search'), 'alp');
      d.checkpoint('search keeps only alpha');
      const moved = { ...BETA, progress: progress({ requiredDone: 1, requiredTodo: 3 }) };
      updateAndObserve(d, SMALL_CARDS, moved, 'update of a card that is not mounted');
    },
  },
  {
    name: 'spec-updated-of-an-unknown-card',
    run: (d) => {
      d.post(renderMessage(SMALL_CARDS));
      updateAndObserve(d, SMALL_CARDS, NEWCOMER, 'unknown card: stats update, cards unchanged');
    },
  },
  {
    name: 'spec-updated-before-the-first-render',
    run: (d) => {
      d.post(specUpdated([ALPHA], ALPHA_PROGRESSED));
      d.checkpoint('specUpdated with an empty dashboard mounts the shell');
      d.post(renderMessage(SMALL_CARDS));
    },
  },
  {
    name: 'toggle-layout-message',
    run: (d) => {
      d.post(renderMessage(SMALL_CARDS));
      d.checkpoint('list layout', '.toolbar .layout-toggles');
      d.post({ type: 'toggleLayout' });
      d.checkpoint(
        'host toggled to grid: persisted, not posted',
        '.toolbar .layout-toggles',
        '.content .group',
      );
      d.post({ type: 'toggleLayout' });
      d.checkpoint('host toggled back to list');
    },
  },
  {
    name: 'toggle-layout-message-before-render',
    run: (d) => {
      d.post({ type: 'toggleLayout' });
      d.checkpoint('toggleLayout with an empty dashboard persists and mounts the shell');
      d.post(renderMessage(SMALL_CARDS));
    },
  },
];
