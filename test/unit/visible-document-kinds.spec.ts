import { expect } from 'chai';
import type { ISpecDocuments } from '../../src/core/model/ISpecDocuments';
import { SPEC_DOCUMENT_KINDS } from '../../src/core/model/SpecDocumentKind';
import { visibleDocumentKinds } from '../../src/webview/visibleDocumentKinds';

/** Behaviour specification for {@link visibleDocumentKinds}. */
describe('visibleDocumentKinds', () => {
  const none: ISpecDocuments = {
    tasks: false,
    requirements: false,
    design: false,
    notes: false,
    bugfix: false,
  };

  it('returns nothing when no document is present', () => {
    expect(visibleDocumentKinds(none, SPEC_DOCUMENT_KINDS)).to.deep.equal([]);
  });

  it('returns every kind, in display order, when all are present', () => {
    const all: ISpecDocuments = {
      tasks: true,
      requirements: true,
      design: true,
      notes: true,
      bugfix: true,
    };
    expect(visibleDocumentKinds(all, SPEC_DOCUMENT_KINDS)).to.deep.equal([...SPEC_DOCUMENT_KINDS]);
  });

  SPEC_DOCUMENT_KINDS.forEach((kind) => {
    it(`returns only ${kind} when it is the single present document`, () => {
      expect(visibleDocumentKinds({ ...none, [kind]: true }, SPEC_DOCUMENT_KINDS)).to.deep.equal([
        kind,
      ]);
    });
  });

  it('keeps a bugfix-only spec renderable through its entry document kind', () => {
    const kinds = visibleDocumentKinds({ ...none, bugfix: true }, SPEC_DOCUMENT_KINDS);
    expect(kinds).to.include('bugfix');
  });

  it('does not depend on the entry document: absence of a link never hides others', () => {
    const kinds = visibleDocumentKinds(
      { ...none, requirements: true, tasks: true },
      SPEC_DOCUMENT_KINDS,
    );
    expect(kinds).to.deep.equal(['requirements', 'tasks']);
  });
});
