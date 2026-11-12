import type {
  DashboardOutboundMessage,
  IIntroductionMessage,
  IRenderMessage,
  ISpecUpdatedMessage,
  IStringsMessage,
} from '../core/model/IDashboardMessage';

/** One handler per message the host posts to the dashboard. */
export interface IDashboardMessageHandlers {
  /** The translated catalogue arrived. */
  strings(message: IStringsMessage): void;
  /** A full render arrived. */
  render(message: IRenderMessage): void;
  /** A scoped single-card update arrived. */
  specUpdated(message: ISpecUpdatedMessage): void;
  /** The host asked to flip the layout. */
  toggleLayout(): void;
  /** An entry-document introduction reply arrived. */
  introduction(message: IIntroductionMessage): void;
}

/**
 * Dispatch a host message, already received from the trusted origin, to its
 * handler. An unknown message type is ignored.
 * @param message The validated host message.
 * @param handlers The per-message handlers.
 */
export function routeDashboardMessage(
  message: DashboardOutboundMessage,
  handlers: IDashboardMessageHandlers,
): void {
  if ('strings' === message.type) {
    handlers.strings(message);
    return;
  }
  if ('render' === message.type) {
    handlers.render(message);
    return;
  }
  if ('specUpdated' === message.type) {
    handlers.specUpdated(message);
    return;
  }
  if ('toggleLayout' === message.type) {
    handlers.toggleLayout();
    return;
  }
  if ('introduction' === message.type) {
    handlers.introduction(message);
  }
}
