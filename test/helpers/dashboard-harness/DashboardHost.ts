import vm from 'vm';
import { createFakeDocument } from '../fake-dom/FakeDocument';
import type { FakeDocument } from '../fake-dom/FakeDocument';
import { FakeElement, FakeHtmlElement } from '../fake-dom/FakeElement';
import { createFakeEvent } from '../fake-dom/FakeEvent';
import { createFakeWindow } from '../fake-dom/FakeWindow';
import type { FakeWindow } from '../fake-dom/FakeWindow';
import { ManualClock } from './ManualClock';
import { stableStringify } from './stable-stringify';

/** Origin of the fixed `vscode-webview://` document the bundle runs in. */
export const WEBVIEW_ORIGIN = 'vscode-webview://0f3c2a1d-spec-tracker-dashboard';

/** Options of one bundle run. */
export interface IDashboardHostOptions {
  /** The built dashboard bundle source. */
  readonly bundle: string;
  /** `window.location.origin` of the webview document (defaults to {@link WEBVIEW_ORIGIN}). */
  readonly locationOrigin?: string;
  /** State returned by `getState()` at boot, as VS Code restores it on a view reload. */
  readonly persistedState?: unknown;
}

/**
 * The environment the dashboard bundle runs in: a fake `window` and `document`, a
 * recording `acquireVsCodeApi`, and a manual clock, all handed to the bundle
 * through a `node:vm` context. Booting executes the bundle, so the handshake
 * `ready` message is already recorded when the constructor returns.
 */
export class DashboardHost {
  public readonly window: FakeWindow;
  public readonly document: FakeDocument;
  public readonly clock = new ManualClock();
  /**
   * Ordered log of observable effects: `post <json>` (message to the extension
   * host), `setState <json>`, `focus <el>`, `blur <el>` and `dom` (a run of
   * mutations of the connected tree). One list so the ORDER between a persisted
   * state, a posted message and a redraw is part of the reference.
   */
  public readonly effects: string[] = [];
  private apiAcquired = false;
  private currentState: unknown;

  /**
   * Boot the bundle.
   * @param options The bundle and the boot-time environment.
   */
  public constructor(options: IDashboardHostOptions) {
    this.window = createFakeWindow(options.locationOrigin ?? WEBVIEW_ORIGIN);
    this.document = createFakeDocument(this.window, this.effects);
    this.currentState = options.persistedState;
    const context = vm.createContext({
      window: this.window,
      document: this.document,
      acquireVsCodeApi: () => this.acquireVsCodeApi(),
      setTimeout: this.clock.setTimeout,
      clearTimeout: this.clock.clearTimeout,
      Element: FakeElement,
      HTMLElement: FakeHtmlElement,
    });
    vm.runInContext(options.bundle, context, { filename: 'dashboard.js' });
  }

  /**
   * Deliver a `message` event to the window, as the webview host does with
   * `postMessage` (the payload is structured-cloned, like the real channel).
   * @param data The message payload.
   * @param origin The `event.origin` of the delivery.
   */
  public deliver(data: unknown, origin: string): void {
    this.window.dispatchEvent(createFakeEvent('message', { origin, data: structuredClone(data) }));
  }

  private acquireVsCodeApi(): object {
    if (this.apiAcquired) {
      throw new Error('An instance of the VS Code API has already been acquired');
    }
    this.apiAcquired = true;
    return {
      postMessage: (message: unknown): void => {
        this.effects.push(`post ${stableStringify(message)}`);
      },
      getState: (): unknown =>
        undefined === this.currentState ? undefined : structuredClone(this.currentState),
      setState: (state: unknown): void => {
        this.currentState = structuredClone(state);
        this.effects.push(`setState ${stableStringify(state)}`);
      },
    };
  }
}
