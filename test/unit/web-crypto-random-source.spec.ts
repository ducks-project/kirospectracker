import { expect } from 'chai';

import { WebCryptoRandomSource } from '../../src/adapters/WebCryptoRandomSource';

/**
 * Behaviour specification for {@link WebCryptoRandomSource}.
 *
 * `globalThis.crypto.getRandomValues` is available in the Node test runtime
 * (Node 18+), so the adapter is exercised directly without `vscode`.
 */
describe('WebCryptoRandomSource', () => {
  const source = new WebCryptoRandomSource();

  it('returns an integer within [0, max)', () => {
    for (let index = 0; index < 100; index += 1) {
      const value = source.nextInt(10);
      expect(value).to.be.at.least(0);
      expect(value).to.be.below(10);
    }
  });

  it('returns an integer value', () => {
    const value = source.nextInt(1000);
    expect(Number.isInteger(value)).to.equal(true);
  });
});
