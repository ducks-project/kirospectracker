import { onInnerClick, buttonEl } from '../createElement';
import { HOVER_PANEL_ID } from './DomHoverPanelView';
import { HOVER_CLOSE_CLASS, PREVIEW_ICON_CLASS } from './previewDomNames';
import { ACTIVATION_KEYS } from '../activationKeys';
/** The subset of the hover controller the preview icon drives. */
export interface IPreviewIconControls {
  enter(folderPath: string): void;
  leave(): void;
  togglePin(folderPath: string): void;
}
/** Everything needed to build one card's preview icon button. */
export interface IPreviewIconOptions {
  /** Absolute path of the spec folder the icon previews. */
  readonly folderPath: string;
  /** Translated accessible label, e.g. "Preview alpha". */
  readonly label: string;
  /** Decorative glyph (`aria-hidden`) drawn inside the button. */
  readonly glyph: Node;
  /** The controller receiving hover, focus and activation events. */
  readonly controls: IPreviewIconControls;
}
/**
 * Move the focus from a pinned icon to the popin's close button on a forward Tab,
 * since the popin is mounted far from the icon in the DOM order.
 * @param event The keydown event received by the icon.
 * @param icon The icon button.
 */
function focusCloseOnTab(event: KeyboardEvent, icon: HTMLElement): void {
  if ('Tab' !== event.key || event.shiftKey || 'true' !== icon.getAttribute('aria-expanded')) {
    return;
  }
  const close = document.querySelector<HTMLElement>(`#${HOVER_PANEL_ID} .${HOVER_CLOSE_CLASS}`);
  if (null === close) {
    return;
  }
  event.preventDefault();
  close.focus();
}
/**
 * Build the eye button opening a card's introduction preview.
 *
 * Hovering or focusing it requests the preview, activating it (click, Enter or
 * Space) pins or unpins it. Activation events never reach the card, so they do
 * not also trigger the card-body open gesture. The button carries the accessible
 * label and `aria-expanded`; the glyph stays decorative.
 * @param options The folder, label, glyph and controller.
 * @returns The button element.
 */
export function createPreviewIconButton(options: IPreviewIconOptions): HTMLElement {
  const { folderPath, label, glyph, controls } = options;
  const button = buttonEl(PREVIEW_ICON_CLASS);
  button.setAttribute('aria-label', label);
  button.setAttribute('aria-expanded', 'false');
  button.appendChild(glyph);
  button.addEventListener('mouseenter', () => controls.enter(folderPath));
  button.addEventListener('focus', () => controls.enter(folderPath));
  button.addEventListener('mouseleave', () => controls.leave());
  button.addEventListener('blur', () => controls.leave());
  onInnerClick(button, () => controls.togglePin(folderPath));
  button.addEventListener('keydown', (event) => {
    if (ACTIVATION_KEYS.has(event.key)) {
      // Let the native button click through, but keep the card from opening.
      event.stopPropagation();
    }
    focusCloseOnTab(event, button);
  });
  return button;
}
