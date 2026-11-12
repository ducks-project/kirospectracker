import type { ISpecLayoutToggleView } from '../../core/status/SpecLayoutToggleView';
import { el } from '../createElement';
import { icon } from '../ToolbarIcon';
import { renderFolderFilter } from './FolderFilterMenu';
import type { IToolbarDeps } from './IToolbarDeps';

/**
 * Apply a single layout toggle view to a button element: its flipping glyph,
 * labels and pressed state.
 * @param button The toggle button to update.
 * @param toggle The current single-toggle view from the core mapper.
 */
export function applyLayoutToggle(button: HTMLElement, toggle: ISpecLayoutToggleView): void {
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
 * @param deps The toolbar dependencies.
 * @returns The toggle button element.
 */
function renderLayoutToggle(deps: IToolbarDeps): HTMLElement {
  const button = el('button', 'toggle');
  button.setAttribute('type', 'button');
  const toggle = deps.text.layoutToggle.describeToggle(deps.store.layout);
  applyLayoutToggle(button, toggle);
  button.addEventListener('click', () =>
    deps.actions.selectLayout(deps.text.layoutToggle.describeToggle(deps.store.layout).nextLayout),
  );
  return button;
}

/**
 * Build the search box together with its enlarged, accessible clear button.
 *
 * The clear button is a comfortably sized target (see the stylesheet): clicking
 * anywhere in it clears the query and refocuses the input, so the v0.1.1 focus
 * fix is preserved.
 * @param deps The toolbar dependencies.
 * @returns The search wrapper element.
 */
function renderSearch(deps: IToolbarDeps): HTMLElement {
  const wrapper = el('div', 'search-box');
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = deps.text.t('Search specs by name');
  search.value = deps.store.query;
  search.className = 'search';
  search.addEventListener('input', () => {
    deps.actions.setQuery(search.value);
  });
  const clear = el('button', 'search-clear');
  clear.setAttribute('type', 'button');
  clear.setAttribute('aria-label', deps.text.t('Clear search'));
  clear.title = deps.text.t('Clear search');
  clear.appendChild(icon('close'));
  clear.addEventListener('click', () => {
    search.value = '';
    search.focus();
    deps.actions.setQuery('');
  });
  wrapper.appendChild(search);
  wrapper.appendChild(clear);
  return wrapper;
}

/**
 * Build the persistent toolbar (search box + folder filter + layout toggle).
 *
 * This element is created once on the initial mount and then reused across
 * every subsequent render, so the live search input keeps its focus and caret
 * position even when a render arrives mid-typing (e.g. a spec file changed).
 * @param deps The toolbar dependencies.
 * @returns The toolbar element.
 */
export function renderToolbar(deps: IToolbarDeps): HTMLElement {
  const toolbar = el('div', 'toolbar');
  toolbar.appendChild(renderSearch(deps));
  toolbar.appendChild(renderFolderFilter(deps));
  const toggles = el('div', 'layout-toggles');
  toggles.setAttribute('role', 'group');
  toggles.setAttribute('aria-label', deps.text.t('Dashboard layout'));
  toggles.appendChild(renderLayoutToggle(deps));
  toolbar.appendChild(toggles);
  return toolbar;
}
