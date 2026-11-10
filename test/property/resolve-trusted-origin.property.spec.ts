import { expect } from 'chai';
import * as fc from 'fast-check';

import { resolveTrustedOrigin } from '../../src/webview/resolveTrustedOrigin';
/**
 * Property-based specification for {@link resolveTrustedOrigin}.
 */
describe('resolveTrustedOrigin (properties)', () => {
  it('rejects every message origin that differs from the webview origin', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (messageOrigin, webviewOrigin) => {
        fc.pre(messageOrigin !== webviewOrigin);
        expect(messageOrigin === resolveTrustedOrigin(webviewOrigin)).to.equal(false);
      }),
    );
  });
  it('accepts the identical origin whenever it is usable', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((origin) => 'null' !== origin),
        (origin) => {
          expect(origin === resolveTrustedOrigin(origin)).to.equal(true);
        },
      ),
    );
  });
});
