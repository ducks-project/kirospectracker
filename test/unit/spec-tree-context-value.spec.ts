import { expect } from 'chai';

import type { ISpecDocuments } from '../../src/core/model/ISpecDocuments';
import { SpecStatus } from '../../src/core/model/SpecStatus';
import {
  buildSpecTreeContextValue,
  documentContextToken,
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
});
