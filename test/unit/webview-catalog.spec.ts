import { expect } from 'chai';
import type { ITranslator } from '../../src/core/ports/ITranslator';
import { buildWebviewCatalog } from '../../src/core/i18n/WebviewCatalog';
import { IdentityTranslator } from '../../src/core/i18n/IdentityTranslator';
import {
  HOST_ONLY_KEYS,
  MESSAGE_KEYS,
  SHARED_KEYS,
  WEBVIEW_MESSAGE_KEYS,
  WEBVIEW_ONLY_KEYS,
} from '../../src/core/i18n/messages';
/**
 * Behaviour specification for the typed message catalogue and the catalogue
 * sent to the webview.
 */
describe('buildWebviewCatalog', () => {
  it('contains exactly the webview message keys', () => {
    const catalog = buildWebviewCatalog(new IdentityTranslator());
    expect(Object.keys(catalog).sort()).to.deep.equal([...WEBVIEW_MESSAGE_KEYS].sort());
  });
  it('carries raw templates, with markers left unsubstituted', () => {
    const catalog = buildWebviewCatalog(new IdentityTranslator());
    expect(catalog['Open {0} for {1}']).to.equal('Open {0} for {1}');
  });
  it('uses the translator output as value', () => {
    const upper: ITranslator = { t: (key) => key.toUpperCase() };
    expect(buildWebviewCatalog(upper)['Clear search']).to.equal('CLEAR SEARCH');
  });
  it('never exposes a host-only message', () => {
    const catalog = buildWebviewCatalog(new IdentityTranslator());
    HOST_ONLY_KEYS.forEach((key) => expect(catalog).to.not.have.property(key));
  });
});
describe('message catalogue', () => {
  it('has no duplicate key', () => {
    expect(new Set(MESSAGE_KEYS).size).to.equal(MESSAGE_KEYS.length);
  });
  it('is the union of its three groups', () => {
    expect(MESSAGE_KEYS.length).to.equal(
      SHARED_KEYS.length + HOST_ONLY_KEYS.length + WEBVIEW_ONLY_KEYS.length,
    );
  });
});
