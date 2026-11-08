import type { DashboardLayout } from '../model/IDashboardMessage';

/** Semantic glyph identifiers the webview renders as representative icons. */
export type SpecLayoutGlyph = 'list' | 'grid';

/**
 * Accessible presentation of the single, flipping layout toggle button.
 *
 * A single button replaces the former two side-by-side options: it shows the
 * glyph of the layout it will switch TO (the convention), carries the matching
 * label, names the layout it activates on click, and exposes an `aria-pressed`
 * state. `pressed` is `true` when the grid layout is active: grid is modelled
 * as the toggle's "on" state so the control reads as "press to switch to grid,
 * press again to go back to list".
 */
export interface ISpecLayoutToggleView {
  /** The layout a click on the button activates (the opposite of the active one). */
  readonly nextLayout: DashboardLayout;
  /** Semantic glyph identifier the webview draws (the glyph of {@link nextLayout}). */
  readonly glyph: SpecLayoutGlyph;
  /** Accessible label and tooltip (e.g. `Switch to grid view`). */
  readonly label: string;
  /** Whether the grid layout is currently active (the toggle's "on" state). */
  readonly pressed: boolean;
}

/** Layout activated as the toggle's "on" state (grid), and its "off" state (list). */
const ON_LAYOUT: DashboardLayout = 'grid';

const OFF_LAYOUT: DashboardLayout = 'list';

/**
 * Pure mapper describing the single icon layout toggle shown in the dashboard
 * toolbar.
 *
 * It flips between list and grid: given the active layout, it returns the one
 * button's view (the glyph of the layout it will switch to, its label, the
 * layout a click activates, and the pressed state). Keeping the flip logic out
 * of the DOM makes the single-button contract unit-testable without a VS Code
 * host; the webview only renders the decision.
 */
export class SpecLayoutToggleView {
  /**
   * Describe the single layout toggle button for the active layout.
   * @param active The currently active layout.
   * @returns The flipping toggle view (next layout, glyph, label, pressed).
   */
  // eslint-disable-next-line class-methods-use-this
  public describeToggle(active: DashboardLayout): ISpecLayoutToggleView {
    const pressed = ON_LAYOUT === active;
    const nextLayout = pressed ? OFF_LAYOUT : ON_LAYOUT;
    return {
      nextLayout,
      glyph: nextLayout,
      label: `Switch to ${nextLayout} view`,
      pressed,
    };
  }
}
