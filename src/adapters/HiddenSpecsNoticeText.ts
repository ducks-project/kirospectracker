import type { ExcludeSettingKey } from '../core/hiding/HideSpecsMode';
import type { MessageKey } from '../core/i18n/messages';
/**
 * Pick the catalogue message of the first-write notice.
 *
 * Plurals use distinct whole-sentence messages (never a `{noun}` fragment), and
 * the surface phrase is part of the sentence so a translation can inflect it.
 * @param count The number of specs hidden.
 * @param setting The exclusion setting the entries were added to.
 * @returns The catalogue key; arguments are the count then the setting.
 */
export function hiddenSpecsNoticeKey(count: number, setting: ExcludeSettingKey): MessageKey {
  const single = 1 === count;
  if ('files.exclude' === setting) {
    return single
      ? 'Kiro Spec Tracker: {0} spec hidden from the Explorer, Search and Quick Open (entries added to {1} in the folder settings).'
      : 'Kiro Spec Tracker: {0} specs hidden from the Explorer, Search and Quick Open (entries added to {1} in the folder settings).';
  }
  return single
    ? 'Kiro Spec Tracker: {0} spec hidden from Search and Quick Open (entries added to {1} in the folder settings).'
    : 'Kiro Spec Tracker: {0} specs hidden from Search and Quick Open (entries added to {1} in the folder settings).';
}
