import type { ISpecStats } from '../model/ISpecStats';
import type { SpecFilterKey } from '../model/SpecFilterKey';
import type { SpecStatusFilter } from './SpecStatusFilter';
import { SPEC_FILTER_KEYS } from '../model/SpecFilterKey';

/** Accessible presentation of one clickable statistic toggle. */
export interface ISpecStatToggleView {
  /** The filter key this toggle activates. */
  readonly key: SpecFilterKey;
  /** Human label shown under the count (e.g. `Completed`). */
  readonly label: string;
  /** Aggregate count for this status group. */
  readonly value: number;
  /** Whether the toggle is currently active (pressed). */
  readonly pressed: boolean;
}

/** Filter-key-to-label table, in the stat header display order. */
const STAT_LABELS: Readonly<Record<SpecFilterKey, string>> = {
  completed: 'Completed',
  inProgress: 'In progress',
  notStarted: 'Not started',
  malformed: 'Malformed',
};

/**
 * Read the aggregate count for one filter key off the stats.
 * @param key The filter key.
 * @param stats The aggregate statistics.
 * @returns The matching count.
 */
function valueFor(key: SpecFilterKey, stats: ISpecStats): number {
  return stats[key];
}

/**
 * Pure mapper projecting the aggregate stats and the active status filter onto
 * the clickable stat toggles the dashboard header renders.
 *
 * Each toggle carries its filter key, label, count and pressed state, so the
 * webview renders accessible buttons (with `aria-pressed`) without owning any
 * filtering logic. Being `vscode`- and DOM-free, the stat-toggle contract is
 * unit-testable in the core.
 */
export class SpecStatToggleView {
  /** Filter-key-to-label table shared across calls. */
  private readonly labels: Readonly<Record<SpecFilterKey, string>> = STAT_LABELS;

  /**
   * Build the ordered stat toggles for the current stats and filter.
   * @param stats The aggregate statistics.
   * @param filter The active additive status filter.
   * @returns The ordered stat toggle views.
   */
  public build(stats: ISpecStats, filter: SpecStatusFilter): readonly ISpecStatToggleView[] {
    return SPEC_FILTER_KEYS.map((key) => ({
      key,
      label: this.labels[key],
      value: valueFor(key, stats),
      pressed: filter.isActive(key),
    }));
  }
}
