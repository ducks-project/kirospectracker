import { expect } from 'chai';
import * as fc from 'fast-check';

import { extractDocumentIntroduction } from '../../src/core/parsing/DocumentIntroduction';

/** Match any ATX heading line, used to assert the result carries no heading. */
const HEADING_LINE = /^#{1,6}\s+/;

/**
 * Property-based specification for {@link extractDocumentIntroduction}.
 */
describe('extractDocumentIntroduction (properties)', () => {
  it('is total: any string input yields a string or undefined and never throws', () => {
    fc.assert(
      fc.property(fc.string(), (content) => {
        const result = extractDocumentIntroduction(content);
        expect(undefined === result || 'string' === typeof result).to.equal(true);
      }),
    );
  });

  it('is total over multi-line arbitrary text', () => {
    fc.assert(
      fc.property(fc.array(fc.string(), { maxLength: 40 }), (lines) => {
        expect(() => extractDocumentIntroduction(lines.join('\n'))).to.not.throw();
      }),
    );
  });

  it('never returns a result containing a heading line', () => {
    fc.assert(
      fc.property(fc.array(fc.string(), { maxLength: 40 }), (lines) => {
        const result = extractDocumentIntroduction(lines.join('\n'));
        if (undefined === result) {
          return;
        }
        const hasHeading = result.split('\n').some((line) => HEADING_LINE.test(line));
        expect(hasHeading).to.equal(false);
      }),
    );
  });

  it('never returns an empty or whitespace-only string', () => {
    fc.assert(
      fc.property(fc.string(), (content) => {
        const result = extractDocumentIntroduction(content);
        if (undefined === result) {
          return;
        }
        expect(0 < result.trim().length).to.equal(true);
      }),
    );
  });

  it('extracts an Introduction section body whatever the preceding content', () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 1 })
          .filter(
            (body) =>
              0 < body.trim().length && !body.includes('\n') && !HEADING_LINE.test(body.trim()),
          ),
        (body) => {
          const content = `# Title\n\nPreamble.\n\n## Introduction\n\n${body}\n\n## Next\n`;
          expect(extractDocumentIntroduction(content)).to.equal(body.trim());
        },
      ),
    );
  });
});
