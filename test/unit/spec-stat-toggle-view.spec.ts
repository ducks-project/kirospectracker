import { expect } from 'chai';

import type { ISpecStats } from '../../src/core/model/ISpecStats';
import { FRENCH_TRANSLATOR } from '../helpers/french-translator';
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

  it('reads each filter key from its own stats field through the explicit map', () => {
    // Distinct counts per field so any mis-indexing would surface a wrong value.
    const distinct: ISpecStats = {
      total: 100,
      completed: 11,
      inProgress: 22,
      notStarted: 33,
      malformed: 44,
    };
    const byKey = new Map(
      view.build(distinct, new SpecStatusFilter()).map((t) => [t.key, t.value]),
    );
    expect(byKey.get('completed')).to.equal(11);
    expect(byKey.get('inProgress')).to.equal(22);
    expect(byKey.get('notStarted')).to.equal(33);
    expect(byKey.get('malformed')).to.equal(44);
  });
  it('keeps the English labels identical for every count', () => {
    [0, 1, 2, 11].forEach((count) => {
      const stats: ISpecStats = {
        total: 4 * count,
        completed: count,
        inProgress: count,
        notStarted: count,
        malformed: count,
      };
      const labels = view.build(stats, new SpecStatusFilter()).map((toggle) => toggle.label);
      expect(labels).to.deep.equal(['Completed', 'In progress', 'Not started', 'Malformed']);
    });
  });
  it('agrees the French labels with the count', () => {
    const french = new SpecStatToggleView(FRENCH_TRANSLATOR);
    const stats: ISpecStats = {
      total: 29,
      completed: 11,
      inProgress: 3,
      notStarted: 14,
      malformed: 1,
    };
    const toggles = french.build(stats, new SpecStatusFilter());
    expect(toggles.map((toggle) => `${toggle.value} ${toggle.label}`)).to.deep.equal([
      '11 Terminées',
      '3 En cours',
      '14 Non démarrées',
      '1 Mal formée',
    ]);
    const single = french.build({ ...stats, completed: 1, notStarted: 0 }, new SpecStatusFilter());
    expect(single[0].label).to.equal('Terminée');
    expect(single[2].label).to.equal('Non démarrée');
  });
});
