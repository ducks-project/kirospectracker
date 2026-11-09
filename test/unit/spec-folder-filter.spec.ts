import { expect } from 'chai';

import { SpecFolderFilter } from '../../src/core/status/SpecFolderFilter';

/**
 * Behaviour specification for {@link SpecFolderFilter}.
 *
 * These cases mirror the status-filter contract: the additive, multi-select
 * toggle set and the inclusive matching rule (empty filter shows every folder;
 * otherwise a folder is visible when its key is active), keyed on a stable
 * folder identity (the workspace path) rather than a display basename.
 */
describe('SpecFolderFilter', () => {
  it('shows every folder when no key is active', () => {
    const filter = new SpecFolderFilter();
    expect(filter.isEmpty()).to.equal(true);
    expect(filter.matches('/ws/one')).to.equal(true);
    expect(filter.matches('/ws/two')).to.equal(true);
  });

  it('activates a key on first toggle and narrows to it', () => {
    const filter = new SpecFolderFilter().toggle('/ws/one');
    expect(filter.isActive('/ws/one')).to.equal(true);
    expect(filter.matches('/ws/one')).to.equal(true);
    expect(filter.matches('/ws/two')).to.equal(false);
  });

  it('is additive across multiple keys', () => {
    const filter = new SpecFolderFilter().toggle('/ws/one').toggle('/ws/two');
    expect(filter.matches('/ws/one')).to.equal(true);
    expect(filter.matches('/ws/two')).to.equal(true);
    expect(filter.matches('/ws/three')).to.equal(false);
  });

  it('distinguishes two folders sharing a basename by their stable key', () => {
    const filter = new SpecFolderFilter().toggle('/a/project');
    expect(filter.matches('/a/project')).to.equal(true);
    expect(filter.matches('/b/project')).to.equal(false);
  });

  it('removes a key when toggled again', () => {
    const filter = new SpecFolderFilter().toggle('/ws/one').toggle('/ws/one');
    expect(filter.isActive('/ws/one')).to.equal(false);
    expect(filter.isEmpty()).to.equal(true);
  });

  it('is immutable: a toggle returns a new instance and leaves the original intact', () => {
    const base = new SpecFolderFilter();
    const next = base.toggle('/ws/one');
    expect(base.isActive('/ws/one')).to.equal(false);
    expect(next.isActive('/ws/one')).to.equal(true);
    expect(next).to.not.equal(base);
  });

  it('round-trips through toArray', () => {
    const filter = new SpecFolderFilter().toggle('/ws/one').toggle('/ws/two');
    const restored = new SpecFolderFilter(filter.toArray());
    expect(restored.isActive('/ws/one')).to.equal(true);
    expect(restored.isActive('/ws/two')).to.equal(true);
    expect(restored.isActive('/ws/three')).to.equal(false);
  });

  it('drops invalid keys when restored from unknown persisted state', () => {
    const filter = SpecFolderFilter.fromUnknown(['/ws/one', '', 42, null, undefined, '/ws/two']);
    expect(filter.isActive('/ws/one')).to.equal(true);
    expect(filter.isActive('/ws/two')).to.equal(true);
    expect(filter.toArray()).to.have.length(2);
  });
});
