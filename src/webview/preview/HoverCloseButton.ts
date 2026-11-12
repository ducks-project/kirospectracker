import { HOVER_CLOSE_CLASS, PREVIEW_ICON_CLASS } from './previewDomNames';
/** The multiplication sign used as the close glyph. */
const CLOSE_GLYPH = '\u00D7';
/**
 * Handle Tab navigation out of the close button. The popin is mounted away from
 * its icon, so the natural tab order would strand the user: Shift+Tab goes back
 * to the (still pinned) icon, and Tab closes the popin, which hands the focus
 * back to the icon too.
 * @param event The keydown event.
 * @param onClose Closes the popin.
 */
function leaveOnTab(event: KeyboardEvent, onClose: () => void): void {
  if ('Tab' !== event.key) {
    return;
  }
  event.preventDefault();
  if (!event.shiftKey) {
    onClose();
    return;
  }
  document.querySelector<HTMLElement>(`.${PREVIEW_ICON_CLASS}[aria-expanded="true"]`)?.focus();
}
/**
 * Build the close button of a pinned preview popin.
 * @param label Translated accessible label, e.g. "Close preview".
 * @param onClose Called when the button is activated.
 * @returns The button element.
 */
export function createHoverCloseButton(label: string, onClose: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = HOVER_CLOSE_CLASS;
  button.setAttribute('type', 'button');
  button.setAttribute('aria-label', label);
  button.title = label;
  button.textContent = CLOSE_GLYPH;
  button.addEventListener('click', onClose);
  button.addEventListener('keydown', (event) => leaveOnTab(event, onClose));
  return button;
}
