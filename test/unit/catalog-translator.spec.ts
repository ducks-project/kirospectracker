import { expect } from 'chai';
import { CatalogTranslator } from '../../src/core/i18n/CatalogTranslator';
import { IdentityTranslator } from '../../src/core/i18n/IdentityTranslator';
/**
 * Behaviour specification for the catalogue-backed and identity translators.
 */
describe('CatalogTranslator', () => {
  it('returns the translated template with arguments substituted', () => {
    const translator = new CatalogTranslator({ 'Required: {0}/{1}': 'Requis : {0}/{1}' });
    expect(translator.t('Required: {0}/{1}', 2, 5)).to.equal('Requis : 2/5');
  });
  it('falls back to the English message when the key is missing', () => {
    expect(new CatalogTranslator({}).t('Required: {0}/{1}', 2, 5)).to.equal('Required: 2/5');
  });
  it('does not resolve inherited object properties as translations', () => {
    expect(new CatalogTranslator({}).t('Clear search')).to.equal('Clear search');
  });
  it('returns the raw template when called without arguments', () => {
    const translator = new CatalogTranslator({ 'Open {0} for {1}': 'Ouvrir {0} pour {1}' });
    expect(translator.t('Open {0} for {1}')).to.equal('Ouvrir {0} pour {1}');
  });
});
/**
 * Behaviour specification for {@link IdentityTranslator}.
 */
describe('IdentityTranslator', () => {
  it('formats the English message', () => {
    expect(new IdentityTranslator().t('Open {0} for {1}', 'tasks', 'x')).to.equal(
      'Open tasks for x',
    );
  });
});
