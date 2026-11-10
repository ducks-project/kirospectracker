import { expect } from 'chai';

import { extractDocumentIntroduction } from '../../src/core/parsing/DocumentIntroduction';

/**
 * Behaviour specification for {@link extractDocumentIntroduction}.
 *
 * The extractor is pure and total: it prefers an explicit `Introduction`
 * section, falls back to the first non-heading paragraph, and returns
 * `undefined` whenever nothing can be derived (absent, empty, heading-only).
 */
describe('extractDocumentIntroduction', () => {
  it('returns undefined for an absent document', () => {
    expect(extractDocumentIntroduction(undefined)).to.equal(undefined);
  });

  it('returns undefined for an empty document', () => {
    expect(extractDocumentIntroduction('')).to.equal(undefined);
  });

  it('returns undefined for a whitespace-only document', () => {
    expect(extractDocumentIntroduction('   \n\n\t\n')).to.equal(undefined);
  });

  it('returns undefined for a heading-only document', () => {
    expect(extractDocumentIntroduction('# Requirements\n\n## Introduction')).to.equal(undefined);
  });

  it('extracts the body of an explicit Introduction section', () => {
    const content =
      '# Requirements Document\n\n## Introduction\n\nThe intro body.\n\n## Glossary\n';
    expect(extractDocumentIntroduction(content)).to.equal('The intro body.');
  });

  it('matches the Introduction heading case-insensitively', () => {
    const content = '# Title\n\n## INTRODUCTION\n\nUpper-cased heading body.\n';
    expect(extractDocumentIntroduction(content)).to.equal('Upper-cased heading body.');
  });

  it('stops the Introduction section at the next heading of any level', () => {
    const content = '## Introduction\n\nFirst line.\nSecond line.\n### Sub\n\nIgnored.\n';
    expect(extractDocumentIntroduction(content)).to.equal('First line.\nSecond line.');
  });

  it('falls back to the first paragraph after the title when no Introduction section exists', () => {
    const content = '# Requirements Document\n\nA short blurb.\n\n## Requirement 1\n';
    expect(extractDocumentIntroduction(content)).to.equal('A short blurb.');
  });

  it('returns the first paragraph when the document has no headings at all', () => {
    const content = 'Just a plain paragraph.\nWith two lines.\n\nA second paragraph.';
    expect(extractDocumentIntroduction(content)).to.equal(
      'Just a plain paragraph.\nWith two lines.',
    );
  });

  it('stops the first paragraph at a heading that follows it without a blank line', () => {
    const content = 'First blurb line.\n## Requirement 1\n\nBody.\n';
    expect(extractDocumentIntroduction(content)).to.equal('First blurb line.');
  });

  it('handles CRLF line endings', () => {
    const content = '# Title\r\n\r\n## Introduction\r\n\r\nWindows body.\r\n';
    expect(extractDocumentIntroduction(content)).to.equal('Windows body.');
  });

  it('prefers the Introduction section over an earlier paragraph', () => {
    const content = '# Title\n\nEarly blurb.\n\n## Introduction\n\nThe real intro.\n';
    expect(extractDocumentIntroduction(content)).to.equal('The real intro.');
  });

  it('treats a bare hash with no heading text as a plain first paragraph', () => {
    // `#` without a following space is not a valid ATX heading, so it degrades
    // to the first-paragraph fallback rather than being skipped as a title.
    expect(extractDocumentIntroduction('#')).to.equal('#');
  });
  describe('design and bugfix documents', () => {
    it('uses the Overview section of a design, skipping its sub-headings and TOC', () => {
      const doc =
        '# Design\n\n- [Overview](#overview)\n\n## Overview\n\n### Problem\n\nThe design blurb.\n\n## Architecture\n\nOther.\n';
      expect(extractDocumentIntroduction(doc)).to.equal('The design blurb.');
    });
    it("uses the French 'Vue d'ensemble' section", () => {
      const doc = "# Conception\n\n## Vue d'ensemble\n\nAperçu.\n\n## Suite\n\nAutre.\n";
      expect(extractDocumentIntroduction(doc)).to.equal('Aperçu.');
    });
    it('prefers Introduction over Overview', () => {
      const doc = '# T\n\n## Overview\n\nOver.\n\n## Introduction\n\nIntro.\n';
      expect(extractDocumentIntroduction(doc)).to.equal('Intro.');
    });
    it('reads the Introduction of a bugfix document', () => {
      const doc = '# Bugfix Requirements Document\n\n## Introduction\n\nThe bug.\n';
      expect(extractDocumentIntroduction(doc)).to.equal('The bug.');
    });
    it('falls back to the first paragraph without Introduction or Overview', () => {
      expect(extractDocumentIntroduction('# D\n\nFirst.\n\nSecond.\n')).to.equal('First.');
    });
    it('returns undefined for an empty Overview section followed by a sibling', () => {
      expect(extractDocumentIntroduction('## Overview\n\n## Next\n')).to.equal(undefined);
    });
  });
});
