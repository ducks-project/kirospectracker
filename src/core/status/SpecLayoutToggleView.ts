import type { DashboardLayout } from '../model/IDashboardMessage';

/** Semantic glyph identifiers the webview renders as representative icons. */
export type SpecLayoutGlyph = 'list' | 'grid';

/** Accessible presentation of one layout toggle option (icon + labels). */
export interface ISpecLayoutOptionView {
  /** The layout this option activates. */
  readonly layout: DashboardLayout;
  /** Semantic glyph identifier the webview draws (list rows vs. grid cells). */
  readonly glyph: SpecLayoutGlyph;
  /** Accessible label and tooltip (e.g. `List view`). */
  readonly label: string;
}

/** The two layout options, in display order, with their representative glyphs. */
const LAYOUT_OPTIONS: readonly ISpecLayoutOptionView[] = [
  { layout: 'list', glyph: 'list', label: 'List view' },
  { layout: 'grid', glyph: 'grid', label: 'Grid view' },
];

/**
 * Pure mapper describing the icon layout toggles shown in the dashboard
 * toolbar.
 *
 * It exposes the ordered layout options (each with its codicon glyph and
 * accessible label) and tells which option is currently pressed, so the webview
 * only renders the decision. Keeping the mapping out of the DOM makes the
 * list/grid icon contract unit-testable without a VS Code host.
 */
export class SpecLayoutToggleView {
  /** The ordered layout options shared across calls. */
  private readonly options: readonly ISpecLayoutOptionView[] = LAYOUT_OPTIONS;

  /**
   * The ordered layout toggle options to render.
   * @returns The layout options with their glyphs and labels.
   */
  public listOptions(): readonly ISpecLayoutOptionView[] {
    return this.options;
  }

  /**
   * Whether a given option is the active (pressed) layout.
   * @param option The option to test.
   * @param active The currently active layout.
   * @returns `true` when the option matches the active layout.
   */
  // eslint-disable-next-line class-methods-use-this
  public isPressed(option: ISpecLayoutOptionView, active: DashboardLayout): boolean {
    return option.layout === active;
  }
}
