import type { ISpecCardView } from '../../core/model/ISpecCardView';
import type { SpecDocumentKind } from '../../core/model/SpecDocumentKind';
import { SPEC_DOCUMENT_KINDS } from '../../core/model/SpecDocumentKind';
import { buttonEl, el, onInnerClick, setToggleState } from '../createElement';
import type { IDashboardActions } from '../state/IDashboardActions';
import type { IViewText } from '../state/IViewText';
import type { DashboardStore } from '../state/DashboardStore';
import { buildBadgeModel, buildCardBreakdown, buildOwnerModel } from './CardViewModel';
import { renderActions } from './RunTasksMenu';
import { visibleDocumentKinds } from './visibleDocumentKinds';
import { ACTIVATION_KEYS } from '../activationKeys';

/** Dependencies a card render needs. */
export interface ICardDeps {
  /** Render state (read at render time for the pressed filters). */
  readonly store: DashboardStore;
  /** The webview translation surface. */
  readonly text: IViewText;
  /** The dashboard intents. */
  readonly actions: IDashboardActions;
  /** Factory of a card's preview eye button, `undefined` without an entry document. */
  readonly renderPreviewIcon: (card: ISpecCardView) => HTMLElement | undefined;
}

/** Percentage multiplier for the required ratio. */
const PERCENT = 100;

/**
 * Render one progress bar.
 * @param label Translated row text, including the counts.
 * @param ratio Completion ratio in [0, 1].
 * @returns The progress row element.
 */
function renderProgress(label: string, ratio: number): HTMLElement {
  const row = el('div', 'progress');
  row.appendChild(el('span', 'progress-label', label));
  const track = el('div', 'progress-track');
  const fill = el('div', 'progress-fill');
  fill.style.width = `${Math.round(ratio * PERCENT)}%`;
  track.appendChild(fill);
  row.appendChild(track);
  return row;
}

/**
 * Render the per-state task breakdown of a card.
 *
 * Zero-count states are omitted to keep the row compact; each shown state wears
 * its own class so the stylesheet renders done normally, cancelled dimmed and
 * struck through, and in-progress in a subtle style. The whole row is hidden
 * when the spec has no leaf task.
 * @param card The spec card view.
 * @param text The webview translation surface.
 * @returns The breakdown row, or `undefined` when there is nothing to show.
 */
function renderCardBreakdown(card: ISpecCardView, text: IViewText): HTMLElement | undefined {
  const items = buildCardBreakdown(card, text);
  if (0 === items.length) {
    return undefined;
  }
  const row = el('div', 'task-states');
  items.forEach((item) => row.appendChild(el('span', `task-state ${item.cssClass}`, item.text)));
  return row;
}

/**
 * Append the required/optional progress bars and the per-state breakdown row to
 * a card.
 * @param article The card element to populate.
 * @param card The spec card view.
 * @param text The webview translation surface.
 */
function appendCardProgress(article: HTMLElement, card: ISpecCardView, text: IViewText): void {
  const { progress } = card;
  article.appendChild(
    renderProgress(
      text.t('Required: {0}/{1}', progress.requiredDone, progress.requiredTotal),
      progress.requiredRatio,
    ),
  );
  article.appendChild(
    renderProgress(
      text.t('Optional: {0}/{1}', progress.optionalDone, progress.optionalTotal),
      progress.optionalRatio,
    ),
  );
  const breakdown = renderCardBreakdown(card, text);
  if (undefined !== breakdown) {
    article.appendChild(breakdown);
  }
}

/**
 * Open a spec's resolved entry document through the existing openDocument intent.
 * @param card The spec card view (with a resolved entry document).
 * @param entry The entry document to open.
 * @param actions The dashboard intents.
 */
function openCardEntry(
  card: ISpecCardView,
  entry: SpecDocumentKind,
  actions: IDashboardActions,
): void {
  actions.post({
    type: 'openDocument',
    folderPath: card.folderPath,
    document: entry,
  });
}

/**
 * Render the document links for a spec: only present documents get a link.
 * @param card The spec card view.
 * @param actions The dashboard intents.
 * @returns The links container, or `undefined` when the spec has no document.
 */
function renderLinks(card: ISpecCardView, actions: IDashboardActions): HTMLElement | undefined {
  const kinds = visibleDocumentKinds(card.documents, SPEC_DOCUMENT_KINDS);
  if (0 === kinds.length) {
    return undefined;
  }
  const links = el('div', 'links');
  kinds.forEach((kind) => {
    const link = buttonEl('link', kind);
    onInnerClick(link, () => openCardEntry(card, kind, actions));
    links.appendChild(link);
  });
  return links;
}

/**
 * Render the clickable status badge for a spec.
 *
 * The badge is a real button toggling the status filter for its status, exactly
 * as the matching toolbar stat toggle does (both call `toggleStatusFilter`
 * over the same {@link SpecStatusFilter}, so they stay in sync). Its color class
 * comes from the shared {@link colorTokenForStatus} mapping, and `aria-pressed`
 * reflects whether that status filter is currently active.
 * @param card The spec card view.
 * @param deps The card dependencies.
 * @returns The badge button element.
 */
function renderStatusBadge(card: ISpecCardView, deps: ICardDeps): HTMLElement {
  const model = buildBadgeModel(card, deps.store.filter, deps.text);
  const badge = buttonEl(model.cssClass, model.label);
  setToggleState(badge, model.pressed, model.ariaLabel);
  onInnerClick(badge, () => deps.actions.toggleStatusFilter(model.key));
  return badge;
}

/**
 * Make the card body a keyboard-accessible button opening the spec's entry
 * document (resolved on the host from `.config.kiro`, with a fallback).
 *
 * Only the card background is the open gesture: inner controls (document links,
 * run button, status badge) stop click propagation, so a click on them never
 * also opens the card. When no entry document exists the card-body open is a
 * disabled no-op (no role, no tabstop, no handler). The actual open reuses the
 * existing openDocument postMessage path.
 * @param article The card element.
 * @param card The spec card view.
 * @param deps The card dependencies.
 */
function wireCardBody(article: HTMLElement, card: ISpecCardView, deps: ICardDeps): void {
  const entry = card.entryDocument;
  if (undefined === entry) {
    article.classList.add('card-disabled');
    return;
  }
  article.classList.add('card-clickable');
  article.setAttribute('role', 'button');
  article.setAttribute('tabindex', '0');
  article.setAttribute('aria-label', deps.text.t('Open {0} for {1}', entry, card.name));
  article.addEventListener('click', () => openCardEntry(card, entry, deps.actions));
  article.addEventListener('keydown', (event) => {
    if (!ACTIVATION_KEYS.has(event.key)) {
      return;
    }
    // Prevent the space key from scrolling and activate the open gesture.
    event.preventDefault();
    openCardEntry(card, entry, deps.actions);
  });
}

/**
 * Render the owning-folder label of a card as a clickable toggle button.
 *
 * Clicking it toggles that folder in the shared `SpecFolderFilter`, so it
 * stays in sync with the search-box folder menu. It keeps its discreet styling,
 * is an accessible button (`aria-pressed` reflecting whether that folder filter
 * is active), and stops click propagation so it never also triggers the
 * card-body open gesture (consistent with the status badge and the other inner
 * controls).
 * @param card The spec card view.
 * @param deps The card dependencies.
 * @returns The owner-label button element.
 */
function renderOwnerLabel(card: ISpecCardView, deps: ICardDeps): HTMLElement {
  const model = buildOwnerModel(card, deps.store.folderFilter, deps.text);
  const owner = buttonEl('card-owner', card.ownerLabel);
  setToggleState(owner, model.pressed, model.ariaLabel);
  onInnerClick(owner, () => deps.actions.toggleFolderFilter(card.folderKey));
  return owner;
}

/**
 * Render one spec card.
 * @param card The spec card view.
 * @param deps The card dependencies.
 * @returns The card element.
 */
export function renderCard(card: ISpecCardView, deps: ICardDeps): HTMLElement {
  const article = el('article', `card status-${card.status}`);
  const header = el('div', 'card-header');
  const heading = el('div', 'card-heading');
  heading.appendChild(el('h2', 'card-title', card.name));
  const preview = deps.renderPreviewIcon(card);
  if (undefined !== preview) {
    heading.appendChild(preview);
  }
  header.appendChild(heading);
  header.appendChild(renderStatusBadge(card, deps));
  article.appendChild(header);
  article.appendChild(renderOwnerLabel(card, deps));
  appendCardProgress(article, card, deps.text);
  const links = renderLinks(card, deps.actions);
  if (undefined !== links) {
    article.appendChild(links);
  }
  article.appendChild(renderActions(card, deps.text, deps.actions));
  wireCardBody(article, card, deps);
  return article;
}
