import { expect } from 'chai';

import type { ISpecDocuments } from '../../src/core/model/ISpecDocuments';
import { SpecStatus } from '../../src/core/model/SpecStatus';
import {
  buildSpecTreeContextValue,
  documentContextToken,
  SPEC_TREE_CONTEXT_TOKENS,
  SPEC_TREE_MENU_GATING_TOKENS,
} from '../../src/core/status/SpecTreeContextValue';

/** All documents present. */
const ALL_DOCS: ISpecDocuments = {
  tasks: true,
  requirements: true,
  design: true,
  notes: true,
};

/** Only tasks present. */
const TASKS_ONLY: ISpecDocuments = {
  tasks: true,
  requirements: false,
  design: false,
  notes: false,
};

/**
 * Behaviour specification for {@link buildSpecTreeContextValue}.
 *
 * The token contract backs the declarative `view/item/context` `when` clauses:
 * a document action is shown only when its `doc-<kind>` token is present, and
 * "Run tasks" only when the `runnable` token is present (non-malformed spec).
 */
describe('buildSpecTreeContextValue', () => {
  it('starts with the spec base token', () => {
    const value = buildSpecTreeContextValue(TASKS_ONLY, SpecStatus.NotStarted);
    expect(value.split(' ')).to.include('spec');
  });

  it('emits a doc token for each present document only', () => {
    const value = buildSpecTreeContextValue(TASKS_ONLY, SpecStatus.NotStarted);
    const tokens = value.split(' ');
    expect(tokens).to.include(documentContextToken('tasks'));
    expect(tokens).to.not.include(documentContextToken('requirements'));
    expect(tokens).to.not.include(documentContextToken('design'));
    expect(tokens).to.not.include(documentContextToken('notes'));
  });

  it('emits every doc token when all documents are present', () => {
    const tokens = buildSpecTreeContextValue(ALL_DOCS, SpecStatus.Completed).split(' ');
    expect(tokens).to.include(documentContextToken('requirements'));
    expect(tokens).to.include(documentContextToken('design'));
    expect(tokens).to.include(documentContextToken('tasks'));
    expect(tokens).to.include(documentContextToken('notes'));
  });

  it('marks a non-malformed spec as runnable', () => {
    const value = buildSpecTreeContextValue(ALL_DOCS, SpecStatus.InProgress);
    expect(value.split(' ')).to.include('runnable');
  });

  it('does not mark a malformed spec as runnable', () => {
    const value = buildSpecTreeContextValue(TASKS_ONLY, SpecStatus.Malformed);
    expect(value.split(' ')).to.not.include('runnable');
  });

  it('emits only tokens declared in the canonical vocabulary', () => {
    const emitted = buildSpecTreeContextValue(ALL_DOCS, SpecStatus.FullyCompleted).split(' ');
    emitted.forEach((token) => {
      expect(SPEC_TREE_CONTEXT_TOKENS).to.include(token);
    });
  });

  it('can emit every token of the canonical vocabulary (all docs, runnable)', () => {
    const emitted = buildSpecTreeContextValue(ALL_DOCS, SpecStatus.Completed).split(' ');
    SPEC_TREE_CONTEXT_TOKENS.forEach((token) => {
      expect(emitted).to.include(token);
    });
  });

  it('keeps the gating set as the vocabulary minus the bare spec base token', () => {
    expect(SPEC_TREE_MENU_GATING_TOKENS).to.deep.equal(
      SPEC_TREE_CONTEXT_TOKENS.filter((token) => 'spec' !== token),
    );
  });
});
