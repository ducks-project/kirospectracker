import { DictionaryTranslator } from './dictionary-translator';
import { readJson } from './manifest-nls';
/** The French message bundle shipped with the extension. */
export const FRENCH_BUNDLE: Readonly<Record<string, string>> = readJson<Record<string, string>>(
  'l10n/bundle.l10n.fr.json',
);
/** Test translator backed by the real French bundle. */
export const FRENCH_TRANSLATOR = new DictionaryTranslator(FRENCH_BUNDLE);
