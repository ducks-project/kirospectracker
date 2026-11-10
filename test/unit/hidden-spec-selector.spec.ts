import { expect } from 'chai';
import { HiddenSpecSelector } from '../../src/core/hiding/HiddenSpecSelector';
import { SpecStatus } from '../../src/core/model/SpecStatus';
import { buildSnapshot } from '../helpers/spec-snapshot-builder';

describe('HiddenSpecSelector', () => {
  const selector = new HiddenSpecSelector();

  it('selects only the chosen statuses, grouped by workspace', () => {
    const selection = selector.select(
      [
        buildSnapshot('a', SpecStatus.Completed, '/one'),
        buildSnapshot('b', SpecStatus.InProgress, '/one'),
        buildSnapshot('c', SpecStatus.FullyCompleted, '/two'),
      ],
      new Set([SpecStatus.Completed, SpecStatus.FullyCompleted]),
    );
    expect(selection.globsByWorkspace.get('/one')).to.deep.equal(['**/.kiro/specs/a/**']);
    expect(selection.globsByWorkspace.get('/two')).to.deep.equal(['**/.kiro/specs/c/**']);
    expect(selection.skipped).to.deep.equal([]);
  });

  it('selects nothing for an empty status set', () => {
    const selection = selector.select([buildSnapshot('a', SpecStatus.Completed)], new Set());
    expect(selection.globsByWorkspace.size).to.equal(0);
  });

  it('skips selected specs whose name has no reliable glob', () => {
    const selection = selector.select(
      [buildSnapshot('we{ird', SpecStatus.Completed)],
      new Set([SpecStatus.Completed]),
    );
    expect(selection.globsByWorkspace.size).to.equal(0);
    expect(selection.skipped).to.deep.equal([{ workspacePath: '/ws', name: 'we{ird' }]);
  });
});
