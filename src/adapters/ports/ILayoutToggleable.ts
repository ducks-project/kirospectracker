/**
 * Port exposing the dashboard layout toggle to the toggle command.
 *
 * Depending on this narrow abstraction (rather than the concrete `vscode`-bound
 * dashboard provider) keeps {@link ToggleLayoutCommand} host-agnostic and
 * unit-testable.
 */
export interface ILayoutToggleable {
  /**
   * Toggle the dashboard layout between list and grid.
   */
  toggleLayout(): void;
}
