import type { ITranslator } from '../ports/ITranslator';
import type { MessageKey } from '../i18n/messages';
import type { PluralMessageKey } from '../i18n/pluralMessage';
import { translatePlural } from '../i18n/pluralMessage';
import { SpecStatus } from '../model/SpecStatus';
/**
 * Catalogue message naming each status for display.
 *
 * The {@link SpecStatus} value stays the stable identifier (settings keys, CSS
 * classes, filters); only this label is shown to the user and translated.
 */
export const STATUS_LABEL_KEY: Readonly<Record<SpecStatus, MessageKey>> = {
  [SpecStatus.Malformed]: 'Malformed',
  [SpecStatus.NotStarted]: 'Not started',
  [SpecStatus.InProgress]: 'In progress',
  [SpecStatus.Completed]: 'Completed',
  [SpecStatus.FullyCompleted]: 'Fully completed',
};
/**
 * Resolve the human-readable, translated label of a status.
 * @param status The spec status identifier.
 * @param translator The translator.
 * @returns The label to display.
 */
export function statusLabel(status: SpecStatus, translator: ITranslator): string {
  return translator.t(STATUS_LABEL_KEY[status]);
}
/** Catalogue message naming each status agreed with a count (tree group labels). */
const STATUS_COUNT_LABEL_KEY: Readonly<Record<SpecStatus, PluralMessageKey>> = {
  [SpecStatus.Malformed]: 'Malformed|Malformed',
  [SpecStatus.NotStarted]: 'Not started|Not started',
  [SpecStatus.InProgress]: 'In progress|In progress',
  [SpecStatus.Completed]: 'Completed|Completed',
  [SpecStatus.FullyCompleted]: 'Fully completed|Fully completed',
};
/**
 * Resolve the label of a status agreed with the number of specs it counts.
 * @param status The spec status identifier.
 * @param count The number of specs next to the label.
 * @param translator The translator.
 * @returns The label in the singular or plural form matching the count.
 */
export function statusCountLabel(
  status: SpecStatus,
  count: number,
  translator: ITranslator,
): string {
  return translatePlural(translator, STATUS_COUNT_LABEL_KEY[status], count);
}
