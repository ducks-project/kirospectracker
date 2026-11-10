import type { MessageKey } from '../i18n/messages';
/**
 * Port translating a catalogued English message into the user's language.
 *
 * The English text is the key and the template uses positional `{0}`, `{1}`
 * markers (the `vscode.l10n.t` dialect). The `src/core` layer never imports
 * `vscode`; the host adapter delegates to `vscode.l10n.t`, while the webview
 * uses a catalogue received from the host.
 */
export interface ITranslator {
  /**
   * Translate a catalogued message and substitute its positional arguments.
   * @param key The English message, which must belong to the typed catalogue.
   * @param args Positional values substituted for `{0}`, `{1}`, ….
   * @returns The translated, substituted message.
   */
  t(key: MessageKey, ...args: ReadonlyArray<string | number>): string;
}
