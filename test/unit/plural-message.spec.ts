import { expect } from 'chai';
import { IdentityTranslator } from '../../src/core/i18n/IdentityTranslator';
import { MESSAGE_KEYS } from '../../src/core/i18n/messages';
import type { PluralMessageKey } from '../../src/core/i18n/pluralMessage';
import { selectPluralForm, translatePlural } from '../../src/core/i18n/pluralMessage';
import { SpecStatus } from '../../src/core/model/SpecStatus';
import { statusCountLabel } from '../../src/core/status/SpecStatusLabel';
import { FRENCH_TRANSLATOR } from '../helpers/french-translator';

const english = new IdentityTranslator();
/** Counts exercising the singular and plural ranges. */
const COUNTS = [0, 1, 2, 3, 11, 14, 410, 523, 1000000];
/** Every plural message of the catalogue. */
const PLURAL_KEYS = MESSAGE_KEYS.filter((key) => key.includes('|')) as PluralMessageKey[];
/**
 * Behaviour specification for the singular/plural choice and its French output.
 */
describe('plural messages', () => {
  describe('selectPluralForm', () => {
    it('takes the singular form for 0 and 1', () => {
      expect(selectPluralForm('un|des', 0)).to.equal('un');
      expect(selectPluralForm('un|des', 1)).to.equal('un');
    });
    it('takes the plural form from 2', () => {
      expect(selectPluralForm('un|des', 2)).to.equal('des');
      expect(selectPluralForm('un|des', 1000000)).to.equal('des');
    });
    it('returns a template without separator unchanged', () => {
      expect(selectPluralForm('invariable', 0)).to.equal('invariable');
      expect(selectPluralForm('invariable', 5)).to.equal('invariable');
    });
  });
  describe('English text', () => {
    it('is identical for every count (both forms equal)', () => {
      PLURAL_KEYS.forEach((key) => {
        const [one, other] = key.split('|');
        expect(one, key).to.equal(other);
        COUNTS.forEach((count) =>
          expect(translatePlural(english, key, count), key).to.equal(
            one.replace('{0}', `${count}`),
          ),
        );
      });
    });
    it('keeps the former English counter texts', () => {
      expect(translatePlural(english, '{0} done|{0} done', 17)).to.equal('17 done');
      expect(translatePlural(english, '{0} cancelled|{0} cancelled', 1)).to.equal('1 cancelled');
      expect(translatePlural(english, 'done|done', 410)).to.equal('done');
      expect(translatePlural(english, 'Not started|Not started', 14)).to.equal('Not started');
    });
  });
  describe('French counters', () => {
    const fr = (key: PluralMessageKey, count: number): string =>
      translatePlural(FRENCH_TRANSLATOR, key, count);
    it('agrees the spec counter labels', () => {
      expect(fr('Completed|Completed', 0)).to.equal('Terminée');
      expect(fr('Completed|Completed', 1)).to.equal('Terminée');
      expect(fr('Completed|Completed', 11)).to.equal('Terminées');
      expect(fr('Not started|Not started', 14)).to.equal('Non démarrées');
      expect(fr('Malformed|Malformed', 1)).to.equal('Mal formée');
      expect(fr('Malformed|Malformed', 2)).to.equal('Mal formées');
      expect(fr('In progress|In progress', 1)).to.equal('En cours');
      expect(fr('In progress|In progress', 3)).to.equal('En cours');
    });
    it('agrees the per-card task counters without a "(s)" notation', () => {
      expect(fr('{0} done|{0} done', 1)).to.equal('1 terminée');
      expect(fr('{0} done|{0} done', 17)).to.equal('17 terminées');
      expect(fr('{0} cancelled|{0} cancelled', 1)).to.equal('1 annulée');
      expect(fr('{0} cancelled|{0} cancelled', 5)).to.equal('5 annulées');
    });
    it('agrees the global task labels', () => {
      expect(fr('done|done', 1)).to.equal('terminée');
      expect(fr('done|done', 410)).to.equal('terminées');
      expect(fr('cancelled|cancelled', 28)).to.equal('annulées');
      expect(FRENCH_TRANSLATOR.t('in progress')).to.equal('en cours');
      expect(FRENCH_TRANSLATOR.t('to-do')).to.equal('à faire');
    });
    it('agrees the tooltip phrases', () => {
      expect(fr('{0} completed|{0} completed', 1)).to.equal('1 terminée');
      expect(fr('{0} not started|{0} not started', 4)).to.equal('4 non démarrées');
      expect(fr('{0} malformed|{0} malformed', 2)).to.equal('2 mal formées');
    });
    it('agrees the tree group labels, including the fully completed one', () => {
      const label = (count: number): string =>
        statusCountLabel(SpecStatus.FullyCompleted, count, FRENCH_TRANSLATOR);
      expect(label(1)).to.equal('Entièrement terminée');
      expect(label(3)).to.equal('Entièrement terminées');
      expect(statusCountLabel(SpecStatus.Completed, 3, FRENCH_TRANSLATOR)).to.equal('Terminées');
    });
    it('keeps the badge status label singular', () => {
      expect(FRENCH_TRANSLATOR.t('Completed')).to.equal('Terminée');
    });
  });
});
