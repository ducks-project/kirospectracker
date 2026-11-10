import type { IScheduler, ScheduleHandle } from '../core/ports/IScheduler';
import type { DashboardInboundMessage } from '../core/model/IDashboardMessage';
import type { IHoverPanelView } from './IHoverPanelView';

/** Debounce delay, in milliseconds, before a hovered card requests its intro. */
const HOVER_REQUEST_DELAY_MS = 150;

/** Posts an inbound message back to the host. */
export type PostMessage = (message: DashboardInboundMessage) => void;

/**
 * Drives the entry-document introduction hover preview on the webview side.
 *
 * It owns the three pieces of state the hover feature needs — which folder paths
 * have already asked the host for an introduction, which replies have arrived
 * (including the "no derivable introduction" case), and which card is currently
 * hovered — and keeps them all `vscode`/DOM-free by depending on an injected
 * {@link IScheduler}, a {@link PostMessage} and an {@link IHoverPanelView}.
 *
 * Request laziness is preserved: a card's introduction is requested at most once
 * (debounced), and a `null` cache entry records a genuine absence so an
 * intro-less spec is not re-requested on every later hover. The one escape hatch
 * is {@link reset}, called on a full repository re-render, which clears both the
 * request gate and the cache so a spec whose `requirements.md` appeared after the
 * first hover — or whose first reply was lost — can be retried.
 */
export class HoverIntroductionController {
  private readonly scheduler: IScheduler;

  private readonly postMessage: PostMessage;

  private readonly panel: IHoverPanelView;

  private readonly delayMs: number;

  /** Folder paths whose introduction has already been requested from the host. */
  private readonly requested: Set<string> = new Set();

  /**
   * Introductions received from the host, keyed by spec folder path.
   *
   * A `null` value records that the host answered with no derivable
   * introduction, so the panel stays hidden without re-requesting.
   */
  private readonly introductions: Map<string, string | null> = new Map();

  /** Pending hover-request cancel handle, cleared when the pointer leaves early. */
  private pendingRequest: ScheduleHandle | undefined;

  /** Folder path of the card currently hovered, driving the panel's content. */
  private activeFolderPath: string | undefined;

  /**
   * Build a controller over its injected collaborators.
   * @param scheduler The delayed-scheduling source backing the hover debounce.
   * @param postMessage Sends an inbound message to the host.
   * @param panel The hover preview panel view.
   * @param delayMs The debounce window in milliseconds (defaults to 150).
   */
  public constructor(
    scheduler: IScheduler,
    postMessage: PostMessage,
    panel: IHoverPanelView,
    delayMs: number = HOVER_REQUEST_DELAY_MS,
  ) {
    this.scheduler = scheduler;
    this.postMessage = postMessage;
    this.panel = panel;
    this.delayMs = delayMs;
  }

  /**
   * Handle a pointer/focus entering a card: mark it active, show any cached
   * introduction, and debounce a one-shot request to the host.
   * @param folderPath Absolute path of the hovered spec folder.
   */
  public enter(folderPath: string): void {
    this.activeFolderPath = folderPath;
    this.showCached(folderPath);
    this.pendingRequest?.();
    this.pendingRequest = this.scheduler.schedule(() => {
      this.pendingRequest = undefined;
      this.request(folderPath);
    }, this.delayMs);
  }

  /**
   * Handle a pointer/focus leaving a card: cancel a still-pending request and
   * hide the panel.
   */
  public leave(): void {
    if (undefined !== this.pendingRequest) {
      this.pendingRequest();
      this.pendingRequest = undefined;
    }
    this.activeFolderPath = undefined;
    this.panel.hide();
  }

  /**
   * Handle a host `introduction` reply: cache it, then show it when its card is
   * still the one being hovered. An `undefined` introduction is cached as `null`
   * so the panel stays hidden and the card is never re-requested.
   * @param folderPath Folder path the reply correlates to.
   * @param introduction The derived introduction, or `undefined` when none.
   */
  public receive(folderPath: string, introduction: string | undefined): void {
    this.introductions.set(folderPath, introduction ?? null);
    if (folderPath !== this.activeFolderPath || undefined === introduction) {
      return;
    }
    this.panel.showText(folderPath, introduction);
  }

  /**
   * Reset all hover request state on a full repository re-render.
   *
   * A new `render` means the specs were re-discovered (a workspace change, a
   * `requirements.md` added), so both the one-shot request gate and the reply
   * cache are cleared: a later hover re-posts the request and the panel can fill
   * from the fresh reply. This is the recovery path for the two cases a plain
   * once-only flag could not distinguish from a genuine absence — a reply that
   * never arrived, and a `requirements.md` created after the first hover.
   */
  public reset(): void {
    this.leave();
    this.requested.clear();
    this.introductions.clear();
  }

  /**
   * Drop the request gate and cached reply of one card, e.g. when its entry
   * document may have changed. The panel is hidden if that card is hovered.
   * @param folderPath Absolute path of the changed spec folder.
   */
  public invalidate(folderPath: string): void {
    this.requested.delete(folderPath);
    this.introductions.delete(folderPath);
    if (folderPath === this.activeFolderPath) {
      this.leave();
    }
  }
  /**
   * Request a card's introduction from the host, at most once per card. The host
   * memoises the result, so a client-side gate is enough to avoid re-posting the
   * same request until the next {@link reset}.
   * @param folderPath Absolute path of the hovered spec folder.
   */
  private request(folderPath: string): void {
    if (this.requested.has(folderPath)) {
      return;
    }
    this.requested.add(folderPath);
    this.postMessage({ type: 'requestIntroduction', folderPath });
  }

  /**
   * Show the panel from the cache when the reply has already arrived. A missing
   * entry (not yet requested or still pending) and a `null` entry (genuine
   * absence) both leave the panel hidden.
   * @param folderPath Absolute path of the hovered spec folder.
   */
  private showCached(folderPath: string): void {
    const cached = this.introductions.get(folderPath);
    if (undefined === cached || null === cached) {
      return;
    }
    this.panel.showText(folderPath, cached);
  }
}
