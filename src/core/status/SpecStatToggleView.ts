import type { ISpecStats } from '../model/ISpecStats';
import type { PluralMessageKey } from '../i18n/pluralMessage';
import type { ITranslator } from '../ports/ITranslator';
import { IDENTITY_TRANSLATOR } from '../i18n/IdentityTranslator';
import { translatePlural } from '../i18n/pluralMessage';
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

/**
 * Filter-key-to-label-message table, in the stat header display order. The
 * labels are plural messages agreed with the count (the card badge keeps the
 * singular status label).
 */
export const STAT_LABEL_KEYS: Readonly<Record<SpecFilterKey, PluralMessageKey>> = {
  completed: 'Completed|Completed',
  inProgress: 'In progress|In progress',
  notStarted: 'Not started|Not started',
  malformed: 'Malformed|Malformed',
};

/**
 * Explicit, compile-time-checked mapping from each filter key to the
 * {@link ISpecStats} field it reads its count from.
 *
 * Making the dependency a typed `Record<SpecFilterKey, keyof ISpecStats>`
 * (rather than relying on the filter keys happening to equal stat field names)
 * means a future rename of either side fails `tsc` instead of silently
 * mis-indexing: a renamed `ISpecStats` field breaks the value type, a renamed
 * filter key breaks the record key.
 */
const STAT_FIELD_BY_KEY: Readonly<Record<SpecFilterKey, keyof ISpecStats>> = {
  completed: 'completed',
  inProgress: 'inProgress',
  notStarted: 'notStarted',
  malformed: 'malformed',
};

/**
 * Read the aggregate count for one filter key off the stats through the
 * explicit {@link STAT_FIELD_BY_KEY} mapping.
 * @param key The filter key.
 * @param stats The aggregate statistics.
 * @returns The matching count.
 */
function valueFor(key: SpecFilterKey, stats: ISpecStats): number {
  return stats[STAT_FIELD_BY_KEY[key]];
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
  private readonly translator: ITranslator;
  /**
   * Build the mapper.
   * @param translator The translator for the toggle labels (English by default).
   */
  public constructor(translator: ITranslator = IDENTITY_TRANSLATOR) {
    this.translator = translator;
  }

  /**
   * Build the ordered stat toggles for the current stats and filter.
   * @param stats The aggregate statistics.
   * @param filter The active additive status filter.
   * @returns The ordered stat toggle views.
   */
  public build(stats: ISpecStats, filter: SpecStatusFilter): readonly ISpecStatToggleView[] {
    return SPEC_FILTER_KEYS.map((key) => {
      const value = valueFor(key, stats);
      return {
        key,
        label: translatePlural(this.translator, STAT_LABEL_KEYS[key], value),
        value,
        pressed: filter.isActive(key),
      };
    });
  }
}
