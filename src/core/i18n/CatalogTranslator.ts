import type { ITranslator } from '../ports/ITranslator';
import type { MessageKey } from './messages';
import { formatMessage } from './formatMessage';
/**
 * Translator backed by a catalogue of already-translated templates.
 *
 * The webview builds one from the catalogue the host posts; a key missing from
 * the catalogue falls back to its English text, so the UI never shows blanks.
 */
export class CatalogTranslator implements ITranslator {
  private readonly catalog: Readonly<Record<string, string>>;
  /**
   * Build the translator over a catalogue.
   * @param catalog Translated templates keyed by their English message.
   */
  public constructor(catalog: Readonly<Record<string, string>>) {
    this.catalog = catalog;
  }
  public t(key: MessageKey, ...args: ReadonlyArray<string | number>): string {
    const template = Object.prototype.hasOwnProperty.call(this.catalog, key)
      ? this.catalog[key]
      : key;
    return formatMessage(template, args);
  }
}
