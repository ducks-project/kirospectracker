import type { FakeEvent } from './FakeEvent';

/** An event listener as registered by the dashboard. */
export type FakeListener = (event: FakeEvent) => void;

/** One registered listener. */
export interface IListenerRecord {
  readonly type: string;
  readonly listener: FakeListener;
  readonly capture: boolean;
}

/** Listener options the fake understands; anything else throws. */
const SUPPORTED_OPTIONS: ReadonlySet<string> = new Set(['capture', 'passive']);

/**
 * Resolve the `capture` flag from the third argument of `addEventListener`.
 * @param options A boolean or an options object.
 * @returns Whether the listener is a capture listener.
 */
function resolveCapture(options: unknown): boolean {
  if (undefined === options) {
    return false;
  }
  if ('boolean' === typeof options) {
    return options;
  }
  if ('object' !== typeof options || null === options) {
    throw new Error('Unsupported DOM API: addEventListener options must be a boolean or an object');
  }
  Object.keys(options).forEach((name) => {
    if (!SUPPORTED_OPTIONS.has(name)) {
      throw new Error(`Unsupported DOM API: addEventListener option "${name}"`);
    }
  });
  return true === (options as { capture?: boolean }).capture;
}

/**
 * Event target with a W3C-style dispatch: capture phase from the root down, the
 * target itself (capture listeners first), then the bubble phase back up.
 * `stopPropagation` takes effect once the listeners of the current node ran.
 */
export class FakeEventTarget {
  private registered: IListenerRecord[] = [];

  /**
   * Parent in the event path (`undefined` for the root).
   * @returns The next target up the path.
   */
  protected eventParent(): FakeEventTarget | undefined {
    return undefined;
  }

  /**
   * Register a listener (a duplicate type/listener/capture triple is ignored, as in browsers).
   * @param type Event type.
   * @param listener Callback.
   * @param options `capture` boolean or `{ capture, passive }`.
   */
  public addEventListener(type: string, listener: FakeListener, options?: unknown): void {
    const capture = resolveCapture(options);
    const duplicate = this.registered.some(
      (record) =>
        type === record.type && listener === record.listener && capture === record.capture,
    );
    if (!duplicate) {
      this.registered.push({ type, listener, capture });
    }
  }

  /**
   * Remove a listener.
   * @param type Event type.
   * @param listener Callback.
   * @param options `capture` boolean or `{ capture }`.
   */
  public removeEventListener(type: string, listener: FakeListener, options?: unknown): void {
    const capture = resolveCapture(options);
    this.registered = this.registered.filter(
      (record) =>
        !(type === record.type && listener === record.listener && capture === record.capture),
    );
  }

  /**
   * Listeners in registration order, for serialisation.
   * @returns A copy of the registered listeners.
   */
  public listenerRecords(): readonly IListenerRecord[] {
    return [...this.registered];
  }

  /**
   * Dispatch an event through its propagation path.
   * @param event The event.
   * @returns `true` unless a listener prevented the default action.
   */
  public dispatchEvent(event: FakeEvent): boolean {
    const path = this.propagationPath();
    event.target = this;
    for (let index = path.length - 1; 0 < index && !event.propagationStopped; index -= 1) {
      path[index].invoke(event, true);
    }
    if (!event.propagationStopped) {
      this.invoke(event, true);
      this.invoke(event, false);
    }
    for (
      let index = 1;
      event.bubbles && index < path.length && !event.propagationStopped;
      index += 1
    ) {
      path[index].invoke(event, false);
    }
    event.currentTarget = null;
    return !event.defaultPrevented;
  }

  /**
   * The event path from this target up to the root.
   * @returns This target followed by its ancestors.
   */
  private propagationPath(): FakeEventTarget[] {
    const path: FakeEventTarget[] = [this];
    for (let parent = this.eventParent(); undefined !== parent; parent = parent.eventParent()) {
      path.push(parent);
    }
    return path;
  }

  /**
   * Run this node's listeners of one phase (a listener removed meanwhile is skipped).
   * @param event The event.
   * @param capture Whether the capture listeners run.
   */
  private invoke(event: FakeEvent, capture: boolean): void {
    event.currentTarget = this;
    const snapshot = this.registered.filter(
      (record) => event.type === record.type && capture === record.capture,
    );
    for (const record of snapshot) {
      if (this.registered.includes(record)) {
        record.listener.call(this, event);
      }
    }
  }
}
