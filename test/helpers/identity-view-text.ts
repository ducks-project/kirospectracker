import type { IViewText } from '../../src/webview/state/IViewText';
import { IDENTITY_TRANSLATOR } from '../../src/core/i18n/IdentityTranslator';
import { translatePlural } from '../../src/core/i18n/pluralMessage';

/** English identity {@link IViewText}, as the webview uses before the strings arrive. */
export const IDENTITY_VIEW_TEXT: IViewText = {
  translator: IDENTITY_TRANSLATOR,
  t: (key, ...args) => IDENTITY_TRANSLATOR.t(key, ...args),
  tp: (key, count) => translatePlural(IDENTITY_TRANSLATOR, key, count),
};
