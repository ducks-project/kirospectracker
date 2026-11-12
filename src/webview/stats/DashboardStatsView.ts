import type { IGlobalTaskStats } from '../../core/model/IGlobalTaskStats';
import type { ISpecStats } from '../../core/model/ISpecStats';
import type { SpecStatusFilter } from '../../core/status/SpecStatusFilter';
import type { SpecStatToggleView, ISpecStatToggleView } from '../../core/status/SpecStatToggleView';
import { buttonEl, el, setToggleState } from '../createElement';
import type { IDashboardActions } from '../state/IDashboardActions';
import type { IViewText } from '../state/IViewText';
import type { IGlobalStatItem } from './GlobalStatsViewModel';
import { buildGlobalStatsModel } from './GlobalStatsViewModel';

/**
 * Render one clickable statistic toggle as an accessible pressed-state button.
 * @param toggle The stat toggle view (key, label, value, pressed).
 * @param text The webview translation surface.
 * @param actions The dashboard intents.
 * @returns The button element.
 */
function renderStatToggle(
  toggle: ISpecStatToggleView,
  text: IViewText,
  actions: IDashboardActions,
): HTMLElement {
  const button = buttonEl(toggle.pressed ? 'stat pressed' : 'stat');
  setToggleState(button, toggle.pressed, text.t('Filter by {0}', toggle.label));
  button.appendChild(el('span', 'stat-value', String(toggle.value)));
  button.appendChild(el('span', 'stat-label', toggle.label));
  button.addEventListener('click', () => actions.toggleStatusFilter(toggle.key));
  return button;
}

/**
 * Render the aggregate statistics header as additive toggle filters.
 * @param stats The aggregate counts.
 * @param filter The active status filter.
 * @param statToggles The live stat-toggle projector (rebuilt when the strings arrive).
 * @param text The webview translation surface.
 * @param actions The dashboard intents.
 * @returns The header element.
 */
export function renderStats(
  stats: ISpecStats,
  filter: SpecStatusFilter,
  statToggles: SpecStatToggleView,
  text: IViewText,
  actions: IDashboardActions,
): HTMLElement {
  const header = el('section', 'stats');
  header.setAttribute('role', 'group');
  header.setAttribute('aria-label', text.t('Filter specs by status'));
  statToggles.build(stats, filter).forEach((toggle) => {
    header.appendChild(renderStatToggle(toggle, text, actions));
  });
  return header;
}

/**
 * Append one labelled item to the global-stats strip.
 * @param strip The strip element to append to.
 * @param item The item to show.
 */
function appendGlobalStatItem(strip: HTMLElement, item: IGlobalStatItem): void {
  const node = el('span', `global-stat ${item.cssClass}`);
  node.appendChild(el('span', 'global-stat-value', item.value));
  node.appendChild(el('span', 'global-stat-label', item.label));
  strip.appendChild(node);
}
/**
 * Render the compact global task-statistics strip.
 *
 * It is a single discreet line summarising the aggregate leaf tasks across
 * every spec (done, cancelled, in-progress, to-do) plus the overall resolved
 * percentage. It is intentionally non-dominating: a small strip, not a header.
 * @param stats The aggregate global task stats.
 * @param text The webview translation surface.
 * @returns The strip element.
 */
export function renderGlobalStats(stats: IGlobalTaskStats, text: IViewText): HTMLElement {
  const model = buildGlobalStatsModel(stats, text);
  const strip = el('section', 'global-stats');
  strip.setAttribute('aria-label', text.t('Global task statistics'));
  model.items.forEach((item) => appendGlobalStatItem(strip, item));
  return strip;
}
