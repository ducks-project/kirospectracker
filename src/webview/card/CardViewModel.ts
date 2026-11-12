import type { ISpecCardView } from '../../core/model/ISpecCardView';
import type { SpecFilterKey } from '../../core/model/SpecFilterKey';
import { statusToFilterKey } from '../../core/model/SpecFilterKey';
import { statusLabel } from '../../core/status/SpecStatusLabel';
import { colorTokenForStatus } from '../../core/status/SpecStatusColor';
import type { SpecFolderFilter } from '../../core/status/SpecFolderFilter';
import type { SpecStatusFilter } from '../../core/status/SpecStatusFilter';
import type { IViewText } from '../state/IViewText';

/** One per-state count shown in a card's breakdown row. */
export interface ICardBreakdownItem {
  /** The per-state class driving its theme-aware look. */
  readonly cssClass: string;
  /** The translated text, including the count. */
  readonly text: string;
}

/** Display model of a card's clickable status badge. */
export interface ICardBadgeModel {
  /** The status filter key the badge toggles. */
  readonly key: SpecFilterKey;
  /** Whether that status filter is currently active. */
  readonly pressed: boolean;
  /** The translated status label. */
  readonly label: string;
  /** The translated accessible label (also used as tooltip). */
  readonly ariaLabel: string;
  /** The class list of the badge button. */
  readonly cssClass: string;
}

/** Display model of a card's clickable owning-folder label. */
export interface ICardOwnerModel {
  /** Whether that folder filter is currently active. */
  readonly pressed: boolean;
  /** The translated accessible label (also used as tooltip). */
  readonly ariaLabel: string;
}

/**
 * Build the per-state breakdown of a card.
 *
 * It sums the required and optional per-state counts from the card's progress
 * and keeps done, cancelled and in-progress when non-zero (to-do is implied by
 * the progress bar and omitted to stay compact).
 * @param card The spec card view.
 * @param text The webview translation surface.
 * @returns The non-zero items in display order; empty when there is nothing to show.
 */
export function buildCardBreakdown(
  card: ISpecCardView,
  text: IViewText,
): readonly ICardBreakdownItem[] {
  const { progress } = card;
  const done = progress.requiredResolvedDone + progress.optionalResolvedDone;
  const cancelled = progress.requiredResolvedCancelled + progress.optionalResolvedCancelled;
  const inProgress = progress.requiredInProgress + progress.optionalInProgress;
  const items: ICardBreakdownItem[] = [
    { cssClass: 'task-state-done', text: text.tp('{0} done|{0} done', done) },
    { cssClass: 'task-state-cancelled', text: text.tp('{0} cancelled|{0} cancelled', cancelled) },
    { cssClass: 'task-state-inProgress', text: text.t('{0} in progress', inProgress) },
  ];
  const counts = [done, cancelled, inProgress];
  return items.filter((_item, index) => 0 !== counts[index]);
}

/**
 * Build the display model of a card's status badge.
 * @param card The spec card view.
 * @param filter The active status filter.
 * @param text The webview translation surface.
 * @returns The badge model.
 */
export function buildBadgeModel(
  card: ISpecCardView,
  filter: SpecStatusFilter,
  text: IViewText,
): ICardBadgeModel {
  const key = statusToFilterKey(card.status);
  const label = statusLabel(card.status, text.translator);
  return {
    key,
    pressed: filter.isActive(key),
    label,
    ariaLabel: text.t('Filter by {0} status', label),
    cssClass: `card-status badge ${colorTokenForStatus(card.status)}`,
  };
}

/**
 * Build the display model of a card's owning-folder label.
 * @param card The spec card view.
 * @param folderFilter The active folder filter.
 * @param text The webview translation surface.
 * @returns The owner-label model.
 */
export function buildOwnerModel(
  card: ISpecCardView,
  folderFilter: SpecFolderFilter,
  text: IViewText,
): ICardOwnerModel {
  return {
    pressed: folderFilter.isActive(card.folderKey),
    ariaLabel: text.t('Filter by {0} folder', card.ownerLabel),
  };
}
