/**
 * Close any open run-scope dropdown and folder-filter menu when a click lands
 * outside it, so the menus behave like native popups. The handler only hides
 * already-open menus; it never rebuilds the DOM.
 */
export function installMenuDismissal(): void {
  document.addEventListener('click', () => {
    document.querySelectorAll('.run-menu').forEach((menu) => {
      if (!(menu instanceof HTMLElement) || menu.hidden) {
        return;
      }
      menu.hidden = true;
      const toggle = menu.parentElement?.querySelector('.run-toggle');
      toggle?.setAttribute('aria-expanded', 'false');
    });
    document.querySelectorAll('.folder-menu').forEach((menu) => {
      if (!(menu instanceof HTMLElement) || menu.hidden) {
        return;
      }
      menu.hidden = true;
      const button = menu.parentElement?.querySelector('.folder-filter-button');
      button?.setAttribute('aria-expanded', 'false');
    });
  });
}
