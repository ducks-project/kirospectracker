import { SpecStatus } from '../../../src/core/model/SpecStatus';
import type { IDashboardScenario } from './run-dashboard-scenario';
import {
  GLOBAL_TASK_STATS,
  generatedCards,
  progress,
  renderMessage,
  statsOf,
} from './dashboard-card-fixtures';
import { MARKED_CATALOG, stringsMessage } from './strings-messages';

/** Number of cards of the cost scenario. */
const LARGE_CARD_COUNT = 500;

/**
 * Scenario counting `createElement`/`createElementNS` calls for 500 cards, then
 * for a targeted update, a regrouping update, a search and a language switch.
 * The counts are a deterministic proxy for rendering cost: they are expected to
 * stay exactly equal across a refactor.
 */
export const RENDERING_COST_SCENARIOS: readonly IDashboardScenario[] = [
  {
    name: 'rendering-cost-500-cards',
    fullDom: false,
    run: (d) => {
      const cards = generatedCards(LARGE_CARD_COUNT);
      d.noteCreationCost('boot');
      d.post(renderMessage(cards));
      d.noteCreationCost('first render of 500 cards');
      d.post(renderMessage(cards));
      d.noteCreationCost('second render of the same 500 cards');
      const target = cards.find((card) => SpecStatus.InProgress === card.status);
      if (undefined === target) {
        throw new Error('The generated set has no in-progress card');
      }
      const updated = { ...target, progress: progress({ requiredDone: 9 }) };
      const message = {
        type: 'specUpdated',
        card: updated,
        stats: statsOf(cards),
        globalTaskStats: GLOBAL_TASK_STATS,
      };
      const before = d.cardNodes();
      d.post(message);
      d.noteCreationCost('specUpdated, same group');
      d.noteNodeReuseCounts(before, 'card nodes after the same-group update');
      const regrouped = { ...target, status: SpecStatus.Completed };
      const beforeRegroup = d.cardNodes();
      d.post({ ...message, card: regrouped });
      d.noteCreationCost('specUpdated, active to completed');
      d.noteNodeReuseCounts(beforeRegroup, 'card nodes after the regrouping update');
      d.type(d.query('input.search'), 'spec-00');
      d.noteCreationCost('search "spec-00"');
      d.type(d.query('input.search'), '');
      d.noteCreationCost('search cleared');
      d.post(stringsMessage('fr', MARKED_CATALOG));
      d.noteCreationCost('strings (fr) after the render');
      d.checkpoint('after the cost measurements');
    },
  },
];
