import type { IHoverPanelView } from './IHoverPanelView';
import { computeHoverPlacement } from './computeHoverPlacement';
import type { IHoverRect } from './computeHoverPlacement';

/** Stable id of the popin, referenced by the icon's `aria-describedby` / `aria-controls`. */
export const HOVER_PANEL_ID = 'card-hover-panel';
/** Minimal preview-icon element the panel anchors to. */
export interface IHoverAnchor {
  getBoundingClientRect(): IHoverRect;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  focus(): void;
}
/** Minimal panel element the adapter drives (structural subset of `HTMLElement`). */
export interface IHoverPanelElement {
  hidden: boolean;
  readonly offsetWidth: number;
  readonly offsetHeight: number;
  readonly style: { left: string; top: string; setProperty(name: string, value: string): void };
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  replaceChildren(...nodes: never[] | unknown[]): void;
}
/** Minimal DOM environment injected so the adapter is testable without a browser. */
export interface IHoverDom {
  /** Resolve the mounted preview icon for a spec folder path, if currently rendered. */
  findAnchor(folderPath: string): IHoverAnchor | undefined;
  /** Create the (detached) floating panel element. */
  createPanel(): IHoverPanelElement;
  /** Append the panel to the document body. */
  mountPanel(panel: IHoverPanelElement): void;
  /** Build the inert text paragraph shown inside the panel. */
  createIntro(text: string): unknown;
  /** Build the close button shown while the panel is pinned. */
  createCloseButton(): unknown;
  /** Whether the keyboard focus currently sits inside the panel. */
  isFocusInside(panel: IHoverPanelElement): boolean;
  /** Current viewport size. */
  viewport(): { readonly width: number; readonly height: number };
}
/**
 * DOM-backed {@link IHoverPanelView} adapter driving the floating preview panel.
 *
 * All browser access goes through the injected {@link IHoverDom}, so the display
 * logic (lazy creation, anchor lookup, viewport clamping, pin mode, hide) is
 * unit-testable. Content is handed over as inert text nodes (never `innerHTML`)
 * to honour the webview CSP. When the anchor icon is not rendered the panel
 * stays hidden.
 *
 * Hover mode is a non-interactive `tooltip` described from the icon. Pinned mode
 * is an interactive, labelled `group` (it holds a close button) controlled by the
 * icon, which then reports `aria-expanded="true"` (disclosure pattern).
 */
export class DomHoverPanelView implements IHoverPanelView {
  private readonly dom: IHoverDom;
  private panel: IHoverPanelElement | undefined;
  private shownAnchor: IHoverAnchor | undefined;
  private shownPinned = false;
  /**
   * Build the adapter over its DOM environment.
   * @param dom The injected DOM environment.
   */
  public constructor(dom: IHoverDom) {
    this.dom = dom;
  }
  /** @inheritdoc */
  public showText(anchorFolderPath: string, introduction: string, pinned: boolean): void {
    const anchor = this.dom.findAnchor(anchorFolderPath);
    if (undefined === anchor) {
      return;
    }
    const panel = this.ensurePanel();
    const content: unknown[] = [this.dom.createIntro(introduction)];
    if (pinned) {
      content.push(this.dom.createCloseButton());
    }
    panel.replaceChildren(...content);
    this.applyMode(panel, anchor, pinned);
    panel.hidden = false;
    this.position(panel, anchor);
    this.describe(anchor, pinned);
  }
  /** @inheritdoc */
  public hide(): void {
    const restoreFocus = this.shouldRestoreFocus();
    const anchor = this.shownAnchor;
    this.clearAnchor();
    if (undefined !== this.panel) {
      this.panel.hidden = true;
    }
    this.shownPinned = false;
    if (restoreFocus) {
      anchor?.focus();
    }
  }
  /**
   * Whether hiding must hand the focus back to the icon: only a pinned panel
   * holding the focus (e.g. on its close button) would otherwise drop it.
   * @returns `true` when focus is inside a visible pinned panel.
   */
  private shouldRestoreFocus(): boolean {
    const { panel } = this;
    return (
      this.shownPinned && undefined !== panel && !panel.hidden && this.dom.isFocusInside(panel)
    );
  }
  /**
   * Lazily create and mount the single panel.
   * @returns The panel element.
   */
  private ensurePanel(): IHoverPanelElement {
    if (undefined === this.panel) {
      this.panel = this.dom.createPanel();
      this.panel.setAttribute('id', HOVER_PANEL_ID);
      this.panel.hidden = true;
      this.dom.mountPanel(this.panel);
    }
    return this.panel;
  }
  /**
   * Switch the panel between hover mode (inert tooltip) and pinned mode
   * (interactive labelled group named after the icon's own label).
   * @param panel The panel element.
   * @param anchor The icon the panel is shown for.
   * @param pinned Whether the panel is pinned.
   */
  private applyMode(panel: IHoverPanelElement, anchor: IHoverAnchor, pinned: boolean): void {
    panel.setAttribute('data-pinned', String(pinned));
    if (!pinned) {
      panel.setAttribute('role', 'tooltip');
      panel.removeAttribute('aria-label');
      return;
    }
    panel.setAttribute('role', 'group');
    panel.setAttribute('aria-label', anchor.getAttribute('aria-label') ?? '');
  }
  /**
   * Link the icon to the popin for assistive technologies, unlinking the previous icon.
   * Hover mode describes the icon; pinned mode makes it control the expanded popin.
   * @param anchor The icon the popin is shown for.
   * @param pinned Whether the popin is pinned.
   */
  private describe(anchor: IHoverAnchor, pinned: boolean): void {
    if (this.shownAnchor !== anchor) {
      this.clearAnchor();
    }
    anchor.setAttribute('aria-expanded', String(pinned));
    if (pinned) {
      anchor.removeAttribute('aria-describedby');
      anchor.setAttribute('aria-controls', HOVER_PANEL_ID);
    } else {
      anchor.removeAttribute('aria-controls');
      anchor.setAttribute('aria-describedby', HOVER_PANEL_ID);
    }
    this.shownAnchor = anchor;
    this.shownPinned = pinned;
  }
  /** Drop the popin links from the icon it was last shown for. */
  private clearAnchor(): void {
    this.shownAnchor?.removeAttribute('aria-describedby');
    this.shownAnchor?.removeAttribute('aria-controls');
    this.shownAnchor?.setAttribute('aria-expanded', 'false');
    this.shownAnchor = undefined;
  }
  /**
   * Place the panel below or above the icon with its arrow aimed at the icon.
   * @param panel The panel element.
   * @param anchor The preview icon.
   */
  private position(panel: IHoverPanelElement, anchor: IHoverAnchor): void {
    const placement = computeHoverPlacement({
      anchor: anchor.getBoundingClientRect(),
      panel: { width: panel.offsetWidth, height: panel.offsetHeight },
      viewport: this.dom.viewport(),
    });
    panel.setAttribute('data-side', placement.side);
    panel.style.left = `${placement.left}px`;
    panel.style.top = `${placement.top}px`;
    panel.style.setProperty('--arrow-left', `${placement.arrowLeft}px`);
  }
}
