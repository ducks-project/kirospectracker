/**
 * Two separate progress ratios for a spec, required and optional, never merged
 * into a single number.
 *
 * The required ratio drives the primary progress bar; the optional ratio is a
 * secondary measure shown apart. When there is no required task (`requiredTotal
 * === 0`), the required ratio is treated as 1 (100 %): there is nothing left to
 * do on the required side.
 *
 * Progress is RESOLVED-based: a task counts as progressed when it is done OR
 * cancelled, and a cancelled task counts in BOTH the numerator and the
 * denominator. `requiredDone`/`optionalDone` therefore mean the RESOLVED count.
 * The per-state breakdown fields let the UI show done, cancelled, in-progress
 * and todo distinctly without re-deriving them.
 */
export interface ISpecProgress {
  /** Number of RESOLVED (done OR cancelled) required (non-optional) leaf tasks. */
  readonly requiredDone: number;

  /** Total number of required (non-optional) leaf tasks. */
  readonly requiredTotal: number;

  /** Number of RESOLVED (done OR cancelled) optional leaf tasks. */
  readonly optionalDone: number;

  /** Total number of optional leaf tasks. */
  readonly optionalTotal: number;

  /** `requiredDone / requiredTotal`, or 1 when `requiredTotal === 0`. */
  readonly requiredRatio: number;

  /** `optionalDone / optionalTotal`, or 0 when `optionalTotal === 0`. */
  readonly optionalRatio: number;

  /** Number of `done`-state required leaf tasks (excludes cancelled). */
  readonly requiredResolvedDone: number;

  /** Number of `cancelled`-state required leaf tasks. */
  readonly requiredResolvedCancelled: number;

  /** Number of `inProgress`-state required leaf tasks. */
  readonly requiredInProgress: number;

  /** Number of `todo`-state required leaf tasks. */
  readonly requiredTodo: number;

  /** Number of `done`-state optional leaf tasks (excludes cancelled). */
  readonly optionalResolvedDone: number;

  /** Number of `cancelled`-state optional leaf tasks. */
  readonly optionalResolvedCancelled: number;

  /** Number of `inProgress`-state optional leaf tasks. */
  readonly optionalInProgress: number;

  /** Number of `todo`-state optional leaf tasks. */
  readonly optionalTodo: number;
}
