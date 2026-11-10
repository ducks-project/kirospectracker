import { expect } from 'chai';

import type { DashboardInboundMessage } from '../../src/core/model/IDashboardMessage';
import type { IScheduler, ScheduleHandle } from '../../src/core/ports/IScheduler';
import type { IHoverPanelView } from '../../src/webview/IHoverPanelView';
import {
  HOVER_REQUEST_DELAY_MS,
  HoverIntroductionController,
} from '../../src/webview/HoverIntroductionController';

/**
 * Manual scheduler recording pending callbacks so a test can flush them,
 * modelling the debounce window deterministically without real timers.
 */
class ManualScheduler implements IScheduler {
  private readonly tasks: Map<number, () => void> = new Map();

  private nextId = 0;

  public readonly delays: number[] = [];
  public schedule(callback: () => void, delayMs: number): ScheduleHandle {
    expect(delayMs).to.be.a('number');
    this.delays.push(delayMs);
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

/** Panel double capturing the last shown text and the visibility state. */
class FakePanelView implements IHoverPanelView {
  public shownText: string | undefined;

  public shownFor: string | undefined;

  public visible = false;

  public shownPinned = false;

  public hideCount = 0;

  /** Simulates focus returning to the icon while hiding. */
  public onHide: (() => void) | undefined;

  public showText(anchorFolderPath: string, introduction: string, pinned: boolean): void {
    this.shownFor = anchorFolderPath;
    this.shownText = introduction;
    this.shownPinned = pinned;
    this.visible = true;
  }

  public hide(): void {
    this.visible = false;
    this.hideCount += 1;
    this.onHide?.();
  }
}

/**
 * Behaviour specification for {@link HoverIntroductionController}.
 *
 * It exercises the webview hover client in isolation with injected doubles for
 * the scheduler, the host `postMessage` and the preview panel, so the debounce,
 * the once-only request gate, the panel fill/hide and the Finding 1 reset on a
 * repository re-render are all covered without a real DOM.
 */
describe('HoverIntroductionController', () => {
  const folderPath = '/ws/.kiro/specs/alpha';

  /** Build a controller together with its three doubles. */
  function build(): {
    controller: HoverIntroductionController;
    scheduler: ManualScheduler;
    panel: FakePanelView;
    posted: DashboardInboundMessage[];
  } {
    const scheduler = new ManualScheduler();
    const panel = new FakePanelView();
    const posted: DashboardInboundMessage[] = [];
    const controller = new HoverIntroductionController(
      scheduler,
      (message) => posted.push(message),
      panel,
    );
    return { controller, scheduler, panel, posted };
  }

  it('requests an introduction once the debounce window elapses on hover', () => {
    const { controller, scheduler, posted } = build();
    controller.enter(folderPath);
    expect(posted).to.have.length(0);
    expect(scheduler.pendingCount).to.equal(1);
    scheduler.flush();
    expect(posted).to.deep.equal([{ type: 'requestIntroduction', folderPath }]);
  });

  it('does not request when the pointer leaves before the debounce elapses', () => {
    const { controller, scheduler, posted } = build();
    controller.enter(folderPath);
    controller.leave();
    scheduler.flush();
    expect(posted).to.have.length(0);
  });

  it('requests a given card at most once across repeated hovers', () => {
    const { controller, scheduler, posted } = build();
    controller.enter(folderPath);
    scheduler.flush();
    controller.leave();
    controller.enter(folderPath);
    scheduler.flush();
    expect(posted).to.have.length(1);
  });

  it('fills the panel when an introduction reply arrives for the hovered card', () => {
    const { controller, scheduler, panel } = build();
    controller.enter(folderPath);
    scheduler.flush();
    controller.receive(folderPath, 'The alpha intro.');
    expect(panel.visible).to.equal(true);
    expect(panel.shownText).to.equal('The alpha intro.');
    expect(panel.shownFor).to.equal(folderPath);
  });

  it('leaves the panel hidden when the reply carries no introduction', () => {
    const { controller, scheduler, panel } = build();
    controller.enter(folderPath);
    scheduler.flush();
    controller.receive(folderPath, undefined);
    expect(panel.visible).to.equal(false);
  });

  it('does not re-request a spec whose reply was a genuine absence on a later hover', () => {
    const { controller, scheduler, posted } = build();
    controller.enter(folderPath);
    scheduler.flush();
    controller.receive(folderPath, undefined);
    controller.leave();
    controller.enter(folderPath);
    scheduler.flush();
    expect(posted).to.have.length(1);
  });

  it('re-requests the spec after a repository re-render clears the gate', () => {
    const { controller, scheduler, posted } = build();
    controller.enter(folderPath);
    scheduler.flush();
    controller.receive(folderPath, undefined);
    controller.leave();
    // A full re-render re-discovered the specs: the gate and cache reset.
    controller.reset();
    controller.enter(folderPath);
    scheduler.flush();
    expect(posted).to.deep.equal([
      { type: 'requestIntroduction', folderPath },
      { type: 'requestIntroduction', folderPath },
    ]);
  });

  it('hides the panel and drops the active target on reset', () => {
    const { controller, scheduler, panel } = build();
    controller.enter(folderPath);
    scheduler.flush();
    controller.receive(folderPath, 'The alpha intro.');
    expect(panel.visible).to.equal(true);
    controller.reset();
    expect(panel.visible).to.equal(false);
  });

  it('shows the cached introduction immediately on a re-hover without re-posting', () => {
    const { controller, scheduler, panel, posted } = build();
    controller.enter(folderPath);
    scheduler.flush();
    controller.receive(folderPath, 'The alpha intro.');
    controller.leave();
    expect(panel.visible).to.equal(false);
    controller.enter(folderPath);
    expect(panel.visible).to.equal(true);
    expect(panel.shownText).to.equal('The alpha intro.');
    scheduler.flush();
    expect(posted).to.have.length(1);
  });

  it('ignores a reply for a card that is no longer the hovered one', () => {
    const { controller, scheduler, panel } = build();
    const other = '/ws/.kiro/specs/beta';
    controller.enter(folderPath);
    scheduler.flush();
    controller.leave();
    controller.enter(other);
    controller.receive(folderPath, 'The alpha intro.');
    expect(panel.shownFor).to.not.equal(folderPath);
  });
  it('invalidate drops the request gate and cache of one card only', () => {
    const { controller, scheduler, posted } = build();
    const other = '/ws/.kiro/specs/beta';
    controller.enter(folderPath);
    scheduler.flush();
    controller.receive(folderPath, 'Intro');
    controller.leave();
    controller.enter(other);
    scheduler.flush();
    controller.receive(other, 'Other');
    controller.leave();
    controller.invalidate(folderPath);
    controller.enter(folderPath);
    scheduler.flush();
    controller.enter(other);
    scheduler.flush();
    expect(posted.filter((m) => 'requestIntroduction' === m.type)).to.have.length(3);
  });
  it('invalidate hides the panel when the card is the active one', () => {
    const { controller, scheduler, panel } = build();
    controller.enter(folderPath);
    scheduler.flush();
    controller.receive(folderPath, 'Intro');
    expect(panel.visible).to.equal(true);
    controller.invalidate(folderPath);
    expect(panel.visible).to.equal(false);
  });
  it('debounces with the exported HOVER_REQUEST_DELAY_MS', () => {
    const { controller, scheduler } = build();
    controller.enter(folderPath);
    expect(scheduler.delays).to.deep.equal([HOVER_REQUEST_DELAY_MS]);
  });
  it('a scroll-style leave hides the panel, cancels the pending request and clears the target', () => {
    const { controller, scheduler, panel, posted } = build();
    controller.enter(folderPath);
    controller.close();
    expect(scheduler.pendingCount).to.equal(0);
    scheduler.flush();
    expect(posted).to.have.length(0);
    controller.receive(folderPath, 'Late');
    expect(panel.visible).to.equal(false);
  });
  it('is idempotent when close fires repeatedly on scroll', () => {
    const { controller, panel } = build();
    controller.close();
    controller.close();
    expect(panel.visible).to.equal(false);
  });
  it('reopens from the cache on a hover following a scroll dismissal', () => {
    const { controller, scheduler, panel, posted } = build();
    controller.enter(folderPath);
    scheduler.flush();
    controller.receive(folderPath, 'Intro');
    controller.leave();
    expect(panel.visible).to.equal(false);
    controller.enter(folderPath);
    expect(panel.visible).to.equal(true);
    expect(panel.shownText).to.equal('Intro');
    scheduler.flush();
    expect(posted).to.have.length(1);
  });
  it('re-requests after a scroll dismissal when the request never fired', () => {
    const { controller, scheduler, posted } = build();
    controller.enter(folderPath);
    controller.leave();
    controller.enter(folderPath);
    scheduler.flush();
    expect(posted).to.have.length(1);
  });
  describe('pinning', () => {
    const other = '/ws/.kiro/specs/beta';
    /** Hover a card, flush the request and deliver its reply. */
    function openHover(
      h: ReturnType<typeof build>,
      path: string = folderPath,
      text = 'Intro',
    ): void {
      h.controller.enter(path);
      h.scheduler.flush();
      h.controller.receive(path, text);
    }
    it('shows an unpinned preview on hover', () => {
      const h = build();
      openHover(h);
      expect(h.panel.visible).to.equal(true);
      expect(h.panel.shownPinned).to.equal(false);
    });
    it('pins the visible preview on click', () => {
      const h = build();
      openHover(h);
      h.controller.togglePin(folderPath);
      expect(h.panel.visible).to.equal(true);
      expect(h.panel.shownPinned).to.equal(true);
    });
    it('stays open when the pointer leaves a pinned icon', () => {
      const h = build();
      openHover(h);
      h.controller.togglePin(folderPath);
      h.controller.leave();
      expect(h.panel.visible).to.equal(true);
    });
    it('keeps a pinned preview on re-entering its own icon', () => {
      const h = build();
      openHover(h);
      h.controller.togglePin(folderPath);
      const hides = h.panel.hideCount;
      h.controller.enter(folderPath);
      expect(h.panel.visible).to.equal(true);
      expect(h.panel.shownPinned).to.equal(true);
      expect(h.panel.hideCount).to.equal(hides);
    });
    it('requests immediately when pinned before any reply, then shows pinned', () => {
      const h = build();
      h.controller.enter(folderPath);
      h.controller.togglePin(folderPath);
      expect(h.posted).to.deep.equal([{ type: 'requestIntroduction', folderPath }]);
      expect(h.scheduler.pendingCount).to.equal(0);
      h.controller.receive(folderPath, 'Late');
      expect(h.panel.shownPinned).to.equal(true);
      expect(h.panel.shownText).to.equal('Late');
    });
    it('does not re-request a spec already requested when pinning', () => {
      const h = build();
      openHover(h);
      h.controller.togglePin(folderPath);
      expect(h.posted).to.have.length(1);
    });
    it('closes on a second click on the same icon', () => {
      const h = build();
      openHover(h);
      h.controller.togglePin(folderPath);
      h.controller.togglePin(folderPath);
      expect(h.panel.visible).to.equal(false);
      h.controller.leave();
      expect(h.panel.visible).to.equal(false);
    });
    it('closes a pinned preview unconditionally (close button, Escape, outside click, scroll)', () => {
      const h = build();
      openHover(h);
      h.controller.togglePin(folderPath);
      h.controller.close();
      expect(h.panel.visible).to.equal(false);
      h.controller.receive(folderPath, 'Again');
      expect(h.panel.visible).to.equal(false);
    });
    it('replaces a pinned preview when another icon is hovered', () => {
      const h = build();
      openHover(h);
      h.controller.togglePin(folderPath);
      h.controller.enter(other);
      expect(h.panel.visible).to.equal(false);
      h.controller.receive(other, 'Other');
      expect(h.panel.shownFor).to.equal(other);
      expect(h.panel.shownPinned).to.equal(false);
    });
    it('replaces a pinned preview when another icon is pinned', () => {
      const h = build();
      openHover(h);
      h.controller.togglePin(folderPath);
      h.controller.togglePin(other);
      expect(h.panel.visible).to.equal(false);
      h.controller.receive(other, 'Other');
      expect(h.panel.shownFor).to.equal(other);
      expect(h.panel.shownPinned).to.equal(true);
    });
    it('does not show a reply for a replaced pinned icon', () => {
      const h = build();
      h.controller.togglePin(folderPath);
      h.controller.togglePin(other);
      h.controller.receive(folderPath, 'Stale');
      expect(h.panel.visible).to.equal(false);
    });
    it('closes a pinned preview on reset and invalidate of its card', () => {
      const h = build();
      openHover(h);
      h.controller.togglePin(folderPath);
      h.controller.invalidate(folderPath);
      expect(h.panel.visible).to.equal(false);
      openHover(h);
      h.controller.togglePin(folderPath);
      h.controller.reset();
      expect(h.panel.visible).to.equal(false);
      h.controller.leave();
      expect(h.panel.visible).to.equal(false);
    });
    it('keeps a pinned preview when another card is invalidated', () => {
      const h = build();
      openHover(h);
      h.controller.togglePin(folderPath);
      h.controller.invalidate(other);
      expect(h.panel.visible).to.equal(true);
    });
    it('ignores the focus event fired while a close hands the focus back to the icon', () => {
      const h = build();
      openHover(h);
      h.controller.togglePin(folderPath);
      h.panel.onHide = (): void => h.controller.enter(folderPath);
      h.controller.close();
      h.panel.onHide = undefined;
      h.scheduler.flush();
      expect(h.panel.visible).to.equal(false);
      expect(h.scheduler.pendingCount).to.equal(0);
    });
    it('accepts a normal hover again after a close', () => {
      const h = build();
      openHover(h);
      h.controller.togglePin(folderPath);
      h.controller.close();
      h.controller.enter(folderPath);
      expect(h.panel.visible).to.equal(true);
      expect(h.panel.shownPinned).to.equal(false);
    });
  });
});
