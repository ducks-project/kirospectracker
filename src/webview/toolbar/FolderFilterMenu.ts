import type { ISpecFolderToggleView } from '../../core/status/SpecFolderToggleView';
import { el } from '../createElement';
import { icon } from '../ToolbarIcon';
import type { IToolbarDeps } from './IToolbarDeps';
import { MENU_TOGGLE_KEYS } from '../activationKeys';

/**
 * Populate the folder-filter menu with one accessible toggle item per distinct
 * spec-owning folder, rebuilt from the current cards and folder filter.
 *
 * The menu is (re)filled every time it opens, so it always reflects the folders
 * currently loaded and their pressed state without rebuilding the persistent
 * toolbar. An empty-folder case shows a discreet, non-interactive hint.
 * @param menu The menu element to populate.
 * @param closeMenu Callback hiding the menu after an item activates.
 * @param deps The toolbar dependencies.
 */
function buildFolderMenu(menu: HTMLElement, closeMenu: () => void, deps: IToolbarDeps): void {
  menu.replaceChildren();
  const items: readonly ISpecFolderToggleView[] = deps.text.folderToggles.build(
    deps.store.cards,
    deps.store.folderFilter,
  );
  if (0 === items.length) {
    const empty = el('span', 'folder-menu-empty', deps.text.t('No folders to filter'));
    menu.appendChild(empty);
    return;
  }
  items.forEach((item) => menu.appendChild(folderMenuItem(item, closeMenu, deps)));
}

/**
 * Build one keyboard-accessible folder-filter menu item.
 * @param item The folder toggle view (key, label, count, pressed).
 * @param closeMenu Callback hiding the menu after activation.
 * @param deps The toolbar dependencies.
 * @returns The menu-item button element.
 */
function folderMenuItem(
  item: ISpecFolderToggleView,
  closeMenu: () => void,
  deps: IToolbarDeps,
): HTMLElement {
  const button = el('button', item.pressed ? 'folder-menu-item pressed' : 'folder-menu-item');
  button.setAttribute('type', 'button');
  button.setAttribute('role', 'menuitemcheckbox');
  button.setAttribute('aria-checked', String(item.pressed));
  button.appendChild(el('span', 'folder-menu-label', item.label));
  button.appendChild(el('span', 'folder-menu-count', String(item.count)));
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    closeMenu();
    deps.actions.toggleFolderFilter(item.key);
  });
  return button;
}

/**
 * Wire the folder-filter button and menu to open/close by mouse and keyboard
 * (click or Enter/Space toggle, Escape closes), rebuilding the menu on each open
 * so it always reflects the current folders and their pressed state.
 * @param button The folder-filter toggle button.
 * @param menu The folder-filter dropdown menu.
 * @param deps The toolbar dependencies.
 */
function wireFolderFilter(button: HTMLElement, menu: HTMLElement, deps: IToolbarDeps): void {
  const setExpanded = (open: boolean): void => {
    if (open) {
      buildFolderMenu(menu, () => setExpanded(false), deps);
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
    if (!MENU_TOGGLE_KEYS.has(event.key)) {
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
 * @param deps The toolbar dependencies.
 * @returns The folder-filter control element.
 */
export function renderFolderFilter(deps: IToolbarDeps): HTMLElement {
  const group = el('div', 'folder-filter');
  const button = el('button', 'folder-filter-button');
  button.setAttribute('type', 'button');
  button.setAttribute('aria-haspopup', 'true');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-pressed', String(!deps.store.folderFilter.isEmpty()));
  button.setAttribute('aria-label', deps.text.t('Filter by folder'));
  button.title = deps.text.t('Filter by folder');
  button.appendChild(icon('filter'));
  const menu = el('div', 'folder-menu');
  menu.setAttribute('role', 'menu');
  menu.hidden = true;
  wireFolderFilter(button, menu, deps);
  group.appendChild(button);
  group.appendChild(menu);
  return group;
}
