import type { DashboardStore } from '../state/DashboardStore';
import type { IDashboardActions } from '../state/IDashboardActions';
import type { ViewText } from '../state/ViewText';

/** Dependencies the toolbar controls read at event time (live state, not snapshots). */
export interface IToolbarDeps {
  /** Render state (cards, folder filter, layout, query). */
  readonly store: DashboardStore;
  /** Translation surface and the translated core projectors. */
  readonly text: ViewText;
  /** The dashboard intents. */
  readonly actions: IDashboardActions;
}
