/** A cancel handle for a scheduled callback. */
export type ScheduleHandle = () => void;

/**
 * Port (Dependency Inversion) abstracting delayed scheduling for the
 * {@link Debouncer}.
 *
 * The adapter wires `setTimeout`/`clearTimeout`; tests inject a manual scheduler
 * to advance virtual time, keeping the debounce logic deterministic and
 * `vscode`-free.
 */
export interface IScheduler {
  /**
   * Schedule a callback after a delay.
   * @param callback The callback to run.
   * @param delayMs The delay in milliseconds.
   * @returns A handle cancelling the scheduled callback.
   */
  schedule(callback: () => void, delayMs: number): ScheduleHandle;
}
