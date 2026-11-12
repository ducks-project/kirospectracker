import { expect } from 'chai';
import { buildGlobalStatsModel } from '../../src/webview/stats/GlobalStatsViewModel';
import { IDENTITY_VIEW_TEXT } from '../helpers/identity-view-text';

describe('buildGlobalStatsModel', () => {
  const stats = {
    done: 1,
    cancelled: 2,
    inProgress: 3,
    todo: 4,
    total: 10,
    percentComplete: 0.3,
  };

  it('lists done, cancelled, in progress, to-do and overall in display order', () => {
    const model = buildGlobalStatsModel(stats, IDENTITY_VIEW_TEXT);
    expect(model.items).to.deep.equal([
      { cssClass: 'global-stat-done', label: 'done', value: '1' },
      { cssClass: 'global-stat-cancelled', label: 'cancelled', value: '2' },
      { cssClass: 'global-stat-inProgress', label: 'in progress', value: '3' },
      { cssClass: 'global-stat-todo', label: 'to-do', value: '4' },
      { cssClass: 'global-stat-overall', label: 'resolved', value: '30%' },
    ]);
  });

  it('rounds the resolved ratio to a whole percentage', () => {
    const model = buildGlobalStatsModel({ ...stats, percentComplete: 0.666 }, IDENTITY_VIEW_TEXT);
    expect(model.items[4]).to.deep.equal({
      cssClass: 'global-stat-overall',
      label: 'resolved',
      value: '67%',
    });
  });
});
