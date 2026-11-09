import { expect } from 'chai';

import type { ISpecFileSystem } from '../../src/adapters/ports/ISpecFileSystem';
import { SpecIntroductionLoader } from '../../src/adapters/SpecIntroductionLoader';

/** Path separator used by the counting fake file system. */
const SEPARATOR = '/';

/**
 * Minimal counting fake implementing {@link ISpecFileSystem}, recording how many
 * times each path is read so cache behaviour can be asserted.
 */
class CountingFileSystem implements ISpecFileSystem {
  public readonly readCounts: Map<string, number> = new Map();

  private readonly files: Map<string, string>;

  public constructor(files: Map<string, string>) {
    this.files = files;
  }

  // eslint-disable-next-line class-methods-use-this
  public workspaceFolders(): readonly string[] {
    return [];
  }

  // eslint-disable-next-line class-methods-use-this
  public async listDirectories(): Promise<readonly string[]> {
    return [];
  }

  public async readFile(filePath: string): Promise<string | undefined> {
    this.readCounts.set(filePath, (this.readCounts.get(filePath) ?? 0) + 1);
    return this.files.get(filePath);
  }

  // eslint-disable-next-line class-methods-use-this
  public join(...segments: string[]): string {
    return segments.join(SEPARATOR);
  }
}

/**
 * Behaviour specification for {@link SpecIntroductionLoader}.
 */
describe('SpecIntroductionLoader', () => {
  const folderPath = '/ws/.kiro/specs/alpha';
  const requirementsPath = `${folderPath}/requirements.md`;

  it('loads and parses the requirements introduction through the port', async () => {
    const files = new Map([[requirementsPath, '# Title\n\n## Introduction\n\nThe intro.\n']]);
    const loader = new SpecIntroductionLoader(new CountingFileSystem(files));
    expect(await loader.load(folderPath)).to.equal('The intro.');
  });

  it('caches the result so a second hover does not re-read the disk', async () => {
    const files = new Map([[requirementsPath, '# Title\n\nA blurb.\n']]);
    const fileSystem = new CountingFileSystem(files);
    const loader = new SpecIntroductionLoader(fileSystem);
    await loader.load(folderPath);
    await loader.load(folderPath);
    expect(fileSystem.readCounts.get(requirementsPath)).to.equal(1);
  });

  it('caches an undefined introduction so an absent file is read only once', async () => {
    const fileSystem = new CountingFileSystem(new Map());
    const loader = new SpecIntroductionLoader(fileSystem);
    expect(await loader.load(folderPath)).to.equal(undefined);
    expect(await loader.load(folderPath)).to.equal(undefined);
    expect(fileSystem.readCounts.get(requirementsPath)).to.equal(1);
  });

  it('re-reads once a bounded capacity has evicted the cached entry', async () => {
    const otherFolder = '/ws/.kiro/specs/beta';
    const files = new Map([
      [requirementsPath, '# A\n\nAlpha intro.\n'],
      [`${otherFolder}/requirements.md`, '# B\n\nBeta intro.\n'],
    ]);
    const fileSystem = new CountingFileSystem(files);
    const loader = new SpecIntroductionLoader(fileSystem, 1);
    await loader.load(folderPath);
    await loader.load(otherFolder);
    await loader.load(folderPath);
    expect(fileSystem.readCounts.get(requirementsPath)).to.equal(2);
  });
});
