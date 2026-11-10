import type { SpecChangeDelta } from '../core/model/ISpecChangeDelta';
import type { SpecDocumentKind } from '../core/model/SpecDocumentKind';
import type { ISpecFileSystem } from './ports/ISpecFileSystem';
import { BoundedCache } from '../core/BoundedCache';
import { documentFileName } from '../core/SpecDocumentFiles';
import { SPEC_DOCUMENT_KINDS } from '../core/model/SpecDocumentKind';
import { extractDocumentIntroduction } from '../core/parsing/DocumentIntroduction';

/** Maximum number of per-document introductions kept in the bounded cache. */
const INTRODUCTION_CACHE_CAPACITY = 128;
/**
 * Lazily load and cache the introduction of a spec's entry document.
 *
 * It reads through the injected {@link ISpecFileSystem} port (no `vscode`
 * import) and delegates the parsing to the pure {@link extractDocumentIntroduction}.
 * Introductions are loaded strictly on demand (at hover time) and memoised in a
 * {@link BoundedCache} keyed by the resolved FILE path, so a change of entry
 * document (new `.config.kiro`, added `bugfix.md`) can never serve another
 * document's text. {@link onSpecsChanged} drops stale entries when files change,
 * and a generation counter prevents a read started before an invalidation from
 * re-populating the cache with stale text. A document with no readable
 * introduction caches `undefined` so a second hover does not re-read the disk.
 */
export class SpecIntroductionLoader {
  private readonly fileSystem: ISpecFileSystem;
  private readonly cache: BoundedCache<string, string | undefined>;
  private generation = 0;
  /**
   * Build the loader over the file-system port.
   * @param fileSystem The `vscode`-free file-system port.
   * @param capacity Maximum number of cached introductions.
   */
  public constructor(fileSystem: ISpecFileSystem, capacity: number = INTRODUCTION_CACHE_CAPACITY) {
    this.fileSystem = fileSystem;
    this.cache = new BoundedCache<string, string | undefined>(capacity);
  }
  /**
   * Resolve the introduction of one document of a spec, caching the result.
   * @param folderPath Absolute path of the spec folder.
   * @param document The document kind to read (the spec's entry document).
   * @returns The introduction text, or `undefined` when none is available.
   */
  public async load(folderPath: string, document: SpecDocumentKind): Promise<string | undefined> {
    const filePath = this.fileSystem.join(folderPath, documentFileName(document));
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath);
    }
    const startedAt = this.generation;
    const content = await this.fileSystem.readFile(filePath);
    const introduction = extractDocumentIntroduction(content);
    if (startedAt === this.generation) {
      this.cache.set(filePath, introduction);
    }
    return introduction;
  }
  /**
   * Invalidate cached introductions after a repository change.
   * @param delta The change delta: one spec, or a full refresh.
   */
  public onSpecsChanged(delta: SpecChangeDelta): void {
    this.generation += 1;
    if ('fullRefresh' === delta.type) {
      this.cache.clear();
      return;
    }
    SPEC_DOCUMENT_KINDS.forEach((kind) =>
      this.cache.delete(this.fileSystem.join(delta.folderPath, documentFileName(kind))),
    );
  }
}
