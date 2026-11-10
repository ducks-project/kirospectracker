import { expect } from 'chai';
import { EMPTY_SPEC_CONFIG } from '../../src/core/parsing/SpecConfigParser';
import { KiroSpecConfigReader } from '../../src/adapters/config/KiroSpecConfigReader';
import { NullSpecConfigReader } from '../../src/adapters/config/NullSpecConfigReader';
import { FakeSpecFileSystem } from '../helpers/fake-spec-file-system';
/** Behaviour specification for the spec-config reader adapters. */
describe('spec config readers', () => {
  const folder = '/ws/.kiro/specs/alpha';
  /** Build a fake file system seeded with the given config text. */
  function build(content: string | undefined): FakeSpecFileSystem {
    const files = new Map<string, string>();
    if (undefined !== content) {
      files.set(`${folder}/.config.kiro`, content);
    }
    return new FakeSpecFileSystem(['/ws'], files, new Set());
  }
  it('reads and parses .config.kiro', async () => {
    const reader = new KiroSpecConfigReader(build('{"workflowType":"design-first"}'));
    expect((await reader.read(folder)).workflowType).to.equal('design-first');
  });
  it('resolves an empty config when absent or malformed', async () => {
    expect(await new KiroSpecConfigReader(build(undefined)).read(folder)).to.deep.equal(
      EMPTY_SPEC_CONFIG,
    );
    expect(await new KiroSpecConfigReader(build('{oops')).read(folder)).to.deep.equal(
      EMPTY_SPEC_CONFIG,
    );
  });
  it('Null Object always resolves an empty config', async () => {
    expect(await new NullSpecConfigReader().read()).to.deep.equal(EMPTY_SPEC_CONFIG);
  });
});
