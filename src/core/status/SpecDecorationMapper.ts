import type { ISpecProgress } from '../model/ISpecProgress';
import type { ITranslator } from '../ports/ITranslator';
import { IDENTITY_TRANSLATOR } from '../i18n/IdentityTranslator';
import { statusLabel } from './SpecStatusLabel';
import type { ISpecDecoration, SpecDecorationColor } from './ISpecDecoration';
import { SpecStatus } from '../model/SpecStatus';

/** Percentage multiplier for the required ratio shown in the tooltip. */
const PERCENT = 100;

/** Badge + color pair for one status, matching the steering table. */
interface IStatusStyle {
  readonly badge: string;
  readonly color: SpecDecorationColor;
}

/** Status-to-style table (badge ≤ 2 chars, theme color key). */
const STYLES: Readonly<Record<SpecStatus, IStatusStyle>> = {
  [SpecStatus.Malformed]: { badge: '!', color: 'error' },
  [SpecStatus.NotStarted]: { badge: '○', color: 'muted' },
  [SpecStatus.InProgress]: { badge: '~', color: 'warn' },
  [SpecStatus.Completed]: { badge: '✓', color: 'ok' },
  [SpecStatus.FullyCompleted]: { badge: '✓', color: 'okVivid' },
};

/**
 * Format the required/optional counts into a compact progress string.
 * @param progress The computed progress.
 * @param translator The translator rendering the whole template.
 * @returns A string like `8/8 required (100%) · 2/3 optional`.
 */
function formatProgress(progress: ISpecProgress, translator: ITranslator): string {
  return translator.t(
    '{0}/{1} required ({2}%) · {3}/{4} optional',
    progress.requiredDone,
    progress.requiredTotal,
    Math.round(progress.requiredRatio * PERCENT),
    progress.optionalDone,
    progress.optionalTotal,
  );
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
  private readonly translator: ITranslator;
  /**
   * Build the mapper.
   * @param translator The translator for the tooltip text (English by default).
   */
  public constructor(translator: ITranslator = IDENTITY_TRANSLATOR) {
    this.translator = translator;
  }

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
      tooltip: this.translator.t(
        '{0} — {1}',
        statusLabel(status, this.translator),
        formatProgress(progress, this.translator),
      ),
    };
  }
}
