/** SVG namespace used to build the toolbar icon glyphs. */
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Icon viewBox side length (a 16x16 grid, codicon convention). */
const ICON_SIZE = 16;

/** Path data for each representative toolbar glyph, drawn on a 16x16 grid. */
const ICON_PATHS: Readonly<Record<string, string>> = {
  // Three stacked rows, i.e. a list.
  list: 'M2 3h12v2H2V3zm0 4h12v2H2V7zm0 4h12v2H2v-2z',
  // Four cells, i.e. a grid.
  grid: 'M2 2h5v5H2V2zm7 0h5v5H9V2zM2 9h5v5H2V9zm7 0h5v5H9V9z',
  // A diagonal cross, i.e. a clear/close glyph.
  close: 'M4 3L3 4l3.5 3.5L3 11l1 1 3.5-3.5L11 12l1-1-3.5-3.5L12 4l-1-1-3.5 3.5L4 3z',
  // A funnel, i.e. a filter glyph (matching the Extensions view affordance).
  filter: 'M1 2h14v2l-5 5v5l-4-2V9L1 4V2z',
  // An eye (almond outline plus pupil), i.e. a preview glyph; drawn for the even-odd rule.
  eye: 'M8 3C4.5 3 2 6 1 8c1 2 3.5 5 7 5s6-3 7-5c-1-2-3.5-5-7-5zM8 4.2C5.4 4.2 3.4 6.4 2.4 8c1 1.6 3 3.8 5.6 3.8s4.6-2.2 5.6-3.8C12.6 6.4 10.6 4.2 8 4.2zM8 5.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z',
};
/** Glyphs whose sub-paths overlap and need the even-odd fill rule. */
const EVEN_ODD_GLYPHS: ReadonlySet<string> = new Set(['eye']);

/**
 * Build a static, decorative SVG icon for a known glyph name.
 *
 * The icon is assembled with `createElementNS`/`setAttribute` only (never
 * `innerHTML`), uses `currentColor` so it inherits the button's theme color, and
 * is marked `aria-hidden` because the hosting button already carries the label.
 * @param glyph The glyph name (a key of {@link ICON_PATHS}).
 * @returns The SVG element.
 */
export function icon(glyph: string): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  const side = String(ICON_SIZE);
  Object.entries({
    viewBox: `0 0 ${side} ${side}`,
    width: side,
    height: side,
    'aria-hidden': 'true',
    focusable: 'false',
  }).forEach(([name, value]) => svg.setAttribute(name, value));
  svg.classList.add('icon');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICON_PATHS[glyph] ?? '');
  path.setAttribute('fill', 'currentColor');
  if (EVEN_ODD_GLYPHS.has(glyph)) {
    path.setAttribute('fill-rule', 'evenodd');
  }
  svg.appendChild(path);
  return svg;
}
