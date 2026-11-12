import { expect } from 'chai';
import { SpecStatus } from '../../src/core/model/SpecStatus';
import { planSpecUpdate } from '../../src/webview/card/SpecUpdatePlanner';
import { buildCardView } from '../helpers/spec-card-view-builder';

describe('planSpecUpdate', () => {
  it('swaps the node when the card stays in the same group', () => {
    const previous = buildCardView(SpecStatus.InProgress);
    const next = buildCardView(SpecStatus.NotStarted);
    expect(planSpecUpdate(previous, next, true)).to.equal('swap-node');
  });

  it('rebuilds the content when the card changes group', () => {
    const previous = buildCardView(SpecStatus.InProgress);
    const next = buildCardView(SpecStatus.Completed);
    expect(planSpecUpdate(previous, next, true)).to.equal('rebuild-content');
  });

  it('rebuilds the content when the card is not mounted', () => {
    const card = buildCardView(SpecStatus.InProgress);
    expect(planSpecUpdate(card, card, false)).to.equal('rebuild-content');
  });

  it('rebuilds the content when the previous card is unknown', () => {
    expect(planSpecUpdate(undefined, buildCardView(SpecStatus.InProgress), true)).to.equal(
      'rebuild-content',
    );
  });
});
