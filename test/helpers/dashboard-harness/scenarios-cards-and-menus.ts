import type { DashboardDriver } from './DashboardDriver';
import type { IDashboardScenario } from './run-dashboard-scenario';
import { FULL_CARDS, renderMessage } from './dashboard-card-fixtures';

/**
 * Render the full fixture set.
 * @param d The driver.
 */
function open(d: DashboardDriver): void {
  d.post(renderMessage(FULL_CARDS));
}

/** Scenarios about the card gestures and the task-launch menus. */
export const CARD_AND_MENU_SCENARIOS: readonly IDashboardScenario[] = [
  {
    name: 'card-click-and-keyboard-open-the-entry-document',
    run: (d) => {
      open(d);
      d.click(d.card('alpha'));
      d.checkpoint('click on alpha opens its entry document (requirements)');
      d.click(d.card('eta'));
      d.checkpoint('click on eta opens bugfix');
      const enter = d.key(d.card('alpha'), 'Enter');
      const space = d.key(d.card('alpha'), ' ');
      const other = d.key(d.card('alpha'), 'a');
      d.note(
        `defaultPrevented: Enter=${enter.defaultPrevented}, Space=${space.defaultPrevented}, a=${other.defaultPrevented}`,
      );
      d.checkpoint('Enter and Space open, another key does nothing');
    },
  },
  {
    name: 'card-without-entry-document-is-inert',
    run: (d) => {
      open(d);
      d.click(d.card('epsilon'));
      d.key(d.card('zeta'), 'Enter');
      d.click(d.inside(d.card('zeta'), '.card-title'));
      d.checkpoint('disabled cards post nothing', '.card-disabled');
    },
  },
  {
    name: 'card-document-links-do-not-open-the-card',
    run: (d) => {
      open(d);
      const links = d.card('alpha').querySelectorAll('.link');
      links.forEach((link) => d.click(link));
      d.checkpoint('each link posts its own document only', '.links');
      d.key(d.queryAll('.link')[0], 'Enter');
      d.checkpoint('Enter on a link: the keydown bubbles to the card and opens the entry document');
    },
  },
  {
    name: 'card-inner-controls-stop-propagation',
    run: (d) => {
      open(d);
      d.click(d.inside(d.card('beta'), '.sync'));
      d.click(d.inside(d.card('beta'), '.run-primary'));
      d.click(d.inside(d.card('beta'), '.run-toggle'));
      d.click(d.inside(d.card('beta'), '.run-toggle'));
      d.click(d.inside(d.card('alpha'), '.card-owner'));
      d.click(d.inside(d.card('alpha'), '.card-status'));
      d.checkpoint('no openDocument from inner controls');
    },
  },
  {
    name: 'task-actions-post-their-intents',
    run: (d) => {
      open(d);
      d.click(d.inside(d.card('alpha'), '.sync'));
      d.click(d.inside(d.card('alpha'), '.run-primary'));
      d.checkpoint('Sync Files and Run tasks', '.actions');
    },
  },
  {
    name: 'malformed-cards-disable-their-actions',
    run: (d) => {
      open(d);
      d.click(d.inside(d.card('epsilon'), '.sync'));
      d.click(d.inside(d.card('epsilon'), '.run-primary'));
      d.click(d.inside(d.card('theta'), '.run-toggle'));
      d.checkpoint(
        'disabled buttons post nothing and carry their tooltips',
        '.status-Malformed .actions',
      );
      d.click(d.card('theta'));
      d.checkpoint('a malformed card with an entry document still opens it');
    },
  },
  {
    name: 'run-menu-mouse',
    run: (d) => {
      open(d);
      d.click(d.inside(d.card('alpha'), '.run-toggle'));
      d.checkpoint('menu of alpha opened', '.status-InProgress .run-split');
      d.click(d.inside(d.card('beta'), '.run-toggle'));
      d.checkpoint('opening a second menu leaves the first open', '.run-split');
      d.click(d.document.body);
      d.checkpoint('click outside closes every open menu', '.run-split');
      d.click(d.inside(d.card('alpha'), '.run-toggle'));
      d.click(d.queryAll('.run-menu-item')[0]);
      d.checkpoint('"Run required tasks": posted and menu closed', '.run-split');
      d.click(d.inside(d.card('alpha'), '.run-toggle'));
      d.click(d.queryAll('.run-menu-item')[1]);
      d.checkpoint('"Run required and optional tasks": posted and menu closed', '.run-split');
      d.click(d.inside(d.card('alpha'), '.run-toggle'));
      d.click(d.inside(d.card('alpha'), '.run-toggle'));
      d.checkpoint('second click on the toggle closes the menu', '.run-split');
    },
  },
  {
    name: 'run-menu-keyboard',
    run: (d) => {
      open(d);
      const toggle = (): ReturnType<DashboardDriver['query']> =>
        d.inside(d.card('alpha'), '.run-toggle');
      const enter = d.key(toggle(), 'Enter');
      d.note(`Enter default prevented: ${enter.defaultPrevented}`);
      d.checkpoint('Enter opens', '.status-InProgress .run-split');
      d.key(toggle(), ' ');
      d.checkpoint('Space closes', '.status-InProgress .run-split');
      d.key(toggle(), 'Enter');
      d.key(toggle(), 'Escape');
      d.checkpoint('Escape closes', '.status-InProgress .run-split');
      d.key(toggle(), 'a');
      d.checkpoint('another key does nothing', '.status-InProgress .run-split');
      d.key(toggle(), 'Enter');
      d.key(d.queryAll('.run-menu-item')[1], 'Enter');
      d.checkpoint('Enter on a menu item runs it', '.status-InProgress .run-split');
    },
  },
  {
    name: 'menus-are-independent-and-closed-by-outside-clicks',
    run: (d) => {
      open(d);
      d.click(d.query('.folder-filter-button'));
      d.click(d.inside(d.card('alpha'), '.run-toggle'));
      d.checkpoint('folder menu and a run menu both open', '.folder-filter, .run-split');
      d.click(d.inside(d.card('beta'), '.card-title'));
      d.checkpoint(
        'a click on a card closes both menus and opens that card',
        '.folder-filter, .run-split',
      );
    },
  },
];
