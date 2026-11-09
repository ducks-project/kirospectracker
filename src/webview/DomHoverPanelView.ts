import type { IHoverPanelView } from './IHoverPanelView';

/** Viewport margin, in pixels, kept between the panel and the window edges. */
const PANEL_VIEWPORT_MARGIN = 8;

/** Minimal rectangle of a hovered card, in viewport coordinates. */
export interface IHoverAnchorRect {
  readonly left: number;
  readonly bottom: number;
}

/** Minimal card element the panel anchors to. */
export interface IHoverAnchor {
  getBoundingClientRect(): IHoverAnchorRect;
}

/** Minimal panel element the adapter drives (structural subset of `HTMLElement`). */
export interface IHoverPanelElement {
  hidden: boolean;
  readonly offsetWidth: number;
  readonly offsetHeight: number;
  readonly style: { left: string; top: string };
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
  }

  /** @inheritdoc */
  public hide(): void {
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
      this.panel.hidden = true;
      this.dom.mountPanel(this.panel);
    }
    return this.panel;
  }

  /**
   * Position the panel just below the card, clamped inside the viewport.
   * @param panel The panel element.
   * @param anchor The hovered card.
   */
  private position(panel: IHoverPanelElement, anchor: IHoverAnchor): void {
    const rect = anchor.getBoundingClientRect();
    const view = this.dom.viewport();
    const maxLeft = view.width - panel.offsetWidth - PANEL_VIEWPORT_MARGIN;
    const left = Math.max(PANEL_VIEWPORT_MARGIN, Math.min(rect.left, maxLeft));
    const maxTop = view.height - panel.offsetHeight - PANEL_VIEWPORT_MARGIN;
    const top = Math.max(
      PANEL_VIEWPORT_MARGIN,
      Math.min(rect.bottom + PANEL_VIEWPORT_MARGIN, maxTop),
    );
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }
}
