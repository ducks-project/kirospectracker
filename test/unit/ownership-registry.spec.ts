import { expect } from 'chai';
import { OwnershipRegistry } from '../../src/core/hiding/OwnershipRegistry';

describe('OwnershipRegistry', () => {
  it('starts empty', () => {
    const registry = new OwnershipRegistry();
    expect(registry.isEmpty()).to.equal(true);
    expect(registry.keysFor('/ws', 'files.exclude')).to.deep.equal([]);
  });

  it('stores keys per workspace and setting, immutably', () => {
    const base = new OwnershipRegistry();
    const next = base.with('/ws', 'files.exclude', ['a']).with('/ws', 'search.exclude', ['b']);
    expect(base.isEmpty()).to.equal(true);
    expect(next.keysFor('/ws', 'files.exclude')).to.deep.equal(['a']);
    expect(next.keysFor('/ws', 'search.exclude')).to.deep.equal(['b']);
    expect(next.workspaces()).to.deep.equal(['/ws']);
  });

  it('drops empty entries and empty workspaces', () => {
    const registry = new OwnershipRegistry()
      .with('/ws', 'files.exclude', ['a'])
      .with('/ws', 'files.exclude', []);
    expect(registry.isEmpty()).to.equal(true);
  });

  it('round-trips through JSON and sanitises corrupt data', () => {
    const registry = new OwnershipRegistry().with('/ws', 'files.exclude', ['a']);
    expect(
      OwnershipRegistry.fromJSON(registry.toJSON()).keysFor('/ws', 'files.exclude'),
    ).to.deep.equal(['a']);
    [undefined, null, 3, 'x', [], { '/ws': 4 }, { '/ws': { 'files.exclude': [1, null] } }].forEach(
      (raw) => {
        expect(OwnershipRegistry.fromJSON(raw).isEmpty()).to.equal(true);
      },
    );
    const mixed = OwnershipRegistry.fromJSON({ '/ws': { 'files.exclude': ['a', 2] } });
    expect(mixed.keysFor('/ws', 'files.exclude')).to.deep.equal(['a']);
  });
});
