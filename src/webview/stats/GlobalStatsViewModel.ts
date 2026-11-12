import type { IGlobalTaskStats } from '../../core/model/IGlobalTaskStats';
import type { IViewText } from '../state/IViewText';

/** Percentage multiplier for the required ratio. */
const PERCENT = 100;

/** One labelled task-count item of the global-stats strip. */
export interface IGlobalStatItem {
  /** Extra class applied to the item for its state color. */
  readonly cssClass: string;
  /** The human-readable state label. */
  readonly label: string;
  /** The count to show. */
  readonly value: number;
}

/** The overall resolved-percentage item of the global-stats strip. */
export interface IGlobalStatOverall {
  /** The translated percentage text. */
  readonly valueText: string;
  /** The translated label. */
  readonly label: string;
}

/** Display model of the compact global task-statistics strip. */
export interface IGlobalStatsModel {
  /** Done, cancelled, in-progress and to-do items, in display order. */
  readonly items: readonly IGlobalStatItem[];
  /** The overall resolved percentage. */
  readonly overall: IGlobalStatOverall;
}

/**
 * Build the display model of the global task-statistics strip.
 * @param stats The aggregate global task stats.
 * @param text The webview translation surface.
 * @returns The items in display order plus the overall percentage.
 */
export function buildGlobalStatsModel(stats: IGlobalTaskStats, text: IViewText): IGlobalStatsModel {
  const percent = Math.round(stats.percentComplete * PERCENT);
  return {
    items: [
      { cssClass: 'global-stat-done', label: text.tp('done|done', stats.done), value: stats.done },
      {
        cssClass: 'global-stat-cancelled',
        label: text.tp('cancelled|cancelled', stats.cancelled),
        value: stats.cancelled,
      },
      {
        cssClass: 'global-stat-inProgress',
        label: text.t('in progress'),
        value: stats.inProgress,
      },
      { cssClass: 'global-stat-todo', label: text.t('to-do'), value: stats.todo },
    ],
    overall: { valueText: text.t('{0}%', percent), label: text.t('resolved') },
  };
}
