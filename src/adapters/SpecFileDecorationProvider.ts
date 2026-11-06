import * as vscode from 'vscode';

import type { ISpecSnapshot } from '../core/model/ISpecSnapshot';
import type { SpecDecorationColor } from '../core/status/ISpecDecoration';
import type { SpecDecorationMapper } from '../core/status/SpecDecorationMapper';
import type { SpecStatsCalculator } from '../core/status/SpecStatsCalculator';
import type { SpecRepository } from './SpecRepository';

/** Path suffix identifying a specs root folder (`.kiro/specs`). */
const SPECS_ROOT_SUFFIX = `.kiro/specs`;

/** Badge shown on the specs root summary decoration. */
const SUMMARY_BADGE = 'K';

/** Map a decoration color key to a VS Code theme color id. */
const THEME_COLOR_IDS: Readonly<Record<SpecDecorationColor, string>> = {
  error: 'gitDecoration.deletedResourceForeground',
  muted: 'disabledForeground',
  warn: 'gitDecoration.modifiedResourceForeground',
  ok: 'gitDecoration.addedResourceForeground',
  okVivid: 'gitDecoration.untrackedResourceForeground',
};

/**
 * Explorer {@link vscode.FileDecorationProvider} badging each spec folder with
 * its status.
 *
 * The badge/color/tooltip derivation is delegated to the pure
 * {@link SpecDecorationMapper}; this adapter only resolves a URI to a cached
 * snapshot and translates the color key into a `vscode.ThemeColor`. It refreshes
 * decorations when the repository fires `onDidChangeSpecs`.
 */
export class SpecFileDecorationProvider implements vscode.FileDecorationProvider {
  private readonly repository: SpecRepository;

  private readonly mapper: SpecDecorationMapper;

  private readonly stats: SpecStatsCalculator;

  private readonly emitter: vscode.EventEmitter<vscode.Uri[]> = new vscode.EventEmitter<
    vscode.Uri[]
  >();

  private readonly disposeRepositoryListener: () => void;

  /** Event the explorer subscribes to for decoration refreshes. */
  public readonly onDidChangeFileDecorations: vscode.Event<vscode.Uri[]> = this.emitter.event;

  /**
   * Build the provider over the repository, the mapper and the stats calculator.
   * @param repository The spec repository supplying cached snapshots.
   * @param mapper The pure status-to-decoration mapper.
   * @param stats The pure aggregate-stats calculator for the root summary.
   */
  public constructor(
    repository: SpecRepository,
    mapper: SpecDecorationMapper,
    stats: SpecStatsCalculator,
  ) {
    this.repository = repository;
    this.mapper = mapper;
    this.stats = stats;
    this.disposeRepositoryListener = this.repository.onDidChangeSpecs(() => this.fireRefresh());
  }

  /**
   * Provide a decoration for a spec folder or the specs root, else `undefined`.
   * @param uri The resource URI the explorer is rendering.
   * @returns The decoration, or `undefined` when the URI is unrelated.
   */
  public provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    const snapshot = this.findSnapshot(uri);
    if (undefined !== snapshot) {
      const decoration = this.mapper.map(snapshot.status, snapshot.progress);
      return {
        badge: decoration.badge,
        tooltip: decoration.tooltip,
        color: new vscode.ThemeColor(THEME_COLOR_IDS[decoration.color]),
      };
    }
    return this.summaryDecoration(uri);
  }

  /**
   * Release the repository subscription and the emitter.
   */
  public dispose(): void {
    this.disposeRepositoryListener();
    this.emitter.dispose();
  }

  /**
   * Find the cached snapshot whose folder path matches a URI.
   * @param uri The resource URI.
   * @returns The matching snapshot, or `undefined`.
   */
  private findSnapshot(uri: vscode.Uri): ISpecSnapshot | undefined {
    return this.repository.getSpecs().find((snapshot) => snapshot.folderPath === uri.fsPath);
  }

  /**
   * Build the summary decoration for a `.kiro/specs/` root folder URI.
   * @param uri The resource URI.
   * @returns The summary decoration, or `undefined` when not a specs root.
   */
  private summaryDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    if (!uri.fsPath.endsWith(SPECS_ROOT_SUFFIX)) {
      return undefined;
    }
    const counts = this.stats.calculate(this.repository.getSpecs());
    const tooltip =
      `Kiro specs — ${counts.completed} completed, ${counts.inProgress} in progress, ` +
      `${counts.notStarted} not started, ${counts.malformed} malformed`;
    return { badge: SUMMARY_BADGE, tooltip };
  }

  /**
   * Fire a refresh for every known spec folder and its specs root.
   */
  private fireRefresh(): void {
    const specs = this.repository.getSpecs();
    const uris = specs.map((snapshot) => vscode.Uri.file(snapshot.folderPath));
    const roots = new Set(specs.map((snapshot) => SpecFileDecorationProvider.rootUri(snapshot)));
    this.emitter.fire([...uris, ...Array.from(roots).map((path) => vscode.Uri.file(path))]);
  }

  /**
   * Compute the specs-root folder path owning a snapshot.
   * @param snapshot The spec snapshot.
   * @returns The absolute path of the owning `.kiro/specs` folder.
   */
  private static rootUri(snapshot: ISpecSnapshot): string {
    const index = snapshot.folderPath.lastIndexOf(`/${snapshot.name}`);
    return 0 <= index ? snapshot.folderPath.slice(0, index) : snapshot.folderPath;
  }
}
