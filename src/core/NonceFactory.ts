import type { IRandomSource } from './ports/IRandomSource';

/** Alphabet of the generated nonce: URL- and CSP-safe characters. */
const NONCE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Default nonce length, long enough to resist guessing. */
const DEFAULT_NONCE_LENGTH = 32;

/**
 * Pure factory producing per-render Content-Security-Policy nonces.
 *
 * The randomness comes from an injected {@link IRandomSource}, so the factory
 * carries no `vscode` import and is unit-testable with a deterministic source.
 * Each `create()` call yields an independent nonce for a single webview render.
 */
export class NonceFactory {
  private readonly random: IRandomSource;

  private readonly length: number;

  /**
   * Build a nonce factory over a random source.
   * @param random The injected randomness source.
   * @param length Nonce length in characters (defaults to 32).
   */
  public constructor(random: IRandomSource, length: number = DEFAULT_NONCE_LENGTH) {
    this.random = random;
    this.length = length;
  }

  /**
   * Produce a fresh nonce.
   * @returns A random string over the CSP-safe alphabet.
   */
  public create(): string {
    let nonce = '';
    for (let index = 0; index < this.length; index += 1) {
      nonce += NONCE_ALPHABET[this.random.nextInt(NONCE_ALPHABET.length)];
    }
    return nonce;
  }
}
