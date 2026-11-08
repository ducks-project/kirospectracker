import { expect } from 'chai';

import { SpecLayoutToggleView } from '../../src/core/status/SpecLayoutToggleView';

const view = new SpecLayoutToggleView();

/**
 * Behaviour specification for {@link SpecLayoutToggleView}.
 */
describe('SpecLayoutToggleView', () => {
  it('shows the grid glyph and switches to grid when the list layout is active', () => {
    const toggle = view.describeToggle('list');
    expect(toggle.nextLayout).to.equal('grid');
    expect(toggle.glyph).to.equal('grid');
    expect(toggle.label).to.equal('Switch to grid view');
    expect(toggle.pressed).to.equal(false);
  });

  it('shows the list glyph and switches to list when the grid layout is active', () => {
    const toggle = view.describeToggle('grid');
    expect(toggle.nextLayout).to.equal('list');
    expect(toggle.glyph).to.equal('list');
    expect(toggle.label).to.equal('Switch to list view');
    expect(toggle.pressed).to.equal(true);
  });

  it('shows the glyph of the layout it switches to (single flipping button)', () => {
    expect(view.describeToggle('list').glyph).to.equal(view.describeToggle('list').nextLayout);
    expect(view.describeToggle('grid').glyph).to.equal(view.describeToggle('grid').nextLayout);
  });
});
