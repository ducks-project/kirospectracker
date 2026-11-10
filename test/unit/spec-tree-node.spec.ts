import { expect } from 'chai';

import type { ISpecSnapshot } from '../../src/core/model/ISpecSnapshot';
import { SpecStatus } from '../../src/core/model/SpecStatus';
import { resolveSpecNodeFolderPath } from '../../src/adapters/SpecTreeNode';

/** A well-formed spec snapshot with a real string folder path. */
const SNAPSHOT: ISpecSnapshot = {
  name: 'alpha',
  folderPath: '/ws/.kiro/specs/alpha',
  workspacePath: '/ws',
  documents: { tasks: true, requirements: true, design: false, notes: false, bugfix: false },
  entryDocument: undefined,
  status: SpecStatus.InProgress,
  progress: {
    requiredRatio: 0.5,
    optionalRatio: 0,
    requiredDone: 1,
    requiredTotal: 2,
    optionalDone: 0,
    optionalTotal: 0,
    requiredResolvedDone: 1,
    requiredResolvedCancelled: 0,
    requiredInProgress: 0,
    requiredTodo: 1,
    optionalResolvedDone: 0,
    optionalResolvedCancelled: 0,
    optionalInProgress: 0,
    optionalTodo: 0,
  },
};

/**
 * Behaviour specification for the defensive {@link resolveSpecNodeFolderPath}
 * guard.
 */
describe('resolveSpecNodeFolderPath', () => {
  it('returns the folder path of a well-formed spec leaf', () => {
    expect(resolveSpecNodeFolderPath({ kind: 'spec', spec: SNAPSHOT })).to.equal(
      '/ws/.kiro/specs/alpha',
    );
  });

  it('rejects a non-object argument', () => {
    expect(resolveSpecNodeFolderPath(undefined)).to.equal(undefined);
    expect(resolveSpecNodeFolderPath(null)).to.equal(undefined);
    expect(resolveSpecNodeFolderPath('spec')).to.equal(undefined);
  });

  it('rejects a group node', () => {
    const group = { kind: 'group', group: { label: 'In progress', specs: [] } };
    expect(resolveSpecNodeFolderPath(group)).to.equal(undefined);
  });

  it('rejects a spec node without a spec payload', () => {
    expect(resolveSpecNodeFolderPath({ kind: 'spec' })).to.equal(undefined);
  });

  it('rejects a spec node whose folderPath is missing', () => {
    const malformed = { kind: 'spec', spec: { ...SNAPSHOT, folderPath: undefined } };
    expect(resolveSpecNodeFolderPath(malformed)).to.equal(undefined);
  });

  it('rejects a spec node whose folderPath is a non-string value', () => {
    const numericPath = { kind: 'spec', spec: { ...SNAPSHOT, folderPath: 42 } };
    const objectPath = { kind: 'spec', spec: { ...SNAPSHOT, folderPath: {} } };
    expect(resolveSpecNodeFolderPath(numericPath)).to.equal(undefined);
    expect(resolveSpecNodeFolderPath(objectPath)).to.equal(undefined);
  });
});
