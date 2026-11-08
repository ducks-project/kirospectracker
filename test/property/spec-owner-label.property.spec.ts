import { expect } from 'chai';
import * as fc from 'fast-check';

import { deriveSpecOwnerLabel } from '../../src/core/status/SpecOwnerLabel';

/** Any path separator the helper recognises. */
const SEPARATOR = /[\\/]/;

/**
 * Property-based specification for {@link deriveSpecOwnerLabel}.
 */
describe('deriveSpecOwnerLabel (properties)', () => {
  it('never throws and never returns an empty string', () => {
    fc.assert(
      fc.property(fc.string(), (path) => {
        const label = deriveSpecOwnerLabel(path);
        expect(label.length).to.be.greaterThan(0);
      }),
    );
  });

  it('returns a separator-free label that is a trailing segment of the path', () => {
    const segmentArb = fc
      .string()
      .filter((segment) => !SEPARATOR.test(segment) && 0 < segment.length);
    fc.assert(
      fc.property(fc.array(segmentArb, { minLength: 1 }), (segments) => {
        const label = deriveSpecOwnerLabel(segments.join('/'));
        expect(SEPARATOR.test(label)).to.equal(false);
        expect(label).to.equal(segments[segments.length - 1]);
      }),
    );
  });
});
