import type { IStringsMessage } from '../../../src/core/model/IDashboardMessage';
import { WEBVIEW_MESSAGE_KEYS } from '../../../src/core/i18n/messages';

/** Separator between the singular and plural forms of a plural key. */
const FORM_SEPARATOR = '|';

/**
 * Mark every form of a template so that a translated label is recognisable, and
 * so that the singular and plural forms of a plural key differ.
 * @param key The English message.
 * @returns The marked template.
 */
function marked(key: string): string {
  const forms = key.split(FORM_SEPARATOR);
  if (1 === forms.length) {
    return `fr~${key}`;
  }
  return `fr~one~${forms[0]}${FORM_SEPARATOR}fr~many~${forms[1]}`;
}

/**
 * A synthetic "French" catalogue covering EVERY webview message: each template is
 * the English key behind a marker. It is independent of the real translations (so
 * editing `bundle.l10n.fr.json` never touches the reference) while proving that
 * each key the webview requests is looked up in the catalogue.
 */
export const MARKED_CATALOG: Readonly<Record<string, string>> = Object.fromEntries(
  WEBVIEW_MESSAGE_KEYS.map((key) => [key, marked(key)]),
);

/**
 * Build the `strings` message the host posts before a `render`.
 * @param language Display language code.
 * @param messages Translated templates keyed by the English message.
 * @returns The message.
 */
export function stringsMessage(
  language: string,
  messages: Readonly<Record<string, string>>,
): IStringsMessage {
  return { type: 'strings', language, messages };
}
