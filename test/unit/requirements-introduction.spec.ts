import { expect } from 'chai';

import { extractRequirementsIntroduction } from '../../src/core/parsing/RequirementsIntroduction';

/**
 * Behaviour specification for {@link extractRequirementsIntroduction}.
 *
 * The extractor is pure and total: it prefers an explicit `Introduction`
 * section, falls back to the first non-heading paragraph, and returns
 * `undefined` whenever nothing can be derived (absent, empty, heading-only).
 */
describe('extractRequirementsIntroduction', () => {
  it('returns undefined for an absent document', () => {
    expect(extractRequirementsIntroduction(undefined)).to.equal(undefined);
  });

  it('returns undefined for an empty document', () => {
    expect(extractRequirementsIntroduction('')).to.equal(undefined);
  });

  it('returns undefined for a whitespace-only document', () => {
    expect(extractRequirementsIntroduction('   \n\n\t\n')).to.equal(undefined);
  });

  it('returns undefined for a heading-only document', () => {
    expect(extractRequirementsIntroduction('# Requirements\n\n## Introduction')).to.equal(
      undefined,
    );
  });

  it('extracts the body of an explicit Introduction section', () => {
    const content =
      '# Requirements Document\n\n## Introduction\n\nThe intro body.\n\n## Glossary\n';
    expect(extractRequirementsIntroduction(content)).to.equal('The intro body.');
  });

  it('matches the Introduction heading case-insensitively', () => {
    const content = '# Title\n\n## INTRODUCTION\n\nUpper-cased heading body.\n';
    expect(extractRequirementsIntroduction(content)).to.equal('Upper-cased heading body.');
  });

  it('stops the Introduction section at the next heading of any level', () => {
    const content = '## Introduction\n\nFirst line.\nSecond line.\n### Sub\n\nIgnored.\n';
    expect(extractRequirementsIntroduction(content)).to.equal('First line.\nSecond line.');
  });

  it('falls back to the first paragraph after the title when no Introduction section exists', () => {
    const content = '# Requirements Document\n\nA short blurb.\n\n## Requirement 1\n';
    expect(extractRequirementsIntroduction(content)).to.equal('A short blurb.');
  });

  it('returns the first paragraph when the document has no headings at all', () => {
    const content = 'Just a plain paragraph.\nWith two lines.\n\nA second paragraph.';
    expect(extractRequirementsIntroduction(content)).to.equal(
      'Just a plain paragraph.\nWith two lines.',
    );
  });

  it('stops the first paragraph at a heading that follows it without a blank line', () => {
    const content = 'First blurb line.\n## Requirement 1\n\nBody.\n';
    expect(extractRequirementsIntroduction(content)).to.equal('First blurb line.');
  });

  it('handles CRLF line endings', () => {
    const content = '# Title\r\n\r\n## Introduction\r\n\r\nWindows body.\r\n';
    expect(extractRequirementsIntroduction(content)).to.equal('Windows body.');
  });

  it('prefers the Introduction section over an earlier paragraph', () => {
    const content = '# Title\n\nEarly blurb.\n\n## Introduction\n\nThe real intro.\n';
    expect(extractRequirementsIntroduction(content)).to.equal('The real intro.');
  });

  it('treats a bare hash with no heading text as a plain first paragraph', () => {
    // `#` without a following space is not a valid ATX heading, so it degrades
    // to the first-paragraph fallback rather than being skipped as a title.
    expect(extractRequirementsIntroduction('#')).to.equal('#');
  });
});
