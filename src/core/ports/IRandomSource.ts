/**
 * Port (Dependency Inversion) supplying randomness to the {@link NonceFactory}.
 *
 * The adapter wires a cryptographically strong source; tests inject a
 * deterministic one, keeping nonce generation `vscode`-free and verifiable.
 */
export interface IRandomSource {
  /**
   * Return an integer in `[0, max)`.
   * @param max Exclusive upper bound; must be positive.
   * @returns A pseudo/true-random integer in range.
   */
  nextInt(max: number): number;
}
