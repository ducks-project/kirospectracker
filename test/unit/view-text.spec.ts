import { expect } from 'chai';
import { ViewText } from '../../src/webview/state/ViewText';

describe('ViewText', () => {
  it('is the English identity before the strings arrive', () => {
    const text = new ViewText();
    expect(text.t('Filter by {0}', 'x')).to.equal('Filter by x');
    expect(text.tp('{0} done|{0} done', 3)).to.equal('3 done');
  });

  it('adopts the catalogue and falls back to English for missing keys', () => {
    const text = new ViewText();
    text.adopt({ 'Filter by {0}': 'Filtrer par {0}' });
    expect(text.t('Filter by {0}', 'x')).to.equal('Filtrer par x');
    expect(text.t('Clear search')).to.equal('Clear search');
  });

  it('rebuilds the translated projectors when adopting', () => {
    const text = new ViewText();
    const before = text.layoutToggle;
    const beforeStats = text.statToggles;
    text.adopt({});
    expect(text.layoutToggle).to.not.equal(before);
    expect(text.statToggles).to.not.equal(beforeStats);
  });

  it('exposes the live translator to core helpers', () => {
    const text = new ViewText();
    const before = text.translator;
    text.adopt({ 'Clear search': 'Effacer' });
    expect(text.translator).to.not.equal(before);
    expect(text.translator.t('Clear search')).to.equal('Effacer');
  });

  it('agrees plural forms with the count', () => {
    const text = new ViewText();
    expect(text.tp('done|done', 1)).to.equal('done');
  });
});
