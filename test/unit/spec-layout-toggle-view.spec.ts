import { expect } from 'chai';

import { SpecLayoutToggleView } from '../../src/core/status/SpecLayoutToggleView';

const view = new SpecLayoutToggleView();

/**
 * Behaviour specification for {@link SpecLayoutToggleView}.
 */
describe('SpecLayoutToggleView', () => {
  it('lists the list and grid options with glyphs and labels', () => {
    const options = view.listOptions();
    expect(options.map((option) => option.layout)).to.deep.equal(['list', 'grid']);
    expect(options.map((option) => option.glyph)).to.deep.equal(['list', 'grid']);
    expect(options.map((option) => option.label)).to.deep.equal(['List view', 'Grid view']);
  });

  it('marks only the active layout as pressed', () => {
    const [listOption, gridOption] = view.listOptions();
    expect(view.isPressed(listOption, 'list')).to.equal(true);
    expect(view.isPressed(gridOption, 'list')).to.equal(false);
    expect(view.isPressed(gridOption, 'grid')).to.equal(true);
  });
});
