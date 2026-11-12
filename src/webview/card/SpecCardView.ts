import type { ISpecCardView } from '../../core/model/ISpecCardView';
import type { SpecDocumentKind } from '../../core/model/SpecDocumentKind';
import { SPEC_DOCUMENT_KINDS } from '../../core/model/SpecDocumentKind';
import { el } from '../createElement';
import type { IDashboardActions } from '../state/IDashboardActions';
import type { IViewText } from '../state/IViewText';
import { buildCardBreakdown } from './CardViewModel';
import { visibleDocumentKinds } from './visibleDocumentKinds';

/** Percentage multiplier for the required ratio. */
const PERCENT = 100;

/** Document links rendered per spec, in display order. */
const DOCUMENT_KINDS: readonly SpecDocumentKind[] = SPEC_DOCUMENT_KINDS;

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
export function appendCardProgress(
  article: HTMLElement,
  card: ISpecCardView,
  text: IViewText,
): void {
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
 * Render the document links for a spec: only present documents get a link.
 * @param card The spec card view.
 * @param actions The dashboard intents.
 * @returns The links container, or `undefined` when the spec has no document.
 */
export function renderLinks(
  card: ISpecCardView,
  actions: IDashboardActions,
): HTMLElement | undefined {
  const kinds = visibleDocumentKinds(card.documents, DOCUMENT_KINDS);
  if (0 === kinds.length) {
    return undefined;
  }
  const links = el('div', 'links');
  kinds.forEach((kind) => {
    const link = el('button', 'link', kind);
    link.setAttribute('type', 'button');
    link.addEventListener('click', (event) => {
      // Inner control: do not also trigger the card-body open gesture.
      event.stopPropagation();
      actions.post({
        type: 'openDocument',
        folderPath: card.folderPath,
        document: kind,
      });
    });
    links.appendChild(link);
  });
  return links;
}
