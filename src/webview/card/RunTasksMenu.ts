import type { ISpecCardView } from '../../core/model/ISpecCardView';
import type { RunScope } from '../../core/ports/ISpecAgentGateway';
import { el } from '../createElement';
import type { IDashboardActions } from '../state/IDashboardActions';
import type { IViewText } from '../state/IViewText';
import { MENU_TOGGLE_KEYS } from '../activationKeys';

/**
 * Post a scoped run-tasks intent for a spec.
 * @param actions The dashboard intents.
 * @param card The spec card view.
 * @param scope The run scope.
 */
function postRunTasks(actions: IDashboardActions, card: ISpecCardView, scope: RunScope): void {
  actions.post({ type: 'runTasks', folderPath: card.folderPath, scope });
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
 * @param text The webview translation surface.
 * @param actions The dashboard intents.
 */
function buildRunMenu(
  menu: HTMLElement,
  card: ISpecCardView,
  closeMenu: () => void,
  text: IViewText,
  actions: IDashboardActions,
): void {
  menu.setAttribute('role', 'menu');
  menu.hidden = true;
  menu.appendChild(
    dropdownItem(text.t('Run required tasks'), () => {
      closeMenu();
      postRunTasks(actions, card, 'required');
    }),
  );
  menu.appendChild(
    dropdownItem(text.t('Run required and optional tasks'), () => {
      closeMenu();
      postRunTasks(actions, card, 'required-and-optional');
    }),
  );
}

/**
 * Build a split button disabled because the spec is malformed.
 * @param primary The primary action button.
 * @param toggle The dropdown toggle button.
 * @param text The webview translation surface.
 * @returns The disabled split-button group.
 */
function disabledRunSplit(primary: HTMLElement, toggle: HTMLElement, text: IViewText): HTMLElement {
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
 * @param text The webview translation surface.
 * @param actions The dashboard intents.
 */
function wireRunSplit(
  card: ISpecCardView,
  primary: HTMLElement,
  toggle: HTMLElement,
  menu: HTMLElement,
  text: IViewText,
  actions: IDashboardActions,
): void {
  const setExpanded = (open: boolean): void => {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  };
  buildRunMenu(menu, card, () => setExpanded(false), text, actions);
  primary.addEventListener('click', (event) => {
    // Inner control: do not also trigger the card-body open gesture.
    event.stopPropagation();
    postRunTasks(actions, card, 'required');
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
  if (!MENU_TOGGLE_KEYS.has(event.key)) {
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
 * @param text The webview translation surface.
 * @param actions The dashboard intents.
 * @returns The split-button element.
 */
function renderRunButton(
  card: ISpecCardView,
  text: IViewText,
  actions: IDashboardActions,
): HTMLElement {
  const primary = el('button', 'run run-primary', text.t('Run tasks'));
  primary.setAttribute('type', 'button');
  primary.setAttribute('aria-label', text.t('Run required tasks for {0}', card.name));
  const toggle = el('button', 'run run-toggle', '\u25BE');
  toggle.setAttribute('type', 'button');
  toggle.setAttribute('aria-haspopup', 'true');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', text.t('Choose run scope for {0}', card.name));
  if ('Malformed' === card.status) {
    return disabledRunSplit(primary, toggle, text);
  }
  const group = el('div', 'run-split');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', text.t('Run tasks for {0}', card.name));
  const menu = el('div', 'run-menu');
  wireRunSplit(card, primary, toggle, menu, text, actions);
  group.appendChild(primary);
  group.appendChild(toggle);
  group.appendChild(menu);
  return group;
}

/**
 * Render the "Sync Files" button for a spec, disabled for a malformed spec.
 * @param card The spec card view.
 * @param text The webview translation surface.
 * @param actions The dashboard intents.
 * @returns The button element.
 */
function renderSyncButton(
  card: ISpecCardView,
  text: IViewText,
  actions: IDashboardActions,
): HTMLElement {
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
    actions.post({ type: 'syncFiles', folderPath: card.folderPath });
  });
  return sync;
}

/**
 * Render the task-action row (Sync Files + the Run tasks split button).
 * @param card The spec card view.
 * @param text The webview translation surface.
 * @param actions The dashboard intents.
 * @returns The action-row element.
 */
export function renderActions(
  card: ISpecCardView,
  text: IViewText,
  actions: IDashboardActions,
): HTMLElement {
  const row = el('div', 'actions');
  row.appendChild(renderSyncButton(card, text, actions));
  row.appendChild(renderRunButton(card, text, actions));
  return row;
}
