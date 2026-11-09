/** Viewport margin, in pixels, kept between the popin and the window edges. */
export const HOVER_VIEWPORT_MARGIN = 8;
/** Height, in pixels, of the arrow; also the gap left between card and popin. */
export const HOVER_ARROW_SIZE = 8;
/** Minimal distance, in pixels, between the arrow centre and a popin edge (rounded corners). */
export const HOVER_ARROW_MIN_INSET = 14;
/** Side of the card the popin is placed on. */
export type HoverSide = 'below' | 'above';
/** Rectangle of a card, in viewport coordinates. */
export interface IHoverRect {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}
/** Width and height, in pixels. */
export interface IHoverSize {
  readonly width: number;
  readonly height: number;
}
/** Geometry the placement is computed from. */
export interface IHoverPlacementInput {
  readonly anchor: IHoverRect;
  readonly panel: IHoverSize;
  readonly viewport: IHoverSize;
}
/** Computed popin placement, in viewport coordinates. */
export interface IHoverPlacement {
  readonly side: HoverSide;
  readonly left: number;
  readonly top: number;
  /** Arrow centre, relative to the popin's left edge. */
  readonly arrowLeft: number;
}
/**
 * Clamp a value into `[min, max]`; when the range is inverted, `min` wins.
 * @param value The value to clamp.
 * @param min Lower bound.
 * @param max Upper bound.
 * @returns The clamped value.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
/**
 * Choose the side: below when it fits, else above when it fits, else the roomier one.
 * @param input The geometry.
 * @returns The chosen side.
 */
function chooseSide(input: IHoverPlacementInput): HoverSide {
  const reserved = HOVER_ARROW_SIZE + HOVER_VIEWPORT_MARGIN;
  const spaceBelow = input.viewport.height - input.anchor.bottom - reserved;
  const spaceAbove = input.anchor.top - reserved;
  if (input.panel.height <= spaceBelow) {
    return 'below';
  }
  if (input.panel.height <= spaceAbove) {
    return 'above';
  }
  return spaceAbove > spaceBelow ? 'above' : 'below';
}
/**
 * Compute where to put the hover popin relative to its card.
 *
 * The popin prefers the area below the card, flips above when it does not fit
 * there but fits above, and otherwise takes the side with more room and is
 * clamped inside the viewport. It is left-aligned on the card, clamped
 * horizontally, and its arrow targets the card's horizontal centre.
 * @param input The card rectangle, popin size and viewport size.
 * @returns The side, position and arrow offset.
 */
export function computeHoverPlacement(input: IHoverPlacementInput): IHoverPlacement {
  const { anchor, panel, viewport } = input;
  const side = chooseSide(input);
  const rawTop =
    'below' === side
      ? anchor.bottom + HOVER_ARROW_SIZE
      : anchor.top - HOVER_ARROW_SIZE - panel.height;
  const top = clamp(
    rawTop,
    HOVER_VIEWPORT_MARGIN,
    viewport.height - panel.height - HOVER_VIEWPORT_MARGIN,
  );
  const left = clamp(
    anchor.left,
    HOVER_VIEWPORT_MARGIN,
    viewport.width - panel.width - HOVER_VIEWPORT_MARGIN,
  );
  const centre = (anchor.left + anchor.right) / 2;
  const arrowLeft = clamp(
    centre - left,
    HOVER_ARROW_MIN_INSET,
    panel.width - HOVER_ARROW_MIN_INSET,
  );
  return { side, left, top, arrowLeft };
}
