import { expect } from 'chai';

import type { ISpecProgress } from '../../src/core/model/ISpecProgress';
import type { ISpecSnapshot } from '../../src/core/model/ISpecSnapshot';
import { SpecStatus } from '../../src/core/model/SpecStatus';
import { SpecCardViewMapper } from '../../src/core/status/SpecCardViewMapper';

/** Progress fixture shared across the mapper fixtures. */
const PROGRESS: ISpecProgress = {
  requiredDone: 1,
  requiredTotal: 2,
  optionalDone: 0,
  optionalTotal: 1,
  requiredRatio: 0.5,
  optionalRatio: 0,
};

/**
 * Build a snapshot fixture carrying a non-empty task tree.
 * @param name Spec name.
 * @returns The snapshot fixture.
 */
function makeSnapshot(name: string): ISpecSnapshot {
  return {
    name,
    folderPath: `/ws/.kiro/specs/${name}`,
    workspacePath: '/ws',
    documents: { tasks: true, requirements: true, design: false, notes: false },
    tasks: [
      { id: '1', title: 'Task', done: false, optional: false, children: [], requirements: [] },
    ],
    status: SpecStatus.InProgress,
    progress: PROGRESS,
  };
}

/**
 * Behaviour specification for {@link SpecCardViewMapper}.
 */
describe('SpecCardViewMapper', () => {
  const mapper = new SpecCardViewMapper();

  it('projects the five card fields and omits tasks', () => {
    const snapshot = makeSnapshot('alpha');
    const card = mapper.map(snapshot);
    expect(card).to.deep.equal({
      name: 'alpha',
      folderPath: '/ws/.kiro/specs/alpha',
      documents: snapshot.documents,
      status: SpecStatus.InProgress,
      progress: PROGRESS,
    });
    expect(card).to.not.have.property('tasks');
  });

  it('mapAll preserves order and length', () => {
    const snapshots = [makeSnapshot('alpha'), makeSnapshot('beta'), makeSnapshot('gamma')];
    const cards = mapper.mapAll(snapshots);
    expect(cards).to.have.length(3);
    expect(cards.map((card) => card.name)).to.deep.equal(['alpha', 'beta', 'gamma']);
  });
});
