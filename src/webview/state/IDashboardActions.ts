import type { DashboardInboundMessage } from '../../core/model/IDashboardMessage';
import type { SpecFilterKey } from '../../core/model/SpecFilterKey';

/**
 * Intents the dashboard views raise. The composition root (`main.ts`) implements
 * them with closures that keep the effect order: mutate and persist the state,
 * post to the host, then redraw. Views never reach the renderer directly, which
 * breaks the render cycle without a subscription store.
 */
export interface IDashboardActions {
  /**
   * Toggle a status filter key, persist the new set and re-render.
   * @param key The filter key to toggle.
   */
  toggleStatusFilter(key: SpecFilterKey): void;
  /**
   * Post a message to the extension host.
   * @param message The inbound message.
   */
  post(message: DashboardInboundMessage): void;
}
