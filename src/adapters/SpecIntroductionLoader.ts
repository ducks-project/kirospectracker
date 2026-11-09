import type { ISpecFileSystem } from './ports/ISpecFileSystem';
import { BoundedCache } from '../core/BoundedCache';
import { documentFileName } from '../core/SpecDocumentFiles';
import { extractRequirementsIntroduction } from '../core/parsing/RequirementsIntroduction';

/** Maximum number of per-spec introductions kept in the bounded cache. */
const INTRODUCTION_CACHE_CAPACITY = 128;

/**
 * Lazily load and cache the introduction of a spec's `requirements.md`.
 *
 * It reads through the injected {@link ISpecFileSystem} port (no `vscode`
 * import) and delegates the parsing to the pure
 * {@link extractRequirementsIntroduction}. Introductions are loaded strictly on
 * demand (at hover time) and memoised in a {@link BoundedCache}, so a
 * large-workspace scan never pre-reads every `requirements.md` and the cache
 * cannot grow unbounded. A spec with no readable introduction caches `undefined`
 * so a second hover does not re-read the disk.
 */
export class SpecIntroductionLoader {
  private readonly fileSystem: ISpecFileSystem;

  private readonly cache: BoundedCache<string, string | undefined>;

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
   * Resolve the introduction of a spec's `requirements.md`, caching the result.
   * @param folderPath Absolute path of the spec folder.
   * @returns The introduction text, or `undefined` when none is available.
   */
  public async load(folderPath: string): Promise<string | undefined> {
    if (this.cache.has(folderPath)) {
      return this.cache.get(folderPath);
    }
    const filePath = this.fileSystem.join(folderPath, documentFileName('requirements'));
    const content = await this.fileSystem.readFile(filePath);
    const introduction = extractRequirementsIntroduction(content);
    this.cache.set(folderPath, introduction);
    return introduction;
  }
}
