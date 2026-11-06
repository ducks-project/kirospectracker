/**
 * Two separate progress ratios for a spec, required and optional, never merged
 * into a single number.
 *
 * The required ratio drives the primary progress bar; the optional ratio is a
 * secondary measure shown apart. When there is no required task (`requiredTotal
 * === 0`), the required ratio is treated as 1 (100 %): there is nothing left to
 * do on the required side.
 */
export interface ISpecProgress {
  /** Number of done required (non-optional) leaf tasks. */
  readonly requiredDone: number;

  /** Total number of required (non-optional) leaf tasks. */
  readonly requiredTotal: number;

  /** Number of done optional leaf tasks. */
  readonly optionalDone: number;

  /** Total number of optional leaf tasks. */
  readonly optionalTotal: number;

  /** `requiredDone / requiredTotal`, or 1 when `requiredTotal === 0`. */
  readonly requiredRatio: number;

  /** `optionalDone / optionalTotal`, or 0 when `optionalTotal === 0`. */
  readonly optionalRatio: number;
}
