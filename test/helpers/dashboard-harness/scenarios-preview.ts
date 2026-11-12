import { SpecStatus } from '../../../src/core/model/SpecStatus';
import type { DashboardDriver } from './DashboardDriver';
import type { IDashboardScenario } from './run-dashboard-scenario';
import {
  ALPHA,
  BETA,
  FULL_CARDS,
  GLOBAL_TASK_STATS,
  progress,
  renderMessage,
  statsOf,
} from './dashboard-card-fixtures';

/** Delay, in milliseconds, between a hover and its introduction request (v0.15.0). */
const HOVER_DELAY_MS = 150;
/** What the preview checkpoints serialise: the popin and the eye buttons it is linked to. */
const PREVIEW_DOM =
  '.card-hover-panel, .card-preview[aria-expanded="true"], .card-preview[aria-describedby], .card-preview[aria-controls]';

/**
 * Render the full fixture set.
 * @param d The driver.
 */
function open(d: DashboardDriver): void {
  d.post(renderMessage(FULL_CARDS));
}

/**
 * The eye button of a card.
 * @param d The driver.
 * @param name Spec name.
 * @returns The preview button.
 */
function eye(d: DashboardDriver, name: string): ReturnType<DashboardDriver['query']> {
  return d.inside(d.card(name), '.card-preview');
}

/**
 * Deliver the host's reply to a request.
 * @param d The driver.
 * @param name Spec name.
 * @param introduction The introduction text, or `undefined` when none.
 */
function reply(d: DashboardDriver, name: string, introduction: string | undefined): void {
  const card = FULL_CARDS.find((candidate) => name === candidate.name);
  d.post({ type: 'introduction', folderPath: card?.folderPath, introduction });
}

/**
 * Hover an eye, let the debounce elapse and deliver the reply.
 * @param d The driver.
 * @param name Spec name.
 */
function hoverAndReceive(d: DashboardDriver, name: string): void {
  d.hover(eye(d, name));
  d.advance(HOVER_DELAY_MS);
  reply(d, name, `Introduction of ${name}.`);
}

/**
 * Pin a card's preview and deliver the reply.
 * @param d The driver.
 * @param name Spec name.
 */
function pinAndReceive(d: DashboardDriver, name: string): void {
  d.click(eye(d, name));
  reply(d, name, `Introduction of ${name}.`);
}

/** Scenarios about the v0.15.0 preview (eye button, hover popin, pinned popin). */
export const PREVIEW_SCENARIOS: readonly IDashboardScenario[] = [
  {
    name: 'preview-eye-only-on-cards-with-an-entry-document',
    run: (d) => {
      open(d);
      d.note(`eye buttons: ${d.queryAll('.card-preview').length} for ${FULL_CARDS.length} cards`);
      d.note(`epsilon has an eye: ${null !== d.card('epsilon').querySelector('.card-preview')}`);
      d.note(`zeta has an eye: ${null !== d.card('zeta').querySelector('.card-preview')}`);
      d.checkpoint('eye of alpha', '.status-InProgress .card-heading');
    },
  },
  {
    name: 'preview-hover-waits-for-the-delay',
    run: (d) => {
      open(d);
      d.hover(eye(d, 'alpha'));
      d.advance(HOVER_DELAY_MS - 1);
      d.checkpoint('149 ms after the hover: nothing requested yet');
      d.advance(1);
      d.checkpoint('150 ms: requestIntroduction posted');
      reply(d, 'alpha', 'Introduction of alpha.');
      d.checkpoint('reply received: hover popin shown, eye described by it', PREVIEW_DOM);
      d.unhover(eye(d, 'alpha'));
      d.checkpoint('pointer leaves: popin hidden', PREVIEW_DOM);
      d.hover(eye(d, 'alpha'));
      d.checkpoint('hovering again shows the cached text at once', PREVIEW_DOM);
      d.advance(HOVER_DELAY_MS * 2);
      d.checkpoint('no second request for the same card');
    },
  },
  {
    name: 'preview-hover-cancelled-before-the-delay',
    run: (d) => {
      open(d);
      d.hover(eye(d, 'alpha'));
      d.advance(100);
      d.unhover(eye(d, 'alpha'));
      d.advance(500);
      d.checkpoint('left before 150 ms: nothing requested, no timer left');
    },
  },
  {
    name: 'preview-focus-and-blur-behave-like-hover',
    run: (d) => {
      open(d);
      eye(d, 'beta').focus();
      d.advance(HOVER_DELAY_MS);
      reply(d, 'beta', 'Introduction of beta.');
      d.checkpoint('keyboard focus on the eye requests and shows the popin', PREVIEW_DOM);
      d.query('input.search').focus();
      d.checkpoint('focus moved away: popin hidden', PREVIEW_DOM);
    },
  },
  {
    name: 'preview-click-pins-and-reclick-closes',
    run: (d) => {
      open(d);
      d.click(eye(d, 'alpha'));
      d.checkpoint('click: requested at once (no delay), nothing shown yet', PREVIEW_DOM);
      reply(d, 'alpha', 'Introduction of alpha.');
      d.checkpoint('reply: pinned popin with a close button', PREVIEW_DOM);
      d.unhover(eye(d, 'alpha'));
      d.checkpoint('pointer leaving a pinned popin does not close it', PREVIEW_DOM);
      d.click(eye(d, 'alpha'));
      d.checkpoint('clicking the eye again closes it', PREVIEW_DOM);
    },
  },
  {
    name: 'preview-close-button-returns-the-focus-to-the-eye',
    run: (d) => {
      open(d);
      pinAndReceive(d, 'alpha');
      const close = d.query('.card-hover-close');
      close.focus();
      d.checkpoint('focus inside the pinned popin', PREVIEW_DOM);
      d.click(close);
      d.checkpoint('× closes the popin and hands the focus back to the eye', PREVIEW_DOM);
    },
  },
  {
    name: 'preview-escape-closes',
    run: (d) => {
      open(d);
      pinAndReceive(d, 'alpha');
      d.key(d.document.body, 'Escape');
      d.checkpoint('Escape closes a pinned popin', PREVIEW_DOM);
      hoverAndReceive(d, 'beta');
      d.checkpoint('hover popin of beta', PREVIEW_DOM);
      d.key(d.document.body, 'Escape');
      d.checkpoint('Escape closes a hover popin', PREVIEW_DOM);
      d.key(d.document.body, 'a');
    },
  },
  {
    name: 'preview-outside-click-closes',
    run: (d) => {
      open(d);
      pinAndReceive(d, 'alpha');
      d.click(d.query('.card-hover-panel .card-hover-intro'));
      d.checkpoint('click inside the popin keeps it', PREVIEW_DOM);
      d.click(d.document.body);
      d.checkpoint('click outside closes it', PREVIEW_DOM);
      pinAndReceive(d, 'alpha');
      d.click(d.inside(d.card('gamma'), '.link'));
      d.checkpoint(
        'click on an inner control that stops propagation still closes it (capture phase)',
        PREVIEW_DOM,
      );
      pinAndReceive(d, 'alpha');
      d.click(eye(d, 'gamma'));
      d.checkpoint('click on another eye replaces the popin', PREVIEW_DOM);
    },
  },
  {
    name: 'preview-scroll-closes',
    run: (d) => {
      open(d);
      pinAndReceive(d, 'alpha');
      d.scroll(d.query('.card-hover-panel .card-hover-intro'));
      d.checkpoint('scroll inside the popin is ignored', PREVIEW_DOM);
      d.scroll(d.document.body);
      d.checkpoint('scroll elsewhere closes it', PREVIEW_DOM);
      hoverAndReceive(d, 'beta');
      d.scroll(d.document);
      d.checkpoint('scroll of the document closes a hover popin too', PREVIEW_DOM);
    },
  },
  {
    name: 'preview-tab-navigation',
    run: (d) => {
      open(d);
      pinAndReceive(d, 'alpha');
      eye(d, 'alpha').focus();
      const forward = d.key(eye(d, 'alpha'), 'Tab');
      d.note(`Tab on the pinned eye prevented: ${forward.defaultPrevented}`);
      d.checkpoint('Tab from the pinned eye moves the focus to the close button', PREVIEW_DOM);
      const backward = d.key(d.query('.card-hover-close'), 'Tab', { shiftKey: true });
      d.note(`Shift+Tab on × prevented: ${backward.defaultPrevented}`);
      d.checkpoint('Shift+Tab from × goes back to the eye', PREVIEW_DOM);
      d.key(eye(d, 'alpha'), 'Tab');
      d.key(d.query('.card-hover-close'), 'Tab');
      d.checkpoint('Tab on × closes the popin and focuses the eye', PREVIEW_DOM);
      const free = d.key(eye(d, 'alpha'), 'Tab');
      d.note(`Tab on an unpinned eye prevented: ${free.defaultPrevented}`);
    },
  },
  {
    name: 'preview-eye-keyboard-activation-does-not-open-the-card',
    run: (d) => {
      open(d);
      eye(d, 'alpha').focus();
      d.key(eye(d, 'alpha'), 'Enter');
      reply(d, 'alpha', 'Introduction of alpha.');
      d.checkpoint('Enter pins the preview and posts no openDocument', PREVIEW_DOM);
      d.key(eye(d, 'alpha'), ' ');
      d.checkpoint('Space unpins it', PREVIEW_DOM);
    },
  },
  {
    name: 'preview-pinned-popin-is-replaced-by-another-eye',
    run: (d) => {
      open(d);
      pinAndReceive(d, 'alpha');
      hoverAndReceive(d, 'gamma');
      d.checkpoint('hovering another eye replaces the pinned popin', PREVIEW_DOM);
    },
  },
  {
    name: 'preview-without-introduction-stays-hidden',
    run: (d) => {
      open(d);
      d.hover(eye(d, 'beta'));
      d.advance(HOVER_DELAY_MS);
      reply(d, 'beta', undefined);
      d.checkpoint('absent introduction: popin stays hidden', PREVIEW_DOM);
      d.unhover(eye(d, 'beta'));
      d.hover(eye(d, 'beta'));
      d.advance(HOVER_DELAY_MS);
      d.checkpoint('the absence is cached: no new request', PREVIEW_DOM);
    },
  },
  {
    name: 'preview-reply-of-another-card-is-only-cached',
    run: (d) => {
      open(d);
      d.hover(eye(d, 'alpha'));
      d.advance(HOVER_DELAY_MS);
      reply(d, 'gamma', 'Introduction of gamma.');
      d.checkpoint('a reply for a card that is not hovered shows nothing', PREVIEW_DOM);
      d.unhover(eye(d, 'alpha'));
      d.hover(eye(d, 'gamma'));
      d.checkpoint('hovering gamma shows its cached text without a request', PREVIEW_DOM);
    },
  },
  {
    name: 'preview-full-render-resets-the-request-gate',
    run: (d) => {
      open(d);
      hoverAndReceive(d, 'alpha');
      d.unhover(eye(d, 'alpha'));
      open(d);
      d.checkpoint('full render: cache and gate cleared', PREVIEW_DOM);
      hoverAndReceive(d, 'alpha');
      d.checkpoint('hovering again posts a second request', PREVIEW_DOM);
    },
  },
  {
    name: 'preview-full-render-closes-a-pinned-popin-holding-the-focus',
    run: (d) => {
      open(d);
      pinAndReceive(d, 'alpha');
      d.query('.card-hover-close').focus();
      d.checkpoint('pinned popin, focus on ×', PREVIEW_DOM);
      open(d);
      d.checkpoint(
        'full render: the controller is reset before the cards are redrawn',
        PREVIEW_DOM,
      );
    },
  },
  {
    name: 'preview-spec-updated-invalidates-only-that-card',
    run: (d) => {
      open(d);
      hoverAndReceive(d, 'alpha');
      d.unhover(eye(d, 'alpha'));
      hoverAndReceive(d, 'gamma');
      d.unhover(eye(d, 'gamma'));
      const updated = { ...ALPHA, progress: progress({ requiredDone: 6, requiredTodo: 1 }) };
      const cards = FULL_CARDS.map((existing) => (existing === ALPHA ? updated : existing));
      d.post({
        type: 'specUpdated',
        card: updated,
        stats: statsOf(cards),
        globalTaskStats: GLOBAL_TASK_STATS,
      });
      d.checkpoint('alpha updated (its node replaced)', PREVIEW_DOM);
      hoverAndReceive(d, 'alpha');
      d.unhover(eye(d, 'alpha'));
      d.hover(eye(d, 'gamma'));
      d.advance(HOVER_DELAY_MS);
      d.checkpoint('alpha asked again, gamma served from its cache', PREVIEW_DOM);
    },
  },
  {
    name: 'preview-spec-updated-closes-the-hovered-popin',
    run: (d) => {
      open(d);
      pinAndReceive(d, 'beta');
      const updated = { ...BETA, status: SpecStatus.InProgress };
      const cards = FULL_CARDS.map((existing) => (existing === BETA ? updated : existing));
      d.post({
        type: 'specUpdated',
        card: updated,
        stats: statsOf(cards),
        globalTaskStats: GLOBAL_TASK_STATS,
      });
      d.checkpoint('the pinned card was updated: popin closed', PREVIEW_DOM);
    },
  },
  {
    name: 'preview-placement-follows-the-anchor',
    run: (d) => {
      open(d);
      FULL_CARDS.filter((candidate) => undefined !== candidate.entryDocument).forEach(
        (candidate) => {
          hoverAndReceive(d, candidate.name);
          const panel = d.query('.card-hover-panel');
          d.note(
            `${candidate.name}: side=${panel.getAttribute('data-side')} ${panel.style.serialize()}`,
          );
          d.unhover(eye(d, candidate.name));
        },
      );
      d.checkpoint('popin geometry per card', '.card-hover-panel');
    },
  },
];
