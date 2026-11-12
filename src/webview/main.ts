import type { DashboardOutboundMessage, IRenderMessage } from '../core/model/IDashboardMessage';
import { DashboardRenderer } from './DashboardRenderer';
import { createPreviewWiring } from './preview/PreviewWiring';
import { resolveTrustedOrigin } from './resolveTrustedOrigin';
import { DashboardStore } from './state/DashboardStore';
import type { IDashboardActions } from './state/IDashboardActions';
import type { IWebviewApi } from './state/IWebviewApi';
import { ViewText } from './state/ViewText';

declare function acquireVsCodeApi(): IWebviewApi;

const vscodeApi = acquireVsCodeApi();

/** Render state kept between messages (persisted parts go through the webview API). */
const store = new DashboardStore(vscodeApi);

/** Translation surface and the translated core projectors. */
const text = new ViewText();

/**
 * Dashboard intents handed to the views. Each keeps the effect order: mutate and
 * persist the state, then post to the host, then redraw. The renderer is reached
 * lazily, so the views never depend on it.
 */
const actions: IDashboardActions = {
  toggleStatusFilter: (key) => {
    store.toggleStatusFilter(key);
    renderer.render();
  },
  toggleFolderFilter: (key) => {
    store.toggleFolderFilter(key);
    renderer.render();
  },
  selectLayout: (layout) => {
    if (!store.selectLayout(layout)) {
      return;
    }
    vscodeApi.postMessage({ type: 'setLayout', layout: store.layout });
    renderer.render();
  },
  setQuery: (query) => {
    store.setQuery(query);
    renderer.render();
  },
  post: (message) => vscodeApi.postMessage(message),
};

/** Hover-preview feature; it finds its anchor through the renderer lazily. */
const preview = createPreviewWiring({
  api: vscodeApi,
  text,
  findAnchor: (folderPath) => renderer.findCardAnchor(folderPath),
});

/** Draws the dashboard and owns the mounted card-node cache. */
const renderer = new DashboardRenderer(store, text, actions, (card) =>
  preview.renderPreviewIcon(card),
);

preview.installDismissal();

// Close any open run-scope dropdown when a click lands outside it, so the menu
// behaves like a native popup. The handler only hides already-open menus; it
// never rebuilds the DOM.
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

/**
 * Adopt the translated catalogue the host posted and rebuild the UI in that
 * language. The persistent toolbar is dropped so it is rebuilt with the new
 * strings; a first `render` after this message builds it directly translated.
 * @param messages The translated templates keyed by English message.
 */
function applyStrings(messages: Readonly<Record<string, string>>): void {
  text.adopt(messages);
  const app = document.getElementById('app');
  if (null === app) {
    return;
  }
  app.replaceChildren();
  if (store.hasRendered) {
    renderer.render();
  }
}
/**
 * Apply a full `render` message: store the new state and redraw.
 * @param message The render message.
 */
function applyRender(message: IRenderMessage): void {
  store.applyRender(message);
  // A full re-render means the specs were re-discovered (workspace change, a
  // entry document added), so clear the hover request gate and cache: a
  // later hover can retry a spec whose reply was lost or whose entry document
  // appeared after the first hover.
  preview.reset();
  store.markRendered();
  renderer.render();
}
window.addEventListener('message', (event: MessageEvent<DashboardOutboundMessage>) => {
  // Only the webview host (same origin as this document) may drive the
  // dashboard; ignore anything else before reading its data (CWE-940).
  if (event.origin !== resolveTrustedOrigin(window.location.origin)) {
    return;
  }
  const message = event.data;
  if ('strings' === message.type) {
    applyStrings(message.messages);
    return;
  }
  if ('render' === message.type) {
    applyRender(message);
    return;
  }
  if ('specUpdated' === message.type) {
    store.applySpecStats(message.stats, message.globalTaskStats);
    // The entry document may have changed (`.config.kiro`, `bugfix.md` added):
    // drop this card's hover caches so the next hover re-asks the host.
    preview.invalidate(message.card.folderPath);
    renderer.applySpecUpdate(message.card);
    return;
  }
  if ('toggleLayout' === message.type) {
    store.flipLayout();
    renderer.render();
    return;
  }
  if ('introduction' === message.type) {
    preview.receive(message.folderPath, message.introduction);
  }
});
// Signal the host that the listener above is wired. VS Code disposes and
// re-creates this webview when the view is hidden and shown again, so on every
// (re)load the document boots with an empty DOM; this handshake tells the host
// to (re)post the current cached state, which is what makes a reopened view
// show the specs without a manual Refresh. Posted after the listener is set up
// so the host's reply can never be missed.
vscodeApi.postMessage({ type: 'ready' });
