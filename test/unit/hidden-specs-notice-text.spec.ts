import { expect } from 'chai';
import { hiddenSpecsNoticeKey } from '../../src/adapters/HiddenSpecsNoticeText';
import { MESSAGE_KEYS } from '../../src/core/i18n/messages';
import { IdentityTranslator } from '../../src/core/i18n/IdentityTranslator';
/**
 * Behaviour specification for the hidden-specs notice message selection.
 */
describe('hiddenSpecsNoticeKey', () => {
  it('keeps the exact historical English text for one and several specs', () => {
    const t = new IdentityTranslator();
    expect(t.t(hiddenSpecsNoticeKey(1, 'files.exclude'), 1, 'files.exclude')).to.equal(
      'Kiro Spec Tracker: 1 spec hidden from the Explorer, Search and Quick Open ' +
        '(entries added to files.exclude in the folder settings).',
    );
    expect(t.t(hiddenSpecsNoticeKey(3, 'search.exclude'), 3, 'search.exclude')).to.equal(
      'Kiro Spec Tracker: 3 specs hidden from Search and Quick Open ' +
        '(entries added to search.exclude in the folder settings).',
    );
  });
  it('picks a distinct catalogued message per plural form and setting', () => {
    const keys = [
      hiddenSpecsNoticeKey(1, 'files.exclude'),
      hiddenSpecsNoticeKey(2, 'files.exclude'),
      hiddenSpecsNoticeKey(1, 'search.exclude'),
      hiddenSpecsNoticeKey(0, 'search.exclude'),
    ];
    expect(new Set(keys).size).to.equal(4);
    keys.forEach((key) => expect(MESSAGE_KEYS).to.include(key));
  });
});
