import { WEBVIEW_ORIGIN } from './DashboardHost';
import type { IDashboardScenario } from './run-dashboard-scenario';
import { FULL_CARDS, SMALL_CARDS, FOLDER_A, ETA, renderMessage } from './dashboard-card-fixtures';
import { MARKED_CATALOG, stringsMessage } from './strings-messages';

/** Origins the `message` guard must reject (compared with {@link WEBVIEW_ORIGIN}). */
const HOSTILE_ORIGINS: readonly string[] = [
  'https://evil.example',
  'vscode-webview://some-other-webview',
  `${WEBVIEW_ORIGIN}.evil.example`,
  `${WEBVIEW_ORIGIN}/`,
  WEBVIEW_ORIGIN.toUpperCase(),
  'null',
  '',
];

/** Messages a hostile page might send; none may have any effect. */
const HOSTILE_PAYLOADS: readonly unknown[] = [
  renderMessage(FULL_CARDS),
  stringsMessage('fr', MARKED_CATALOG),
  { type: 'toggleLayout' },
  { type: 'introduction', folderPath: ETA.folderPath, introduction: 'injected' },
  { type: 'specUpdated', card: ETA, stats: renderMessage([ETA]).stats, globalTaskStats: {} },
];

/** Scenarios about boot, the `ready` handshake, strings and the origin guard. */
export const BOOT_AND_MESSAGE_SCENARIOS: readonly IDashboardScenario[] = [
  {
    name: 'boot-ready-handshake',
    run: (d) => {
      d.note('the bundle posts ready once its listeners are wired, and draws nothing yet');
    },
  },
  {
    name: 'boot-restores-persisted-state',
    boot: {
      persistedState: {
        layout: 'grid',
        filterKeys: ['notStarted', 'inProgress'],
        folderKeys: [FOLDER_A],
      },
    },
    run: (d) => {
      d.post(renderMessage(FULL_CARDS));
      d.checkpoint('render with the state restored by getState()');
    },
  },
  {
    name: 'boot-ignores-malformed-persisted-state',
    boot: {
      persistedState: {
        layout: 'grid',
        filterKeys: ['bogus', 42, 'malformed'],
        folderKeys: [42, '', FOLDER_A],
      },
    },
    run: (d) => {
      d.post(renderMessage(SMALL_CARDS));
      d.checkpoint('render with a persisted state that is partly invalid');
    },
  },
  {
    name: 'strings-english-before-render',
    run: (d) => {
      d.post(stringsMessage('en', {}));
      d.checkpoint('strings (en) before any render: the app root stays empty', '#app');
      d.post(renderMessage(SMALL_CARDS));
      d.checkpoint('first render is built directly');
    },
  },
  {
    name: 'strings-french-before-render',
    run: (d) => {
      d.post(stringsMessage('fr', MARKED_CATALOG));
      d.checkpoint('strings (fr) before any render', '#app');
      d.post(renderMessage(FULL_CARDS));
      d.checkpoint('first render is built translated (singular and plural forms)');
    },
  },
  {
    name: 'strings-french-after-render',
    run: (d) => {
      d.post(renderMessage(SMALL_CARDS));
      d.checkpoint('first render, English');
      d.post(stringsMessage('fr', MARKED_CATALOG));
      d.checkpoint('strings (fr) after a render: the app is rebuilt translated');
    },
  },
  {
    name: 'strings-partial-catalog-falls-back-to-english',
    run: (d) => {
      d.post(
        stringsMessage('fr', { 'Active specs': 'Specs actives', 'Sync Files': 'Synchroniser' }),
      );
      d.post(renderMessage(SMALL_CARDS));
      d.checkpoint('keys missing from the catalogue stay English');
    },
  },
  {
    name: 'message-origin-guard-rejects-foreign-origins',
    run: (d) => {
      HOSTILE_ORIGINS.forEach((origin) => {
        HOSTILE_PAYLOADS.forEach((payload) => d.post(payload, origin));
        d.note(
          `delivered ${HOSTILE_PAYLOADS.length} messages from origin ${JSON.stringify(origin)}`,
        );
      });
      d.checkpoint('after hostile deliveries: no effect, nothing posted, nothing drawn', '#app');
      d.post(renderMessage(SMALL_CARDS));
      d.checkpoint('a message from the trusted origin is still honoured');
    },
  },
  {
    name: 'message-origin-guard-opaque-null-location',
    boot: { locationOrigin: 'null' },
    run: (d) => {
      d.post(renderMessage(SMALL_CARDS), 'null');
      d.post(renderMessage(SMALL_CARDS), '');
      d.post(renderMessage(SMALL_CARDS), WEBVIEW_ORIGIN);
      d.checkpoint('opaque webview origin: every message is rejected', '#app');
    },
  },
  {
    name: 'message-origin-guard-empty-location',
    boot: { locationOrigin: '' },
    run: (d) => {
      d.post(renderMessage(SMALL_CARDS), '');
      d.post(renderMessage(SMALL_CARDS), 'null');
      d.post(renderMessage(SMALL_CARDS), WEBVIEW_ORIGIN);
      d.checkpoint('empty webview origin: every message is rejected', '#app');
    },
  },
  {
    name: 'message-unknown-type-is-ignored',
    run: (d) => {
      d.post({ type: 'bogus' });
      d.post({ type: 'ready' });
      d.checkpoint('unknown outbound types do nothing', '#app');
      d.post(renderMessage(SMALL_CARDS));
    },
  },
];
