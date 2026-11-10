import { expect } from 'chai';
import { EntryDocumentResolver } from '../../src/core/EntryDocumentResolver';
import type { ISpecConfig } from '../../src/core/model/ISpecConfig';
import type { ISpecDocuments } from '../../src/core/model/ISpecDocuments';

const ALL: ISpecDocuments = {
  tasks: true,
  requirements: true,
  design: true,
  notes: true,
  bugfix: true,
};
const NONE: ISpecDocuments = {
  tasks: false,
  requirements: false,
  design: false,
  notes: false,
  bugfix: false,
};
/** Behaviour specification for {@link EntryDocumentResolver}. */
describe('EntryDocumentResolver', () => {
  const resolver = new EntryDocumentResolver();
  const cases: ReadonlyArray<readonly [ISpecConfig, string]> = [
    [{ workflowType: 'requirements-first', specType: 'feature' }, 'requirements'],
    [{ workflowType: 'design-first', specType: 'feature' }, 'design'],
    [{ workflowType: 'requirements-first', specType: 'bugfix' }, 'bugfix'],
    [{ workflowType: 'design-first', specType: 'bugfix' }, 'bugfix'],
    [{ specType: 'bugfix' }, 'bugfix'],
  ];
  cases.forEach(([config, expected]) => {
    it(`resolves ${JSON.stringify(config)} to ${expected}`, () => {
      expect(resolver.resolve(config, ALL)).to.equal(expected);
    });
  });
  it('falls back to requirements for an empty or unknown config', () => {
    expect(resolver.resolve({}, ALL)).to.equal('requirements');
    expect(resolver.resolve({ workflowType: 'x', specType: 'y' }, ALL)).to.equal('requirements');
  });
  it('falls back in order requirements, design, tasks', () => {
    expect(resolver.resolve({}, { ...ALL, requirements: false })).to.equal('design');
    expect(resolver.resolve({}, { ...NONE, tasks: true })).to.equal('tasks');
  });
  it('falls back when the rule document is absent on disk', () => {
    expect(resolver.resolve({ specType: 'bugfix' }, { ...ALL, bugfix: false })).to.equal(
      'requirements',
    );
    expect(resolver.resolve({ workflowType: 'design-first' }, { ...ALL, design: false })).to.equal(
      'requirements',
    );
  });
  it('returns undefined when nothing is available (notes/bugfix are not fallbacks)', () => {
    expect(resolver.resolve({}, NONE)).to.equal(undefined);
    expect(resolver.resolve({}, { ...NONE, notes: true, bugfix: true })).to.equal(undefined);
  });
  it('accepts injected rules (open for extension)', () => {
    const custom = new EntryDocumentResolver([{ matches: () => true, document: 'notes' }], []);
    expect(custom.resolve({}, ALL)).to.equal('notes');
  });
});
