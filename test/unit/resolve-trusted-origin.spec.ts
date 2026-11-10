import { expect } from 'chai';
import { resolveTrustedOrigin } from '../../src/webview/resolveTrustedOrigin';

const WEBVIEW_ORIGIN = 'vscode-webview://abc123';
/** Mirror of the handler guard: a message is accepted on strict equality. */
const accepts = (messageOrigin: string, webviewOrigin: string): boolean =>
  messageOrigin === resolveTrustedOrigin(webviewOrigin);
describe('resolveTrustedOrigin', () => {
  it('accepts the identical origin', () => {
    expect(accepts(WEBVIEW_ORIGIN, WEBVIEW_ORIGIN)).to.equal(true);
  });
  it('rejects a different origin', () => {
    expect(accepts('https://evil.example', WEBVIEW_ORIGIN)).to.equal(false);
  });
  it('rejects a sub-domain of the webview origin', () => {
    expect(accepts('vscode-webview://abc123.evil', WEBVIEW_ORIGIN)).to.equal(false);
  });
  it('rejects a different scheme', () => {
    expect(accepts('https://abc123', 'vscode-webview://abc123')).to.equal(false);
  });
  it('rejects an empty message origin', () => {
    expect(accepts('', WEBVIEW_ORIGIN)).to.equal(false);
  });
  it('rejects the "null" message origin', () => {
    expect(accepts('null', WEBVIEW_ORIGIN)).to.equal(false);
  });
  it('trusts nothing when the webview origin is empty or opaque', () => {
    expect(resolveTrustedOrigin('')).to.equal(undefined);
    expect(resolveTrustedOrigin('null')).to.equal(undefined);
    expect(accepts('', '')).to.equal(false);
    expect(accepts('null', 'null')).to.equal(false);
  });
});
