import type { IScheduler, ScheduleHandle } from '../core/ports/IScheduler';

/**
 * {@link IScheduler} backed by the host `setTimeout`/`clearTimeout`.
 *
 * `globalThis.setTimeout` is available in both the Node extension host and the
 * Web Extension Host, so this adapter pulls in no Node built-in and ships to the
 * browser bundle. It touches no `vscode` API and is covered by the unit suite.
 */
export class TimeoutScheduler implements IScheduler {
  /**
   * Schedule a callback after a delay.
   * @param callback The callback to run.
   * @param delayMs The delay in milliseconds.
   * @returns A handle cancelling the scheduled callback.
   */
  // eslint-disable-next-line class-methods-use-this
  public schedule(callback: () => void, delayMs: number): ScheduleHandle {
    const handle = globalThis.setTimeout(callback, delayMs);
    return () => globalThis.clearTimeout(handle);
  }
}
