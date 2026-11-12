/**
 * Hide every open dropdown menu matching a selector and reset the
 * `aria-expanded` state of its toggle.
 * @param menuSelector Selector of the dropdown menus.
 * @param toggleSelector Selector of the toggle, looked up in the menu's parent.
 */
function closeOpenMenus(menuSelector: string, toggleSelector: string): void {
  document.querySelectorAll(menuSelector).forEach((menu) => {
    if (!(menu instanceof HTMLElement) || menu.hidden) {
      return;
    }
    menu.hidden = true;
    const toggle = menu.parentElement?.querySelector(toggleSelector);
    toggle?.setAttribute('aria-expanded', 'false');
  });
}
/**
 * Close any open run-scope dropdown and folder-filter menu when a click lands
 * outside it, so the menus behave like native popups. The handler only hides
 * already-open menus; it never rebuilds the DOM.
 */
export function installMenuDismissal(): void {
  document.addEventListener('click', () => {
    closeOpenMenus('.run-menu', '.run-toggle');
    closeOpenMenus('.folder-menu', '.folder-filter-button');
  });
}
