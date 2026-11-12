/** One pending timer. */
interface ITimer {
  readonly id: number;
  readonly due: number;
  readonly callback: () => void;
}

/**
 * Deterministic `setTimeout`/`clearTimeout` for the webview context. Nothing runs
 * until the test calls {@link ManualClock.advance}. Only the forms the dashboard
 * uses are accepted (a function and a delay); anything else throws.
 */
export class ManualClock {
  private elapsed = 0;
  private nextId = 1;
  private timers: ITimer[] = [];

  /**
   * Schedule a callback (global `setTimeout` replacement).
   * @param callback The function to run.
   * @param delay Delay in milliseconds.
   * @param extra Extra arguments, which are not modelled and therefore rejected.
   * @returns The timer id.
   */
  public readonly setTimeout = (callback: unknown, delay: unknown, ...extra: unknown[]): number => {
    if ('function' !== typeof callback || 'number' !== typeof delay || 0 > delay) {
      throw new Error('Unsupported DOM API: setTimeout expects (function, non-negative number)');
    }
    if (0 < extra.length) {
      throw new Error('Unsupported DOM API: setTimeout with extra arguments');
    }
    const id = this.nextId;
    this.nextId += 1;
    this.timers.push({ id, due: this.elapsed + delay, callback: callback as () => void });
    return id;
  };

  /**
   * Cancel a timer (global `clearTimeout` replacement).
   * @param id The timer id.
   */
  public readonly clearTimeout = (id: unknown): void => {
    if ('number' !== typeof id) {
      throw new Error('Unsupported DOM API: clearTimeout expects a timer id');
    }
    this.timers = this.timers.filter((timer) => id !== timer.id);
  };

  /**
   * Move time forward, running every timer that falls due, in due order and then
   * scheduling order (timers scheduled by a callback are honoured).
   * @param milliseconds How far to advance.
   */
  public advance(milliseconds: number): void {
    const target = this.elapsed + milliseconds;
    for (let next = this.nextDue(target); undefined !== next; next = this.nextDue(target)) {
      this.timers = this.timers.filter((timer) => timer !== next);
      this.elapsed = next.due;
      next.callback();
    }
    this.elapsed = target;
  }

  /**
   * Delays remaining before each pending timer fires, in due order.
   * @returns Remaining delays in milliseconds.
   */
  public pendingDelays(): readonly number[] {
    return this.timers.map((timer) => timer.due - this.elapsed).sort((left, right) => left - right);
  }

  private nextDue(limit: number): ITimer | undefined {
    return this.timers
      .filter((timer) => limit >= timer.due)
      .sort((left, right) => left.due - right.due || left.id - right.id)[0];
  }
}
