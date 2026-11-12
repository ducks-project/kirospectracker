import type { WebviewMessageKey } from '../../core/i18n/messages';
import type { PluralMessageKey } from '../../core/i18n/pluralMessage';
import type { ITranslator } from '../../core/ports/ITranslator';

/**
 * Translation surface the webview views depend on. The `WebviewMessageKey` type
 * makes the compiler refuse any message the host does not put in the catalogue
 * sent to the webview.
 */
export interface IViewText {
  /** The live translator, for core helpers that take an {@link ITranslator}. */
  readonly translator: ITranslator;
  /**
   * Translate a webview message.
   * @param key The English message.
   * @param args Positional values for `{0}`, `{1}`.
   * @returns The translated message.
   */
  t(key: WebviewMessageKey, ...args: ReadonlyArray<string | number>): string;
  /**
   * Translate a plural webview message and agree it with a count.
   * @param key The plural English message.
   * @param count The count, also substituted for `{0}`.
   * @returns The translated phrase in the form matching the count.
   */
  tp(key: Extract<WebviewMessageKey, PluralMessageKey>, count: number): string;
}
