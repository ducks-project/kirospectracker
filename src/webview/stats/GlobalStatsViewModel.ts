import type { IGlobalTaskStats } from '../../core/model/IGlobalTaskStats';
import type { IViewText } from '../state/IViewText';

/** Percentage multiplier for the required ratio. */
const PERCENT = 100;

/** One labelled item of the global-stats strip. */
export interface IGlobalStatItem {
  /** Extra class applied to the item for its state color. */
  readonly cssClass: string;
  /** The human-readable state label. */
  readonly label: string;
  /** The text of the count (or percentage) to show. */
  readonly value: string;
}
/** Display model of the compact global task-statistics strip. */
export interface IGlobalStatsModel {
  /** Done, cancelled, in-progress, to-do and overall-resolved items, in display order. */
  readonly items: readonly IGlobalStatItem[];
}
/**
 * Build the display model of the global task-statistics strip.
 * @param stats The aggregate global task stats.
 * @param text The webview translation surface.
 * @returns The items in display order, the overall percentage last.
 */
export function buildGlobalStatsModel(stats: IGlobalTaskStats, text: IViewText): IGlobalStatsModel {
  const percent = Math.round(stats.percentComplete * PERCENT);
  return {
    items: [
      {
        cssClass: 'global-stat-done',
        label: text.tp('done|done', stats.done),
        value: `${stats.done}`,
      },
      {
        cssClass: 'global-stat-cancelled',
        label: text.tp('cancelled|cancelled', stats.cancelled),
        value: `${stats.cancelled}`,
      },
      {
        cssClass: 'global-stat-inProgress',
        label: text.t('in progress'),
        value: `${stats.inProgress}`,
      },
      { cssClass: 'global-stat-todo', label: text.t('to-do'), value: `${stats.todo}` },
      {
        cssClass: 'global-stat-overall',
        label: text.t('resolved'),
        value: text.t('{0}%', percent),
      },
    ],
  };
}
