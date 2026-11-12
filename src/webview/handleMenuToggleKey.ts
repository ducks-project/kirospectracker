import { MENU_TOGGLE_KEYS } from './activationKeys';
/**
 * Handle a keydown on a dropdown toggle: Escape closes the menu, Enter/Space
 * toggle it.
 * @param event The keyboard event.
 * @param menu The dropdown menu element.
 * @param setExpanded Callback setting the open/closed state.
 */
export function handleMenuToggleKey(
  event: KeyboardEvent,
  menu: HTMLElement,
  setExpanded: (open: boolean) => void,
): void {
  if ('Escape' === event.key) {
    setExpanded(false);
    return;
  }
  if (!MENU_TOGGLE_KEYS.has(event.key)) {
    return;
  }
  event.preventDefault();
  setExpanded(menu.hidden);
}
