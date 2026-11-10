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
  bugfix: true,
};

/** Only tasks present. */
const TASKS_ONLY: ISpecDocuments = {
  tasks: true,
  requirements: false,
  design: false,
  notes: false,
  bugfix: false,
};

/**
 * Behaviour specification for {@link buildSpecTreeContextValue}.
 *
 * The token contract backs the declarative `view/item/context` `when` clauses:
 * a document action is shown only when its `doc-<kind>` token is present, and
 * the agent task actions only when the agent-action tokens are present
 * (non-malformed spec).
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

  it('marks a non-malformed spec with the agent-action tokens', () => {
    const tokens = buildSpecTreeContextValue(ALL_DOCS, SpecStatus.InProgress).split(' ');
    expect(tokens).to.include('agent-sync');
    expect(tokens).to.include('agent-run-required');
    expect(tokens).to.include('agent-run-optional');
  });

  it('does not mark a malformed spec with the agent-action tokens', () => {
    const tokens = buildSpecTreeContextValue(TASKS_ONLY, SpecStatus.Malformed).split(' ');
    expect(tokens).to.not.include('agent-sync');
    expect(tokens).to.not.include('agent-run-required');
    expect(tokens).to.not.include('agent-run-optional');
  });

  it('emits only tokens declared in the canonical vocabulary', () => {
    const emitted = buildSpecTreeContextValue(ALL_DOCS, SpecStatus.FullyCompleted).split(' ');
    emitted.forEach((token) => {
      expect(SPEC_TREE_CONTEXT_TOKENS).to.include(token);
    });
  });

  it('can emit every token of the canonical vocabulary (all docs, non-malformed)', () => {
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
  it('emits the doc-bugfix token only when bugfix.md is present', () => {
    const present = buildSpecTreeContextValue({ ...ALL_DOCS, bugfix: true }, SpecStatus.Completed);
    expect(present.split(' ')).to.include('doc-bugfix');
    expect(buildSpecTreeContextValue(TASKS_ONLY, SpecStatus.Completed).split(' ')).to.not.include(
      'doc-bugfix',
    );
  });
});
