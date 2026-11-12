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
