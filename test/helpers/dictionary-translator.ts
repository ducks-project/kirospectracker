import type { MessageKey } from '../../src/core/i18n/messages';
import type { ITranslator } from '../../src/core/ports/ITranslator';
import { formatMessage } from '../../src/core/i18n/formatMessage';
/**
 * Test translator backed by a plain dictionary; a missing key stays English.
 */
export class DictionaryTranslator implements ITranslator {
  private readonly dictionary: Readonly<Record<string, string>>;
  /**
   * Build the translator.
   * @param dictionary English message to translated template.
   */
  public constructor(dictionary: Readonly<Record<string, string>>) {
    this.dictionary = dictionary;
  }
  public t(key: MessageKey, ...args: ReadonlyArray<string | number>): string {
    return formatMessage(this.dictionary[key] ?? key, args);
  }
}
