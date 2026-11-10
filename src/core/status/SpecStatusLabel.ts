import type { ITranslator } from '../ports/ITranslator';
import type { MessageKey } from '../i18n/messages';
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
