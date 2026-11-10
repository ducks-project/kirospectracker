import { expect } from 'chai';
import * as fc from 'fast-check';

import { extractDocumentIntroduction } from '../../src/core/parsing/DocumentIntroduction';

/** Match any ATX heading line, used to assert the result carries no heading. */
const HEADING_LINE = /^#{1,6}\s+/;

/**
 * Match a line the extractor treats as a heading: up to three leading spaces, one to six
 * hashes, then whitespace. It is applied to the UNTRIMMED generated body, because trimming
 * would strip the trailing space of an empty heading such as `# ` and hide it from the filter.
 */
const EXTRACTOR_HEADING_LIKE = /^\s{0,3}#{1,6}\s/;

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
              0 < body.trim().length && !body.includes('\n') && !EXTRACTOR_HEADING_LIKE.test(body),
          ),
        (body) => {
          const content = `# Title\n\nPreamble.\n\n## Introduction\n\n${body}\n\n## Next\n`;
          expect(extractDocumentIntroduction(content)).to.equal(body.trim());
        },
      ),
      // Boundary pinned as an always-run example (examples bypass the generator filter): a line
      // indented by four spaces is NOT a heading, so `    # ` is a valid section body. The
      // earlier flaky counterexample `# ` (an empty heading, which closes the section) is now
      // excluded by the filter and covered by the dedicated unit test.
      { examples: [['    # ']] },
    );
  });
});
