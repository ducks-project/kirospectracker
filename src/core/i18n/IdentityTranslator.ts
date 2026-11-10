import type { ITranslator } from '../ports/ITranslator';
import type { MessageKey } from './messages';
import { formatMessage } from './formatMessage';
/**
 * Translator returning the English message itself (with arguments substituted).
 *
 * It is the default for every class that receives a translator, so the
 * extension reads exactly as before when no translation is available.
 */
export class IdentityTranslator implements ITranslator {
  // eslint-disable-next-line class-methods-use-this
  public t(key: MessageKey, ...args: ReadonlyArray<string | number>): string {
    return formatMessage(key, args);
  }
}
/** Shared stateless identity translator used as a default argument. */
export const IDENTITY_TRANSLATOR: ITranslator = new IdentityTranslator();
