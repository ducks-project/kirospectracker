import type { ILayoutToggleable } from '../ports/ILayoutToggleable';

/** Command identifier contributed in package.json. */
export const TOGGLE_LAYOUT_COMMAND_ID = 'kirospectracker.toggleLayout';

/**
 * Command toggling the dashboard layout between list and grid.
 *
 * It delegates to an {@link ILayoutToggleable} (the dashboard provider), which
 * asks the live webview to swap its layout; the webview persists the choice in
 * its own state.
 */
export class ToggleLayoutCommand {
  private readonly toggleable: ILayoutToggleable;

  /**
   * Build the command over the layout-toggleable dashboard.
   * @param toggleable The dashboard exposing a layout toggle.
   */
  public constructor(toggleable: ILayoutToggleable) {
    this.toggleable = toggleable;
  }

  /**
   * Toggle the dashboard layout.
   */
  public execute(): void {
    this.toggleable.toggleLayout();
  }
}
