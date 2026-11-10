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
  it('stores withdrawn keys separately and counts them as non-empty', () => {
    const registry = new OwnershipRegistry().withWithdrawn('/ws', 'files.exclude', ['a']);
    expect(registry.withdrawnFor('/ws', 'files.exclude')).to.deep.equal(['a']);
    expect(registry.keysFor('/ws', 'files.exclude')).to.deep.equal([]);
    expect(registry.isEmpty()).to.equal(false);
    expect(registry.workspaces()).to.deep.equal(['/ws']);
    expect(registry.withWithdrawn('/ws', 'files.exclude', []).isEmpty()).to.equal(true);
  });
  it('round-trips the versioned shape with owned and withdrawn keys', () => {
    const registry = new OwnershipRegistry()
      .with('/ws', 'files.exclude', ['a'])
      .withWithdrawn('/ws', 'files.exclude', ['b']);
    const back = OwnershipRegistry.fromJSON(JSON.parse(JSON.stringify(registry.toJSON())));
    expect(back.keysFor('/ws', 'files.exclude')).to.deep.equal(['a']);
    expect(back.withdrawnFor('/ws', 'files.exclude')).to.deep.equal(['b']);
  });
  it('reads the legacy shape (no withdrawn field) without error', () => {
    const legacy = { '/ws': { 'files.exclude': ['a'] } };
    const registry = OwnershipRegistry.fromJSON(legacy);
    expect(registry.keysFor('/ws', 'files.exclude')).to.deep.equal(['a']);
    expect(registry.withdrawnFor('/ws', 'files.exclude')).to.deep.equal([]);
    const partial = OwnershipRegistry.fromJSON({
      version: 2,
      owned: { '/ws': { 'files.exclude': ['a'] } },
    });
    expect(partial.keysFor('/ws', 'files.exclude')).to.deep.equal(['a']);
    expect(OwnershipRegistry.fromJSON({ version: 2, withdrawn: 4 }).isEmpty()).to.equal(true);
  });
});
