import { expect } from 'chai';

import { planDashboardRender } from '../../src/webview/DashboardRenderPlanner';

/**
 * Behaviour specification for {@link planDashboardRender}.
 *
 * These cases capture the search-focus regression: before the fix the whole app
 * root (toolbar included) was rebuilt on every render, so the search input was
 * destroyed and recreated mid-typing and lost its focus. The planner now
 * guarantees the toolbar is built only on the initial mount and is never
 * rebuilt afterwards.
 */
describe('planDashboardRender', () => {
  it('builds the toolbar once on the initial mount', () => {
    const plan = planDashboardRender(true);
    expect(plan.buildsToolbar).to.equal(true);
    expect(plan.regions).to.deep.equal(['stats', 'toolbar', 'content']);
  });

  it('never rebuilds the toolbar on a later render so the search input survives', () => {
    const plan = planDashboardRender(false);
    expect(plan.buildsToolbar).to.equal(false);
    expect(plan.regions).to.not.include('toolbar');
  });

  it('still refreshes stats and content on a later render', () => {
    const plan = planDashboardRender(false);
    expect(plan.regions).to.deep.equal(['stats', 'content']);
  });
});
