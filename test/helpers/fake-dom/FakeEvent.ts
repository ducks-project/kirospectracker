import type { FakeEventTarget } from './FakeEventTarget';
import { strictProxy } from './strict-proxy';

/** Optional fields a fake event can carry (keyboard and message events). */
export interface IFakeEventInit {
  readonly bubbles?: boolean;
  readonly key?: string;
  readonly shiftKey?: boolean;
  readonly origin?: string;
  readonly data?: unknown;
}

/**
 * Minimal DOM event. Only the members the dashboard reads exist; any other member
 * throws (see {@link strictProxy}).
 */
export class FakeEvent {
  public readonly type: string;
  public readonly bubbles: boolean;
  public readonly key: string | undefined;
  public readonly shiftKey: boolean;
  public readonly origin: string | undefined;
  public readonly data: unknown;
  public target: FakeEventTarget | null = null;
  public currentTarget: FakeEventTarget | null = null;
  public defaultPrevented = false;
  /** Whether `stopPropagation` was called (read by the dispatcher). */
  public propagationStopped = false;

  /**
   * Build an event.
   * @param type Event type, e.g. `click`.
   * @param init Optional fields.
   */
  public constructor(type: string, init: IFakeEventInit = {}) {
    this.type = type;
    this.bubbles = init.bubbles ?? false;
    this.key = init.key;
    this.shiftKey = init.shiftKey ?? false;
    this.origin = init.origin;
    this.data = init.data;
  }

  /** Mark the default action as prevented. */
  public preventDefault(): void {
    this.defaultPrevented = true;
  }

  /** Stop the event from reaching the next node of its propagation path. */
  public stopPropagation(): void {
    this.propagationStopped = true;
  }
}

/**
 * Create a strict (closed-API) event.
 * @param type Event type.
 * @param init Optional fields.
 * @returns The event.
 */
export function createFakeEvent(type: string, init: IFakeEventInit = {}): FakeEvent {
  return strictProxy(new FakeEvent(type, init), 'Event');
}
