import type { IScheduler, ScheduleHandle } from '../../core/ports/IScheduler';
import type { DashboardInboundMessage } from '../../core/model/IDashboardMessage';
import type { IHoverPanelView } from './IHoverPanelView';

/** Debounce delay, in milliseconds, before a hovered preview icon requests its intro. */
export const HOVER_REQUEST_DELAY_MS = 150;

/** Posts an inbound message back to the host. */
export type PostMessage = (message: DashboardInboundMessage) => void;

/**
 * Drives the entry-document introduction hover preview on the webview side.
 *
 * It owns the three pieces of state the hover feature needs — which folder paths
 * have already asked the host for an introduction, which replies have arrived
 * (including the "no derivable introduction" case), and which preview icon is
 * currently hovered, focused or pinned — and keeps them all `vscode`/DOM-free by depending on an injected
 * {@link IScheduler}, a {@link PostMessage} and an {@link IHoverPanelView}.
 *
 * Request laziness is preserved: a card's introduction is requested at most once
 * (debounced), and a `null` cache entry records a genuine absence so an
 * intro-less spec is not re-requested on every later hover. The one escape hatch
 * is {@link reset}, called on a full repository re-render, which clears both the
 * request gate and the cache so a spec whose `requirements.md` appeared after the
 * first hover — or whose first reply was lost — can be retried.
 *
 * State machine (one preview at a time):
 * - Idle: nothing active.
 * - Hovering: {@link enter} on an icon; the popin is shown (non-interactive)
 *   once the introduction is known. {@link leave} returns to Idle.
 * - Pinned: {@link togglePin} on the active or another icon; {@link leave} is
 *   ignored. {@link close} (close button, Escape, outside click, scroll) or a
 *   second {@link togglePin} on the same icon returns to Idle.
 * Entering another icon while Pinned replaces the pinned preview.
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

  /** Folder path of the icon currently hovered, focused or pinned, driving the panel. */
  private activeFolderPath: string | undefined;
  /** Whether the active preview is pinned (survives the pointer leaving the icon). */
  private pinned = false;
  /** Whether a close is in progress, so a focus returned to the icon does not reopen. */
  private closing = false;

  /**
   * Build a controller over its injected collaborators.
   * @param scheduler The delayed-scheduling source backing the hover debounce.
   * @param postMessage Sends an inbound message to the host.
   * @param panel The hover preview panel view.
   * @param delayMs The debounce window in milliseconds (defaults to {@link HOVER_REQUEST_DELAY_MS}).
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
   * Handle a pointer/focus entering a preview icon: mark it active, show any
   * cached introduction, and debounce a one-shot request to the host. Ignored
   * while a close is returning focus to the icon, and when that icon is already
   * pinned. Entering another icon replaces a pinned preview.
   * @param folderPath Absolute path of the spec folder whose icon is entered.
   */
  public enter(folderPath: string): void {
    if (this.closing || (this.pinned && folderPath === this.activeFolderPath)) {
      return;
    }
    this.pinned = false;
    this.activeFolderPath = folderPath;
    this.hidePanel();
    this.showCached(folderPath);
    this.cancelPending();
    this.pendingRequest = this.scheduler.schedule(() => {
      this.pendingRequest = undefined;
      this.request(folderPath);
    }, this.delayMs);
  }
  /**
   * Handle a pointer/focus leaving a preview icon: cancel a still-pending
   * request and hide the panel, unless the preview is pinned.
   */
  public leave(): void {
    if (this.pinned) {
      return;
    }
    this.close();
  }
  /**
   * Handle a click (or Enter/Space) on a preview icon: pin its preview, or
   * unpin and close it when it is already pinned. Pinning requests the
   * introduction immediately instead of waiting for the hover delay.
   * @param folderPath Absolute path of the spec folder whose icon was activated.
   */
  public togglePin(folderPath: string): void {
    if (this.pinned && folderPath === this.activeFolderPath) {
      this.close();
      return;
    }
    this.cancelPending();
    this.activeFolderPath = folderPath;
    this.pinned = true;
    this.hidePanel();
    this.request(folderPath);
    this.showCached(folderPath);
  }
  /**
   * Unconditionally close the preview, pinned or not: cancel a pending request,
   * clear the active target and hide the panel. Idempotent and cheap, so it can
   * serve the close button, Escape, outside clicks and scroll.
   */
  public close(): void {
    this.cancelPending();
    this.activeFolderPath = undefined;
    this.pinned = false;
    this.hidePanel();
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
    this.panel.showText(folderPath, introduction, this.pinned);
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
    this.close();
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
      this.close();
    }
  }
  /**
   * Request a card's introduction from the host, at most once per card. The host
   * memoises the result, so a client-side gate is enough to avoid re-posting the
   * same request until the next {@link reset}.
   * @param folderPath Absolute path of the spec folder.
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
    this.panel.showText(folderPath, cached, this.pinned);
  }
  /**
   * Hide the panel while ignoring the focus event its hiding may trigger when it
   * returns focus to the icon, which would otherwise reopen the preview.
   */
  private hidePanel(): void {
    this.closing = true;
    try {
      this.panel.hide();
    } finally {
      this.closing = false;
    }
  }
  /** Cancel a still-pending debounced request, if any. */
  private cancelPending(): void {
    this.pendingRequest?.();
    this.pendingRequest = undefined;
  }
}
