import { expect } from 'chai';

import { HtmlEscaper } from '../../src/core/HtmlEscaper';

/**
 * Behaviour specification for {@link HtmlEscaper}.
 */
describe('HtmlEscaper', () => {
  const escaper = new HtmlEscaper();

  it('escapes the ampersand first to avoid double-escaping', () => {
    expect(escaper.escape('a & b')).to.equal('a &amp; b');
  });

  it('escapes angle brackets', () => {
    expect(escaper.escape('<script>')).to.equal('&lt;script&gt;');
  });

  it('escapes both quote characters', () => {
    expect(escaper.escape(`"'`)).to.equal('&quot;&#39;');
  });

  it('neutralises an injection attempt', () => {
    expect(escaper.escape('<img src=x onerror="alert(1)">')).to.equal(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;',
    );
  });

  it('leaves safe text unchanged', () => {
    expect(escaper.escape('plain spec name 1.2')).to.equal('plain spec name 1.2');
  });
});
