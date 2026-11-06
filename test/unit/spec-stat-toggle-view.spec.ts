import { expect } from 'chai';

import type { ISpecStats } from '../../src/core/model/ISpecStats';
import { SpecStatToggleView } from '../../src/core/status/SpecStatToggleView';
import { SpecStatusFilter } from '../../src/core/status/SpecStatusFilter';

const view = new SpecStatToggleView();

const STATS: ISpecStats = {
  total: 10,
  completed: 4,
  inProgress: 3,
  notStarted: 2,
  malformed: 1,
};

/**
 * Behaviour specification for {@link SpecStatToggleView}.
 */
describe('SpecStatToggleView', () => {
  it('projects the four toggles in order with their counts', () => {
    const toggles = view.build(STATS, new SpecStatusFilter());
    expect(toggles.map((toggle) => toggle.key)).to.deep.equal([
      'completed',
      'inProgress',
      'notStarted',
      'malformed',
    ]);
    expect(toggles.map((toggle) => toggle.value)).to.deep.equal([4, 3, 2, 1]);
  });

  it('carries human labels', () => {
    const toggles = view.build(STATS, new SpecStatusFilter());
    expect(toggles[0].label).to.equal('Completed');
    expect(toggles[1].label).to.equal('In progress');
    expect(toggles[2].label).to.equal('Not started');
    expect(toggles[3].label).to.equal('Malformed');
  });

  it('reflects the pressed state of the active filter', () => {
    const filter = new SpecStatusFilter().toggle('inProgress');
    const toggles = view.build(STATS, filter);
    expect(toggles[0].pressed).to.equal(false);
    expect(toggles[1].pressed).to.equal(true);
  });
});
