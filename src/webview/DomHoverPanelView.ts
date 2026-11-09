import type { IHoverPanelView } from './IHoverPanelView';
import { computeHoverPlacement } from './computeHoverPlacement';
import type { IHoverRect } from './computeHoverPlacement';

/** Stable id of the popin, referenced by the card's `aria-describedby`. */
export const HOVER_PANEL_ID = 'card-hover-panel';
/** Minimal card element the panel anchors to. */
export interface IHoverAnchor {
  getBoundingClientRect(): IHoverRect;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}
/** Minimal panel element the adapter drives (structural subset of `HTMLElement`). */
export interface IHoverPanelElement {
  hidden: boolean;
  readonly offsetWidth: number;
  readonly offsetHeight: number;
  readonly style: { left: string; top: string; setProperty(name: string, value: string): void };
  setAttribute(name: string, value: string): void;
  replaceChildren(...nodes: never[] | unknown[]): void;
}

/** Minimal DOM environment injected so the adapter is testable without a browser. */
export interface IHoverDom {
  /** Resolve the mounted card for a spec folder path, if currently rendered. */
  findAnchor(folderPath: string): IHoverAnchor | undefined;
  /** Create the (detached) floating panel element. */
  createPanel(): IHoverPanelElement;
  /** Append the panel to the document body. */
  mountPanel(panel: IHoverPanelElement): void;
  /** Build the inert text paragraph shown inside the panel. */
  createIntro(text: string): unknown;
  /** Current viewport size. */
  viewport(): { readonly width: number; readonly height: number };
}

/**
 * DOM-backed {@link IHoverPanelView} adapter driving the floating preview panel.
 *
 * All browser access goes through the injected {@link IHoverDom}, so the display
 * logic (lazy creation, anchor lookup, viewport clamping, hide) is unit-testable.
 * Content is handed over as inert text nodes (never `innerHTML`) to honour the
 * webview CSP. When the anchor card is not rendered the panel stays hidden.
 */
export class DomHoverPanelView implements IHoverPanelView {
  private readonly dom: IHoverDom;
  private panel: IHoverPanelElement | undefined;
  private describedAnchor: IHoverAnchor | undefined;

  /**
   * Build the adapter over its DOM environment.
   * @param dom The injected DOM environment.
   */
  public constructor(dom: IHoverDom) {
    this.dom = dom;
  }

  /** @inheritdoc */
  public showText(anchorFolderPath: string, introduction: string): void {
    const anchor = this.dom.findAnchor(anchorFolderPath);
    if (undefined === anchor) {
      return;
    }
    const panel = this.ensurePanel();
    panel.replaceChildren(this.dom.createIntro(introduction));
    panel.hidden = false;
    this.position(panel, anchor);
    this.describe(anchor);
  }

  /** @inheritdoc */
  public hide(): void {
    this.describedAnchor?.removeAttribute('aria-describedby');
    this.describedAnchor = undefined;
    if (undefined !== this.panel) {
      this.panel.hidden = true;
    }
  }

  /**
   * Lazily create and mount the single panel.
   * @returns The panel element.
   */
  private ensurePanel(): IHoverPanelElement {
    if (undefined === this.panel) {
      this.panel = this.dom.createPanel();
      this.panel.setAttribute('role', 'tooltip');
      this.panel.setAttribute('id', HOVER_PANEL_ID);
      this.panel.hidden = true;
      this.dom.mountPanel(this.panel);
    }
    return this.panel;
  }

  /**
   * Link the card to the popin for assistive technologies, unlinking the previous card.
   * @param anchor The card the popin is shown for.
   */
  private describe(anchor: IHoverAnchor): void {
    if (this.describedAnchor !== anchor) {
      this.describedAnchor?.removeAttribute('aria-describedby');
    }
    anchor.setAttribute('aria-describedby', HOVER_PANEL_ID);
    this.describedAnchor = anchor;
  }
  /**
   * Place the panel below or above the card with its arrow aimed at the card.
   * @param panel The panel element.
   * @param anchor The hovered card.
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
