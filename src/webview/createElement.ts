/**
 * Create an element with optional class and text.
 * @param tag Element tag name.
 * @param className Optional class name.
 * @param text Optional text content (assigned via textContent, never HTML).
 * @returns The created element.
 */
export function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (undefined !== className) {
    node.className = className;
  }
  if (undefined !== text) {
    node.textContent = text;
  }
  return node;
}
/**
 * Create a `type="button"` button with optional class and text.
 * @param className Optional class name.
 * @param text Optional text content (assigned via textContent, never HTML).
 * @returns The created button.
 */
export function buttonEl(className?: string, text?: string): HTMLElement {
  const node = el('button', className, text);
  node.setAttribute('type', 'button');
  return node;
}
/**
 * Run a handler on click without letting the click reach the enclosing card, so
 * an inner control never also triggers the card-body open gesture.
 * @param node The inner control.
 * @param handler The click handler.
 */
export function onInnerClick(node: HTMLElement, handler: () => void): void {
  node.addEventListener('click', (event) => {
    event.stopPropagation();
    handler();
  });
}
/**
 * Set the pressed state of a toggle button together with its accessible label,
 * which doubles as its tooltip.
 * @param node The toggle button.
 * @param pressed Whether the toggle is active.
 * @param label The accessible label and tooltip.
 */
export function setToggleState(node: HTMLElement, pressed: boolean, label: string): void {
  node.setAttribute('aria-pressed', String(pressed));
  node.setAttribute('aria-label', label);
  node.title = label;
}
