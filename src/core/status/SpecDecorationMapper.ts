import type { ISpecProgress } from '../model/ISpecProgress';
import type { ISpecDecoration, SpecDecorationColor } from './ISpecDecoration';
import { SpecStatus } from '../model/SpecStatus';

/** Percentage multiplier for the required ratio shown in the tooltip. */
const PERCENT = 100;

/** Badge + color pair for one status, matching the steering table. */
interface IStatusStyle {
  readonly badge: string;
  readonly color: SpecDecorationColor;
  readonly label: string;
}

/** Status-to-style table (badge ≤ 2 chars, theme color key, label). */
const STYLES: Readonly<Record<SpecStatus, IStatusStyle>> = {
  [SpecStatus.Malformed]: { badge: '!', color: 'error', label: 'Malformed' },
  [SpecStatus.NotStarted]: { badge: '○', color: 'muted', label: 'Not started' },
  [SpecStatus.InProgress]: { badge: '~', color: 'warn', label: 'In progress' },
  [SpecStatus.Completed]: { badge: '✓', color: 'ok', label: 'Completed' },
  [SpecStatus.FullyCompleted]: { badge: '✓', color: 'okVivid', label: 'Fully completed' },
};

/**
 * Format the required/optional counts into a compact progress string.
 * @param progress The computed progress.
 * @returns A string like `8/8 required (100%) · 2/3 optional`.
 */
function formatProgress(progress: ISpecProgress): string {
  const percent = Math.round(progress.requiredRatio * PERCENT);
  const required = `${progress.requiredDone}/${progress.requiredTotal} required (${percent}%)`;
  const optional = `${progress.optionalDone}/${progress.optionalTotal} optional`;
  return `${required} · ${optional}`;
}

/**
 * Pure mapper turning a spec status and progress into a `vscode`-free
 * {@link ISpecDecoration}.
 *
 * Keeping the badge/color/tooltip derivation out of the explorer adapter makes
 * it unit-testable and gate-covered; the adapter only translates the color key
 * into a `vscode.ThemeColor`.
 */
export class SpecDecorationMapper {
  /** Status-to-style table shared across calls. */
  private readonly styles: Readonly<Record<SpecStatus, IStatusStyle>> = STYLES;

  /**
   * Map a status and progress to a decoration descriptor.
   * @param status The resolved spec status.
   * @param progress The computed required/optional progress.
   * @returns The plain decoration descriptor.
   */
  public map(status: SpecStatus, progress: ISpecProgress): ISpecDecoration {
    const style = this.styles[status];
    return {
      badge: style.badge,
      color: style.color,
      tooltip: `${style.label} — ${formatProgress(progress)}`,
    };
  }
}
