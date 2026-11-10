import type { IScheduler, ScheduleHandle } from '../../src/core/ports/IScheduler';

/** Scheduler recording callbacks so a test flushes them on demand. */
export class ManualScheduler implements IScheduler {
  /** Delays requested, in call order. */
  public readonly delays: number[] = [];
  private readonly tasks = new Map<number, () => void>();
  private nextId = 0;

  public schedule(callback: () => void, delayMs: number): ScheduleHandle {
    this.delays.push(delayMs);
    const id = this.nextId;
    this.nextId += 1;
    this.tasks.set(id, callback);
    return () => {
      this.tasks.delete(id);
    };
  }

  /** Number of callbacks still pending. */
  public get pending(): number {
    return this.tasks.size;
  }

  /** Run and clear every pending callback. */
  public flush(): void {
    const pending = Array.from(this.tasks.values());
    this.tasks.clear();
    pending.forEach((task) => task());
  }
}
