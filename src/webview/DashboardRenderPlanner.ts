/** A region of the dashboard that a render pass may build or rebuild. */
export type DashboardRegion = 'stats' | 'toolbar' | 'content';

/**
 * A render plan: the ordered regions the renderer must build on this pass.
 *
 * The plan is the single source of truth for what the webview touches on a
 * render. The toolbar (which hosts the search input) is built only on the
 * initial mount and is deliberately absent from every later plan, so a render
 * triggered while the user types never destroys and recreates the search
 * input, and therefore never steals its focus or caret position.
 */
export interface IDashboardRenderPlan {
  /** Regions to build or rebuild on this pass, in insertion order. */
  readonly regions: readonly DashboardRegion[];
  /** Whether the persistent toolbar region must be created on this pass. */
  readonly buildsToolbar: boolean;
}

/** Regions built on the initial mount, in insertion order. */
const MOUNT_REGIONS: readonly DashboardRegion[] = ['stats', 'toolbar', 'content'];

/** Regions rebuilt on every later render, leaving the toolbar untouched. */
const UPDATE_REGIONS: readonly DashboardRegion[] = ['stats', 'content'];

/**
 * Decide which regions a dashboard render pass must build.
 *
 * This pure function encodes the focus-safe rendering contract: the toolbar is
 * a persistent region built once at mount; every subsequent render rebuilds
 * only the stats and content regions, leaving the toolbar element (and its live
 * search input) untouched. It carries no `vscode` or DOM dependency and is
 * therefore fully unit-testable.
 * @param isInitialMount Whether the app root is empty and must be built from scratch.
 * @returns The regions to build and whether the toolbar is among them.
 */
export function planDashboardRender(isInitialMount: boolean): IDashboardRenderPlan {
  if (true === isInitialMount) {
    return { regions: MOUNT_REGIONS, buildsToolbar: true };
  }
  return { regions: UPDATE_REGIONS, buildsToolbar: false };
}
