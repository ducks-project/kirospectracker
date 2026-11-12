import type { ISpecCardView } from '../../core/model/ISpecCardView';
import type { IScheduler, ScheduleHandle } from '../../core/ports/IScheduler';
import { el } from '../createElement';
import type { IViewText } from '../state/IViewText';
import type { IWebviewApi } from '../state/IWebviewApi';
import { icon } from '../ToolbarIcon';
import type { IHoverAnchor, IHoverDom, IHoverPanelElement } from './DomHoverPanelView';
import { DomHoverPanelView } from './DomHoverPanelView';
import { createHoverCloseButton } from './HoverCloseButton';
import { HoverIntroductionController } from './HoverIntroductionController';
import { createPreviewIconButton } from './PreviewIconButton';
import { PREVIEW_ICON_CLASS } from './previewDomNames';

/** Class of the floating hover panel, whose own inner scroll must not dismiss it. */
const HOVER_PANEL_CLASS = 'card-hover-panel';

/** What the composition root needs from the preview feature. */
export interface IPreviewWiring {
  /**
   * Build a card's eye button opening its entry-document introduction preview,
   * or nothing when the spec has no resolved entry document.
   * @param card The spec card view.
   * @returns The preview button, or `undefined` without an entry document.
   */
  renderPreviewIcon(card: ISpecCardView): HTMLElement | undefined;
  /** Clear the hover request gate and cache (full re-render). */
  reset(): void;
  /**
   * Drop one card's hover caches so the next hover re-asks the host.
   * @param folderPath The spec folder path.
   */
  invalidate(folderPath: string): void;
  /**
   * Deliver a host introduction reply to the controller.
   * @param folderPath The spec folder path.
   * @param introduction The introduction text, or `undefined` when unavailable.
   */
  receive(folderPath: string, introduction: string | undefined): void;
  /**
   * Register the document listeners dismissing the panel: Escape (keydown), a
   * page scroll (capture) and an outside click (capture), in that order.
   */
  installDismissal(): void;
}

/** Collaborators of the preview wiring. */
export interface IPreviewWiringOptions {
  /** The webview API, used to post the introduction requests. */
  readonly api: IWebviewApi;
  /** The webview translation surface. */
  readonly text: IViewText;
  /** Resolves the mounted preview icon of a card (lazy, breaks the render cycle). */
  readonly findAnchor: (folderPath: string) => IHoverAnchor | undefined;
}

/**
 * {@link IScheduler} adapter over `setTimeout`/`clearTimeout`, backing the hover
 * debounce. It keeps the controller's timing deterministic in tests (a manual
 * scheduler is injected there) while using real timers in the webview.
 */
const timeoutScheduler: IScheduler = {
  schedule(callback: () => void, delayMs: number): ScheduleHandle {
    const handle = setTimeout(callback, delayMs);
    return () => clearTimeout(handle);
  },
};

/**
 * Build the DOM environment for the hover panel, backed by the real document.
 * @param options The collaborators.
 * @param close Callback closing the panel (the controller is created after the DOM).
 * @returns The hover DOM environment.
 */
function createHoverDom(options: IPreviewWiringOptions, close: () => void): IHoverDom {
  return {
    findAnchor: options.findAnchor,
    createPanel: (): IHoverPanelElement => el('div', HOVER_PANEL_CLASS),
    mountPanel: (panel: IHoverPanelElement): void => {
      document.body.appendChild(panel as HTMLElement);
    },
    createIntro: (intro: string): unknown => el('p', 'card-hover-intro', intro),
    createCloseButton: (): unknown =>
      createHoverCloseButton(options.text.t('Close preview'), close),
    isFocusInside: (panel: IHoverPanelElement): boolean =>
      (panel as HTMLElement).contains(document.activeElement),
    viewport: () => ({ width: window.innerWidth, height: window.innerHeight }),
  };
}

/**
 * Wire the hover-preview feature: the DOM environment of the floating panel, its
 * single controller, the card eye button factory and the dismissal listeners.
 * @param options The collaborators.
 * @returns The preview wiring.
 */
export function createPreviewWiring(options: IPreviewWiringOptions): IPreviewWiring {
  const { api, text } = options;
  /** The single hover controller owning the request gate, cache and debounce. */
  const controller = new HoverIntroductionController(
    timeoutScheduler,
    (message) => api.postMessage(message),
    new DomHoverPanelView(createHoverDom(options, () => controller.close())),
  );
  return {
    renderPreviewIcon: (card) =>
      undefined === card.entryDocument
        ? undefined
        : createPreviewIconButton({
            folderPath: card.folderPath,
            label: text.t('Preview {0}', card.name),
            glyph: icon('eye'),
            controls: controller,
          }),
    reset: () => controller.reset(),
    invalidate: (folderPath) => controller.invalidate(folderPath),
    receive: (folderPath, introduction) => controller.receive(folderPath, introduction),
    installDismissal: () => installDismissal(() => controller.close()),
  };
}

/**
 * Register the document listeners dismissing the hover panel.
 *
 * Escape closes it. A page scroll closes it too: the listener is registered in
 * the capture phase (scroll does not bubble) so an inner scrolling container is
 * caught, while a scroll inside the panel's own text is ignored. A click outside
 * the popin and its icon closes it; that one is also captured so inner controls
 * that stop propagation cannot hide the click.
 * @param close Callback closing the panel (idempotent and cheap).
 */
function installDismissal(close: () => void): void {
  document.addEventListener('keydown', (event: KeyboardEvent): void => {
    if ('Escape' === event.key) {
      close();
    }
  });
  document.addEventListener(
    'scroll',
    (event: Event): void => {
      const { target } = event;
      if (target instanceof Element && null !== target.closest(`.${HOVER_PANEL_CLASS}`)) {
        return;
      }
      close();
    },
    { capture: true, passive: true },
  );
  document.addEventListener(
    'click',
    (event: MouseEvent): void => {
      const { target } = event;
      const selector = `.${HOVER_PANEL_CLASS}, .${PREVIEW_ICON_CLASS}`;
      if (target instanceof Element && null !== target.closest(selector)) {
        return;
      }
      close();
    },
    { capture: true },
  );
}
