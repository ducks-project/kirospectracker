import { expect } from 'chai';

import { Debouncer } from '../../src/core/Debouncer';
import type { IScheduler, ScheduleHandle } from '../../src/core/ports/IScheduler';

/**
 * Manual scheduler recording pending callbacks so a test can flush them.
 */
class ManualScheduler implements IScheduler {
  private readonly tasks: Map<number, () => void> = new Map();

  private nextId = 0;

  public schedule(callback: () => void, delayMs: number): ScheduleHandle {
    expect(delayMs).to.be.a('number');
    const id = this.nextId;
    this.nextId += 1;
    this.tasks.set(id, callback);
    return () => {
      this.tasks.delete(id);
    };
  }

  /** Run and clear every pending callback. */
  public flush(): void {
    const pending = Array.from(this.tasks.values());
    this.tasks.clear();
    pending.forEach((task) => task());
  }

  /** @returns The number of still-pending callbacks. */
  public get pendingCount(): number {
    return this.tasks.size;
  }
}

/**
 * Behaviour specification for {@link Debouncer}.
 */
describe('Debouncer', () => {
  it('coalesces a burst for one key into a single call', () => {
    const scheduler = new ManualScheduler();
    const debouncer = new Debouncer(scheduler, 100);
    let calls = 0;
    debouncer.schedule('a', () => {
      calls += 1;
    });
    debouncer.schedule('a', () => {
      calls += 1;
    });
    debouncer.schedule('a', () => {
      calls += 1;
    });
    expect(scheduler.pendingCount).to.equal(1);
    scheduler.flush();
    expect(calls).to.equal(1);
  });

  it('keeps separate keys independent', () => {
    const scheduler = new ManualScheduler();
    const debouncer = new Debouncer(scheduler, 100);
    const fired: string[] = [];
    debouncer.schedule('a', () => fired.push('a'));
    debouncer.schedule('b', () => fired.push('b'));
    expect(scheduler.pendingCount).to.equal(2);
    scheduler.flush();
    expect(fired.sort()).to.deep.equal(['a', 'b']);
  });

  it('cancels every pending callback on cancelAll', () => {
    const scheduler = new ManualScheduler();
    const debouncer = new Debouncer(scheduler, 100);
    let calls = 0;
    debouncer.schedule('a', () => {
      calls += 1;
    });
    debouncer.cancelAll();
    scheduler.flush();
    expect(calls).to.equal(0);
  });
});
