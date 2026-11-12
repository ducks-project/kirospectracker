import type { DashboardDriver } from './DashboardDriver';
import type { IDashboardScenario } from './run-dashboard-scenario';
import { FULL_CARDS, SMALL_CARDS, renderMessage } from './dashboard-card-fixtures';

/**
 * Boot the dashboard with a card set.
 * @param d The driver.
 * @param cards The cards to render.
 */
function open(d: DashboardDriver, cards = SMALL_CARDS): void {
  d.post(renderMessage(cards));
}

/** Scenarios about the toolbar: layout, status and folder filters, search. */
export const TOOLBAR_AND_FILTER_SCENARIOS: readonly IDashboardScenario[] = [
  {
    name: 'layout-toggle-click',
    run: (d) => {
      open(d);
      d.click(d.query('.toolbar .layout-toggles .toggle'));
      d.checkpoint(
        'click: persisted, then posted, then redrawn (grid)',
        '.toolbar .layout-toggles',
      );
      d.click(d.query('.toolbar .layout-toggles .toggle'));
      d.checkpoint('click again: back to list');
    },
  },
  {
    name: 'layout-toggle-keyboard',
    run: (d) => {
      open(d);
      const toggle = d.query('.toolbar .layout-toggles .toggle');
      d.key(toggle, 'Enter');
      d.checkpoint('Enter on the toggle');
      d.key(d.query('.toolbar .layout-toggles .toggle'), ' ');
      d.checkpoint('Space on the toggle');
      d.key(d.query('.toolbar .layout-toggles .toggle'), 'a');
      d.checkpoint('another key does nothing');
    },
  },
  {
    name: 'status-filter-stat-buttons',
    run: (d) => {
      open(d, FULL_CARDS);
      const stats = d.queryAll('.stats .stat');
      d.click(stats[0]);
      d.checkpoint('first stat toggled on', '.stats');
      d.click(d.queryAll('.stats .stat')[2]);
      d.checkpoint('third stat added (filters are additive)', '.stats');
      d.key(d.queryAll('.stats .stat')[0], 'Enter');
      d.checkpoint('Enter on the first stat toggles it off', '.stats');
      d.key(d.queryAll('.stats .stat')[2], ' ');
      d.checkpoint('Space on the third stat toggles it off', '.stats');
    },
  },
  {
    name: 'status-filter-badge-click-stays-in-sync-with-stats',
    run: (d) => {
      open(d, FULL_CARDS);
      d.click(d.inside(d.card('alpha'), '.card-status'));
      d.checkpoint('alpha badge click (does not open the card): in-progress filter on', '.stats');
      d.click(d.inside(d.card('alpha'), '.card-status'));
      d.checkpoint('alpha badge click again: filter off', '.stats');
      d.click(d.inside(d.card('beta'), '.card-status'));
      d.checkpoint('beta badge click: not-started filter on', '.stats');
    },
  },
  {
    name: 'folder-filter-menu-mouse',
    run: (d) => {
      open(d, FULL_CARDS);
      d.click(d.query('.folder-filter-button'));
      d.checkpoint('menu opened', '.folder-filter');
      d.click(d.queryAll('.folder-menu-item')[1]);
      d.checkpoint(
        'second folder chosen: menu closed, filter applied, button pressed',
        '.folder-filter',
      );
      d.click(d.query('.folder-filter-button'));
      d.checkpoint('menu reopened and rebuilt with the pressed item', '.folder-filter');
      d.click(d.document.body);
      d.checkpoint('click outside closes the menu without redrawing', '.folder-filter');
      d.click(d.query('.folder-filter-button'));
      d.click(d.query('.folder-filter-button'));
      d.checkpoint('second click on the button closes it', '.folder-filter');
    },
  },
  {
    name: 'folder-filter-menu-keyboard',
    run: (d) => {
      open(d, FULL_CARDS);
      const button = d.query('.folder-filter-button');
      const enter = d.key(button, 'Enter');
      d.note(`Enter default prevented: ${enter.defaultPrevented}`);
      d.checkpoint('Enter opens', '.folder-filter');
      const space = d.key(d.query('.folder-filter-button'), ' ');
      d.note(`Space default prevented: ${space.defaultPrevented}`);
      d.checkpoint('Space closes', '.folder-filter');
      d.key(d.query('.folder-filter-button'), 'Enter');
      d.key(d.query('.folder-filter-button'), 'Escape');
      d.checkpoint('Escape closes', '.folder-filter');
      d.key(d.query('.folder-filter-button'), 'a');
      d.checkpoint('another key does nothing', '.folder-filter');
      d.key(d.query('.folder-filter-button'), 'Enter');
      d.key(d.queryAll('.folder-menu-item')[0], 'Enter');
      d.checkpoint('Enter on an item toggles that folder', '.folder-filter');
    },
  },
  {
    name: 'folder-filter-menu-without-folders',
    run: (d) => {
      open(d, []);
      d.click(d.query('.folder-filter-button'));
      d.checkpoint('empty workspace: a discreet hint', '.folder-filter');
    },
  },
  {
    name: 'folder-filter-owner-label',
    run: (d) => {
      open(d, FULL_CARDS);
      d.click(d.inside(d.card('beta'), '.card-owner'));
      d.checkpoint('owner label of beta toggles its folder', '.folder-filter');
      d.click(d.inside(d.card('alpha'), '.card-owner'));
      d.checkpoint('toggled again (same folder): filter cleared', '.folder-filter');
    },
  },
  {
    name: 'folder-and-status-filters-compose',
    run: (d) => {
      open(d, FULL_CARDS);
      d.click(d.inside(d.card('gamma'), '.card-owner'));
      d.click(d.queryAll('.stats .stat')[0]);
      d.type(d.query('input.search'), 'a');
      d.checkpoint('folder AND status AND search');
    },
  },
  {
    name: 'search-typing-and-clearing',
    run: (d) => {
      open(d, FULL_CARDS);
      const search = d.query('input.search');
      search.focus();
      d.type(search, 'alp');
      d.checkpoint('"alp": only alpha stays, the input keeps the focus', '.search-box');
      d.type(d.query('input.search'), 'zzz');
      d.checkpoint('no match: no group at all', '.content');
      d.query('.search-clear').focus();
      d.click(d.query('.search-clear'));
      d.checkpoint('clear button: query emptied, input refocused', '.search-box');
    },
  },
  {
    name: 'search-matches-case-insensitively',
    run: (d) => {
      open(d, FULL_CARDS);
      d.type(d.query('input.search'), 'ALPHA');
      d.checkpoint('upper-case query');
    },
  },
];
