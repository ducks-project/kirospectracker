import { BOOT_AND_MESSAGE_SCENARIOS } from './scenarios-boot-and-messages';
import { CARD_AND_MENU_SCENARIOS } from './scenarios-cards-and-menus';
import { PREVIEW_SCENARIOS } from './scenarios-preview';
import { RENDER_AND_UPDATE_SCENARIOS } from './scenarios-render-and-updates';
import { RENDERING_COST_SCENARIOS } from './scenarios-rendering-cost';
import { TOOLBAR_AND_FILTER_SCENARIOS } from './scenarios-toolbar-and-filters';
import type { IDashboardScenario } from './run-dashboard-scenario';

/** Every dashboard scenario, in the order of their reference files. */
export const DASHBOARD_SCENARIOS: readonly IDashboardScenario[] = [
  ...BOOT_AND_MESSAGE_SCENARIOS,
  ...RENDER_AND_UPDATE_SCENARIOS,
  ...TOOLBAR_AND_FILTER_SCENARIOS,
  ...CARD_AND_MENU_SCENARIOS,
  ...PREVIEW_SCENARIOS,
  ...RENDERING_COST_SCENARIOS,
];
