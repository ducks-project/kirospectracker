import * as vscode from 'vscode';
import type { MessageKey } from '../core/i18n/messages';
import type { ITranslator } from '../core/ports/ITranslator';
/**
 * Host {@link ITranslator} delegating to `vscode.l10n.t`.
 *
 * The English message is the lookup key in `l10n/bundle.l10n.<locale>.json`; a
 * message absent from the bundle (or any run without a language pack) stays in
 * English. Its name matches the `Vscode*` coverage exclusion: it is evidenced
 * by the integration harness.
 */
export class VscodeTranslator implements ITranslator {
  // eslint-disable-next-line class-methods-use-this
  public t(key: MessageKey, ...args: ReadonlyArray<string | number>): string {
    return vscode.l10n.t(key, ...args);
  }
}
