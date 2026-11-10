/**
 * View port (Dependency Inversion) over the floating hover preview panel.
 *
 * It lets {@link HoverIntroductionController} drive the panel without touching
 * the DOM directly: `main.ts` provides the concrete DOM-backed adapter, while
 * tests inject a double. The controller never builds markup; it only hands plain
 * text to {@link showText}, which the adapter renders via `textContent` so the
 * webview CSP (no `innerHTML`) is honoured.
 */
export interface IHoverPanelView {
  /**
   * Show the panel anchored to a card's preview icon, filled with the given
   * introduction text.
   * @param anchorFolderPath Folder path of the card whose icon the panel is anchored to.
   * @param introduction The introduction text, rendered as inert text.
   * @param pinned Whether the panel is pinned: interactive, with a close button.
   */
  showText(anchorFolderPath: string, introduction: string, pinned: boolean): void;

  /** Hide the panel, giving focus back to the icon when it was inside a pinned panel. */
  hide(): void;
}
