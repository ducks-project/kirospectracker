import { expect } from 'chai';
import {
  computeHoverPlacement,
  HOVER_ARROW_MIN_INSET,
  HOVER_ARROW_SIZE,
  HOVER_VIEWPORT_MARGIN,
} from '../../src/webview/preview/computeHoverPlacement';
import type { IHoverRect, IHoverSize } from '../../src/webview/preview/computeHoverPlacement';

const VIEWPORT: IHoverSize = { width: 400, height: 600 };
const PANEL: IHoverSize = { width: 200, height: 100 };
const card = (left: number, top: number, width = 100, height = 50): IHoverRect => ({
  left,
  right: left + width,
  top,
  bottom: top + height,
});

describe('computeHoverPlacement', () => {
  it('places the popin below the card when there is room', () => {
    const result = computeHoverPlacement({
      anchor: card(50, 100),
      panel: PANEL,
      viewport: VIEWPORT,
    });
    expect(result.side).to.equal('below');
    expect(result.top).to.equal(150 + HOVER_ARROW_SIZE);
    expect(result.left).to.equal(50);
  });
  it('flips above when below is too tight but above fits', () => {
    const result = computeHoverPlacement({
      anchor: card(50, 500),
      panel: PANEL,
      viewport: VIEWPORT,
    });
    expect(result.side).to.equal('above');
    expect(result.top).to.equal(500 - HOVER_ARROW_SIZE - PANEL.height);
  });
  it('picks the roomier side and clamps when neither fits (above)', () => {
    const tall: IHoverSize = { width: 200, height: 580 };
    const result = computeHoverPlacement({
      anchor: card(50, 400),
      panel: tall,
      viewport: VIEWPORT,
    });
    expect(result.side).to.equal('above');
    expect(result.top).to.equal(HOVER_VIEWPORT_MARGIN);
  });
  it('picks the roomier side and clamps when neither fits (below)', () => {
    const tall: IHoverSize = { width: 200, height: 580 };
    const result = computeHoverPlacement({
      anchor: card(50, 100),
      panel: tall,
      viewport: VIEWPORT,
    });
    expect(result.side).to.equal('below');
    expect(result.top).to.equal(600 - 580 - HOVER_VIEWPORT_MARGIN);
  });
  it('clamps to the left edge', () => {
    const result = computeHoverPlacement({
      anchor: card(-30, 100),
      panel: PANEL,
      viewport: VIEWPORT,
    });
    expect(result.left).to.equal(HOVER_VIEWPORT_MARGIN);
  });
  it('clamps to the right edge', () => {
    const result = computeHoverPlacement({
      anchor: card(350, 100),
      panel: PANEL,
      viewport: VIEWPORT,
    });
    expect(result.left).to.equal(400 - 200 - HOVER_VIEWPORT_MARGIN);
  });
  it('aims the arrow at the card centre, relative to the popin', () => {
    const result = computeHoverPlacement({
      anchor: card(50, 100),
      panel: PANEL,
      viewport: VIEWPORT,
    });
    expect(result.arrowLeft).to.equal(50);
  });
  it('keeps the arrow away from the left corner', () => {
    const result = computeHoverPlacement({
      anchor: card(50, 100, 4),
      panel: PANEL,
      viewport: VIEWPORT,
    });
    expect(result.arrowLeft).to.equal(HOVER_ARROW_MIN_INSET);
  });
  it('keeps the arrow away from the right corner', () => {
    const result = computeHoverPlacement({
      anchor: card(50, 100, 1000),
      panel: PANEL,
      viewport: VIEWPORT,
    });
    expect(result.arrowLeft).to.equal(PANEL.width - HOVER_ARROW_MIN_INSET);
  });
  it('pins a popin wider than the viewport to the left margin', () => {
    const wide: IHoverSize = { width: 500, height: 100 };
    const result = computeHoverPlacement({
      anchor: card(50, 100),
      panel: wide,
      viewport: VIEWPORT,
    });
    expect(result.left).to.equal(HOVER_VIEWPORT_MARGIN);
  });
});
