import { FakeEventTarget } from './FakeEventTarget';
import { strictProxy } from './strict-proxy';

/** Viewport width reported by the fake window. */
export const VIEWPORT_WIDTH = 800;
/** Viewport height reported by the fake window. */
export const VIEWPORT_HEIGHT = 600;

/** `window.location`, limited to the origin. */
export interface IFakeLocation {
  readonly origin: string;
}

/** Root of the event path: the window the `message` listener and document events reach. */
export class FakeWindow extends FakeEventTarget {
  public readonly location: IFakeLocation;
  public readonly innerWidth = VIEWPORT_WIDTH;
  public readonly innerHeight = VIEWPORT_HEIGHT;

  /**
   * Build a window.
   * @param origin Value of `window.location.origin`.
   */
  public constructor(origin: string) {
    super();
    this.location = strictProxy({ origin }, 'Location');
  }
}

/**
 * Create a strict window.
 * @param origin Value of `window.location.origin`.
 * @returns The window.
 */
export function createFakeWindow(origin: string): FakeWindow {
  return strictProxy(new FakeWindow(origin), 'Window');
}
