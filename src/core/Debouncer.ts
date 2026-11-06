import type { IScheduler, ScheduleHandle } from './ports/IScheduler';

/** Default debounce delay in milliseconds for burst file events. */
const DEFAULT_DELAY_MS = 150;

/**
 * Pure, keyed debouncer coalescing bursts of events per key.
 *
 * It delays the per-key callback until `delayMs` has elapsed with no newer event
 * for the same key, so a flurry of writes to one spec triggers a single
 * re-parse. Keying by the changed path keeps re-parsing scoped to the affected
 * spec rather than the whole workspace. It is `vscode`-free (scheduling is
 * injected) and gate-covered.
 */
export class Debouncer {
  private readonly scheduler: IScheduler;

  private readonly delayMs: number;

  private readonly pending: Map<string, ScheduleHandle> = new Map();

  /**
   * Build a debouncer over an injected scheduler.
   * @param scheduler The delayed-scheduling source.
   * @param delayMs The coalescing window in milliseconds (defaults to 150).
   */
  public constructor(scheduler: IScheduler, delayMs: number = DEFAULT_DELAY_MS) {
    this.scheduler = scheduler;
    this.delayMs = delayMs;
  }

  /**
   * Debounce a callback for a key, cancelling any still-pending call for it.
   * @param key The coalescing key (e.g. the changed file path).
   * @param callback The callback to run once the window elapses.
   */
  public schedule(key: string, callback: () => void): void {
    this.pending.get(key)?.();
    const cancel = this.scheduler.schedule(() => {
      this.pending.delete(key);
      callback();
    }, this.delayMs);
    this.pending.set(key, cancel);
  }

  /**
   * Cancel every pending callback.
   */
  public cancelAll(): void {
    this.pending.forEach((cancel) => cancel());
    this.pending.clear();
  }
}
