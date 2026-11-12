import { CatalogTranslator } from '../../core/i18n/CatalogTranslator';
import { IDENTITY_TRANSLATOR } from '../../core/i18n/IdentityTranslator';
import type { WebviewMessageKey } from '../../core/i18n/messages';
import type { PluralMessageKey } from '../../core/i18n/pluralMessage';
import { translatePlural } from '../../core/i18n/pluralMessage';
import type { ITranslator } from '../../core/ports/ITranslator';
import { SpecFolderToggleView } from '../../core/status/SpecFolderToggleView';
import { SpecLayoutToggleView } from '../../core/status/SpecLayoutToggleView';
import { SpecStatToggleView } from '../../core/status/SpecStatToggleView';
import type { IViewText } from './IViewText';

/**
 * Translator for the webview. It starts as the English identity and is replaced
 * by a catalogue-backed one when the host posts its `strings` message, together
 * with the pure core projectors that embed the translator.
 */
export class ViewText implements IViewText {
  private current: ITranslator = IDENTITY_TRANSLATOR;
  /** Stat-toggle projector, rebuilt when the strings arrive. */
  public statToggles = new SpecStatToggleView(this.current);
  /** Layout-toggle projector, rebuilt when the strings arrive. */
  public layoutToggle = new SpecLayoutToggleView(this.current);
  /** Folder-toggle projector (not translated). */
  public readonly folderToggles = new SpecFolderToggleView();

  /** The live translator. */
  public get translator(): ITranslator {
    return this.current;
  }

  /**
   * Translate a webview message.
   * @param key The English message.
   * @param args Positional values for `{0}`, `{1}`.
   * @returns The translated message.
   */
  public t(key: WebviewMessageKey, ...args: ReadonlyArray<string | number>): string {
    return this.current.t(key, ...args);
  }

  /**
   * Translate a plural webview message and agree it with a count.
   * @param key The plural English message.
   * @param count The count, also substituted for `{0}`.
   * @returns The translated phrase in the form matching the count.
   */
  public tp(key: Extract<WebviewMessageKey, PluralMessageKey>, count: number): string {
    return translatePlural(this.current, key, count);
  }

  /**
   * Adopt the translated catalogue the host posted and rebuild the projectors.
   * @param messages The translated templates keyed by English message.
   */
  public adopt(messages: Readonly<Record<string, string>>): void {
    this.current = new CatalogTranslator(messages);
    this.statToggles = new SpecStatToggleView(this.current);
    this.layoutToggle = new SpecLayoutToggleView(this.current);
  }
}
