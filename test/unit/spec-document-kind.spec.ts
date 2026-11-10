import { expect } from 'chai';
import { SPEC_DOCUMENT_KINDS } from '../../src/core/model/SpecDocumentKind';
import { buildSpecDocuments, documentFileName } from '../../src/core/SpecDocumentFiles';
/** Behaviour specification for the document-kind registry. */
describe('SPEC_DOCUMENT_KINDS registry', () => {
  it('includes bugfix as a first-class kind with its file name', () => {
    expect(SPEC_DOCUMENT_KINDS).to.include('bugfix');
    expect(documentFileName('bugfix')).to.equal('bugfix.md');
  });
  it('gives every kind a markdown file name', () => {
    SPEC_DOCUMENT_KINDS.forEach((kind) => {
      expect(documentFileName(kind)).to.match(/\.md$/);
    });
  });
  it('buildSpecDocuments flags every kind from the predicate', () => {
    const documents = buildSpecDocuments((kind) => 'bugfix' === kind);
    expect(documents).to.deep.equal({
      requirements: false,
      design: false,
      tasks: false,
      notes: false,
      bugfix: true,
    });
  });
});
