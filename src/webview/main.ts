import type { DashboardOutboundMessage } from '../core/model/IDashboardMessage';
import { routeDashboardMessage } from './DashboardMessageRouter';
import type { IDashboardMessageHandlers } from './DashboardMessageRouter';
import { installMenuDismissal } from './DocumentDismissal';
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

/**
 * Handlers of the host messages. Each keeps today's effect order: store, then
 * hover caches, then redraw.
 */
const handlers: IDashboardMessageHandlers = {
  // Adopt the translated catalogue and rebuild the UI in that language. The
  // persistent toolbar is dropped so it is rebuilt with the new strings; a first
  // `render` after this message builds it directly translated.
  strings: (message) => {
    text.adopt(message.messages);
    const app = document.getElementById('app');
    if (null === app) {
      return;
    }
    app.replaceChildren();
    if (store.hasRendered) {
      renderer.render();
    }
  },
  render: (message) => {
    store.applyRender(message);
    // A full re-render means the specs were re-discovered (workspace change, a
    // entry document added), so clear the hover request gate and cache: a
    // later hover can retry a spec whose reply was lost or whose entry document
    // appeared after the first hover.
    preview.reset();
    store.markRendered();
    renderer.render();
  },
  specUpdated: (message) => {
    store.applySpecStats(message.stats, message.globalTaskStats);
    // The entry document may have changed (`.config.kiro`, `bugfix.md` added):
    // drop this card's hover caches so the next hover re-asks the host.
    preview.invalidate(message.card.folderPath);
    renderer.applySpecUpdate(message.card);
  },
  toggleLayout: () => {
    store.flipLayout();
    renderer.render();
  },
  introduction: (message) => preview.receive(message.folderPath, message.introduction),
};

// Listener order matters: document keydown, scroll (capture) and click (capture)
// dismissals of the preview, then the bubble click closing the open menus, then
// the host message listener, then the `ready` handshake.
preview.installDismissal();
installMenuDismissal();
window.addEventListener('message', (event: MessageEvent<DashboardOutboundMessage>) => {
  // Only the webview host (same origin as this document) may drive the
  // dashboard; ignore anything else before reading its data (CWE-940).
  if (event.origin !== resolveTrustedOrigin(window.location.origin)) {
    return;
  }
  routeDashboardMessage(event.data, handlers);
});
// Signal the host that the listener above is wired. VS Code disposes and
// re-creates this webview when the view is hidden and shown again, so on every
// (re)load the document boots with an empty DOM; this handshake tells the host
// to (re)post the current cached state, which is what makes a reopened view
// show the specs without a manual Refresh. Posted after the listener is set up
// so the host's reply can never be missed.
vscodeApi.postMessage({ type: 'ready' });
