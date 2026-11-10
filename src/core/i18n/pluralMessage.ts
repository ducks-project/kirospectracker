import type { ITranslator } from '../ports/ITranslator';
import type { MessageKey } from './messages';
import { formatMessage } from './formatMessage';
/** Separator between the singular and the plural form of a plural message. */
const FORM_SEPARATOR = '|';
/** Index of the first count that takes the plural form (0 and 1 are singular). */
const PLURAL_THRESHOLD = 2;
/**
 * A catalogue message holding two whole-phrase forms, `singular|plural`.
 *
 * The English key repeats the same phrase on both sides (English text never
 * changes with the count); a translation inflects each side on its own.
 */
export type PluralMessageKey = Extract<MessageKey, `${string}${typeof FORM_SEPARATOR}${string}`>;
/**
 * Pick the form of a plural template for a count.
 *
 * Counts 0 and 1 take the singular form and counts from 2 take the plural form
 * (the French rule). A template without separator is returned unchanged.
 * @param template The translated template, `singular|plural`.
 * @param count The number the phrase is agreed with.
 * @returns The selected form, markers still unsubstituted.
 */
export function selectPluralForm(template: string, count: number): string {
  const separator = template.indexOf(FORM_SEPARATOR);
  if (0 > separator) {
    return template;
  }
  return PLURAL_THRESHOLD > count
    ? template.slice(0, separator)
    : template.slice(separator + FORM_SEPARATOR.length);
}
/**
 * Translate a plural message, agree it with a count and substitute its markers.
 * @param translator The translator.
 * @param key The plural catalogue message.
 * @param count The count; it is also the value of `{0}`.
 * @param args Further positional values for `{1}`, `{2}`, ….
 * @returns The translated phrase in the form matching the count.
 */
export function translatePlural(
  translator: ITranslator,
  key: PluralMessageKey,
  count: number,
  ...args: ReadonlyArray<string | number>
): string {
  return formatMessage(selectPluralForm(translator.t(key), count), [count, ...args]);
}
