import type { IRandomSource } from '../core/ports/IRandomSource';

/**
 * {@link IRandomSource} backed by the Web Crypto API (`crypto.getRandomValues`).
 *
 * `globalThis.crypto` is available in both the VS Code Node extension host
 * (Node 18+) and the Web Extension Host, so this adapter pulls in no Node
 * built-in and ships unchanged to the browser bundle. It is deliberately NOT a
 * `Vscode*` wrapper: it touches no `vscode` API and is therefore covered by the
 * in-process unit suite.
 */
export class WebCryptoRandomSource implements IRandomSource {
  /**
   * Return a uniformly distributed integer in `[0, max)`.
   * @param max Exclusive upper bound; must be positive.
   * @returns A cryptographically strong random integer in range.
   */
  // eslint-disable-next-line class-methods-use-this
  public nextInt(max: number): number {
    const buffer = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buffer);
    return buffer[0] % max;
  }
}
