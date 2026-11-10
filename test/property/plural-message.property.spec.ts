import { expect } from 'chai';
import * as fc from 'fast-check';
import { selectPluralForm } from '../../src/core/i18n/pluralMessage';
/** Words without the form separator. */
const wordArb = fc.string().filter((word) => !word.includes('|'));
/**
 * Property-based specification for {@link selectPluralForm}.
 */
describe('selectPluralForm (properties)', () => {
  it('takes the singular form below 2 and the plural form from 2', () => {
    fc.assert(
      fc.property(wordArb, wordArb, fc.nat(), (one, other, count) => {
        const picked = selectPluralForm(`${one}|${other}`, count);
        expect(picked).to.equal(2 > count ? one : other);
      }),
    );
  });
  it('returns a template without separator unchanged for any count', () => {
    fc.assert(
      fc.property(wordArb, fc.nat(), (word, count) => {
        expect(selectPluralForm(word, count)).to.equal(word);
      }),
    );
  });
});
