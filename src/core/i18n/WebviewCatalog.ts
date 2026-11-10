import type { ITranslator } from '../ports/ITranslator';
import { WEBVIEW_MESSAGE_KEYS } from './messages';
/**
 * Build the catalogue the host sends to the webview: each webview message key
 * mapped to its raw translated template (markers still unsubstituted).
 * @param translator The host translator.
 * @returns The translated templates keyed by English message.
 */
export function buildWebviewCatalog(translator: ITranslator): Readonly<Record<string, string>> {
  const catalog: Record<string, string> = {};
  WEBVIEW_MESSAGE_KEYS.forEach((key) => {
    catalog[key] = translator.t(key);
  });
  return catalog;
}
