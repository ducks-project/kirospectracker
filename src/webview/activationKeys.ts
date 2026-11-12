/**
 * Keys that activate a button-like control from the keyboard (card body, preview
 * icon). For the preview icon they must not reach the card-body open gesture.
 */
export const ACTIVATION_KEYS: ReadonlySet<string> = new Set(['Enter', ' ']);

/** Keys that toggle or close a dropdown menu from the keyboard (run scope, folder filter). */
export const MENU_TOGGLE_KEYS: ReadonlySet<string> = new Set(['Enter', ' ', 'Escape']);
