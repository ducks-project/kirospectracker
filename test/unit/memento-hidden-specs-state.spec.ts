import { expect } from 'chai';
import { OwnershipRegistry } from '../../src/core/hiding/OwnershipRegistry';
import {
  MementoHiddenSpecsState,
  NOTICE_STATE_KEY,
  OWNERSHIP_STATE_KEY,
} from '../../src/adapters/MementoHiddenSpecsState';
import { MapState } from '../helpers/map-state';

describe('MementoHiddenSpecsState', () => {
  it('persists and reloads the ownership registry', async () => {
    const backing = new MapState();
    const state = new MementoHiddenSpecsState(backing);
    await state.save(new OwnershipRegistry().with('/ws', 'files.exclude', ['a']));
    expect(
      new MementoHiddenSpecsState(backing).load().keysFor('/ws', 'files.exclude'),
    ).to.deep.equal(['a']);
  });

  it('clears the stored key when the registry is empty', async () => {
    const backing = new MapState();
    const state = new MementoHiddenSpecsState(backing);
    await state.save(new OwnershipRegistry().with('/ws', 'files.exclude', ['a']));
    await state.save(new OwnershipRegistry());
    expect(backing.values.has(OWNERSHIP_STATE_KEY)).to.equal(false);
  });

  it('persists withdrawn keys and loads a legacy record without them', async () => {
    const backing = new MapState();
    const state = new MementoHiddenSpecsState(backing);
    await state.save(new OwnershipRegistry().withWithdrawn('/ws', 'files.exclude', ['w']));
    expect(state.load().withdrawnFor('/ws', 'files.exclude')).to.deep.equal(['w']);
    backing.values.set(OWNERSHIP_STATE_KEY, { '/ws': { 'files.exclude': ['a'] } });
    const legacy = state.load();
    expect(legacy.keysFor('/ws', 'files.exclude')).to.deep.equal(['a']);
    expect(legacy.withdrawnFor('/ws', 'files.exclude')).to.deep.equal([]);
  });
  it('remembers the notice was shown', async () => {
    const backing = new MapState();
    const state = new MementoHiddenSpecsState(backing);
    expect(state.wasShown()).to.equal(false);
    await state.markShown();
    expect(state.wasShown()).to.equal(true);
    expect(backing.values.get(NOTICE_STATE_KEY)).to.equal(true);
  });
});
