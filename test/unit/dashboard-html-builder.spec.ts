import { expect } from 'chai';

import { DashboardHtmlBuilder } from '../../src/core/DashboardHtmlBuilder';
import { HtmlEscaper } from '../../src/core/HtmlEscaper';

/** Build the dashboard HTML for a canonical input. */
function buildHtml(): string {
  return new DashboardHtmlBuilder(new HtmlEscaper()).build({
    nonce: 'abc123',
    cspSource: 'vscode-resource://host',
    scriptUri: 'vscode-resource://host/main.js',
    styleUri: 'vscode-resource://host/styles.css',
  });
}

/**
 * Behaviour specification for {@link DashboardHtmlBuilder}.
 */
describe('DashboardHtmlBuilder', () => {
  it('starts the CSP with default-src none', () => {
    expect(buildHtml()).to.contain("default-src 'none'");
  });

  it('authorises the script only through the nonce, not a source', () => {
    expect(buildHtml()).to.contain("script-src 'nonce-abc123'");
  });

  it('restricts images and styles to the webview cspSource', () => {
    const html = buildHtml();
    expect(html).to.contain('img-src vscode-resource://host');
    expect(html).to.contain('style-src vscode-resource://host');
  });

  it('attaches the nonce to the script and style tags', () => {
    const html = buildHtml();
    expect(html).to.contain('<script nonce="abc123"');
    expect(html).to.contain('<link nonce="abc123"');
  });

  it('escapes an injection attempt in the nonce', () => {
    const html = new DashboardHtmlBuilder(new HtmlEscaper()).build({
      nonce: '"><script>bad()</script>',
      cspSource: 'vscode-resource://host',
      scriptUri: 'a',
      styleUri: 'b',
    });
    expect(html).to.not.contain('<script>bad()');
  });

  it('declares no network origin in the CSP', () => {
    expect(buildHtml()).to.not.match(/https?:\/\/(?!host)/);
  });
});
