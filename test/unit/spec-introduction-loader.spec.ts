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
    expect(await loader.load(folderPath, 'requirements')).to.equal('The intro.');
  });

  it('caches the result so a second hover does not re-read the disk', async () => {
    const files = new Map([[requirementsPath, '# Title\n\nA blurb.\n']]);
    const fileSystem = new CountingFileSystem(files);
    const loader = new SpecIntroductionLoader(fileSystem);
    await loader.load(folderPath, 'requirements');
    await loader.load(folderPath, 'requirements');
    expect(fileSystem.readCounts.get(requirementsPath)).to.equal(1);
  });

  it('caches an undefined introduction so an absent file is read only once', async () => {
    const fileSystem = new CountingFileSystem(new Map());
    const loader = new SpecIntroductionLoader(fileSystem);
    expect(await loader.load(folderPath, 'requirements')).to.equal(undefined);
    expect(await loader.load(folderPath, 'requirements')).to.equal(undefined);
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
    await loader.load(folderPath, 'requirements');
    await loader.load(otherFolder, 'requirements');
    await loader.load(folderPath, 'requirements');
    expect(fileSystem.readCounts.get(requirementsPath)).to.equal(2);
  });
  it('reads the document of the requested kind and caches per file', async () => {
    const designPath = `${folderPath}/design.md`;
    const bugfixPath = `${folderPath}/bugfix.md`;
    const files = new Map([
      [requirementsPath, '# R\n\n## Introduction\n\nReq intro.\n'],
      [designPath, '# D\n\n## Overview\n\nDesign overview.\n'],
      [bugfixPath, '# B\n\n## Introduction\n\nBug intro.\n'],
    ]);
    const fileSystem = new CountingFileSystem(files);
    const loader = new SpecIntroductionLoader(fileSystem);
    expect(await loader.load(folderPath, 'design')).to.equal('Design overview.');
    expect(await loader.load(folderPath, 'bugfix')).to.equal('Bug intro.');
    expect(await loader.load(folderPath, 'requirements')).to.equal('Req intro.');
    await loader.load(folderPath, 'design');
    expect(fileSystem.readCounts.get(designPath)).to.equal(1);
  });
  it('drops the folder entries on a specChanged delta', async () => {
    const files = new Map([[requirementsPath, '# T\n\nOld.\n']]);
    const fileSystem = new CountingFileSystem(files);
    const loader = new SpecIntroductionLoader(fileSystem);
    await loader.load(folderPath, 'requirements');
    files.set(requirementsPath, '# T\n\nNew.\n');
    loader.onSpecsChanged({ type: 'specChanged', folderPath });
    expect(await loader.load(folderPath, 'requirements')).to.equal('New.');
  });
  it('keeps other folders on a specChanged delta but clears all on fullRefresh', async () => {
    const otherFolder = '/ws/.kiro/specs/beta';
    const files = new Map([
      [requirementsPath, '# T\n\nA.\n'],
      [`${otherFolder}/requirements.md`, '# T\n\nB.\n'],
    ]);
    const fileSystem = new CountingFileSystem(files);
    const loader = new SpecIntroductionLoader(fileSystem);
    await loader.load(folderPath, 'requirements');
    await loader.load(otherFolder, 'requirements');
    loader.onSpecsChanged({ type: 'specChanged', folderPath });
    await loader.load(otherFolder, 'requirements');
    expect(fileSystem.readCounts.get(`${otherFolder}/requirements.md`)).to.equal(1);
    loader.onSpecsChanged({ type: 'fullRefresh' });
    await loader.load(otherFolder, 'requirements');
    expect(fileSystem.readCounts.get(`${otherFolder}/requirements.md`)).to.equal(2);
  });
  it('does not cache a read that started before an invalidation', async () => {
    const files = new Map([[requirementsPath, '# T\n\nStale.\n']]);
    const fileSystem = new CountingFileSystem(files);
    const loader = new SpecIntroductionLoader(fileSystem);
    const pending = loader.load(folderPath, 'requirements');
    loader.onSpecsChanged({ type: 'specChanged', folderPath });
    await pending;
    files.set(requirementsPath, '# T\n\nFresh.\n');
    expect(await loader.load(folderPath, 'requirements')).to.equal('Fresh.');
  });
});
