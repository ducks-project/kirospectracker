import { expect } from 'chai';
import { HideSpecsMode, HideSpecsModeMapper } from '../../src/core/hiding/HideSpecsMode';
import {
  DEFAULT_HIDDEN_STATUSES,
  HiddenStatusSelection,
} from '../../src/core/hiding/HiddenStatusSelection';
import { SpecStatus } from '../../src/core/model/SpecStatus';

describe('HideSpecsModeMapper', () => {
  const mapper = new HideSpecsModeMapper();

  it('parses every known mode and falls back to off', () => {
    expect(mapper.parse('searchAndQuickOpen')).to.equal(HideSpecsMode.SearchAndQuickOpen);
    expect(mapper.parse('everywhere')).to.equal(HideSpecsMode.Everywhere);
    expect(mapper.parse('off')).to.equal(HideSpecsMode.Off);
    expect(mapper.parse('nope')).to.equal(HideSpecsMode.Off);
    expect(mapper.parse(undefined)).to.equal(HideSpecsMode.Off);
  });

  it('maps each mode to its exclusion setting', () => {
    expect(mapper.settingFor(HideSpecsMode.Off)).to.equal(undefined);
    expect(mapper.settingFor(HideSpecsMode.SearchAndQuickOpen)).to.equal('search.exclude');
    expect(mapper.settingFor(HideSpecsMode.Everywhere)).to.equal('files.exclude');
  });
});

describe('HiddenStatusSelection', () => {
  const selection = new HiddenStatusSelection();

  it('defaults to Completed and FullyCompleted', () => {
    expect([...DEFAULT_HIDDEN_STATUSES].sort()).to.deep.equal(['Completed', 'FullyCompleted']);
    [undefined, null, 'x', [], {}].forEach((raw) => {
      expect([...selection.parse(raw)].sort()).to.deep.equal(['Completed', 'FullyCompleted']);
    });
  });

  it('honors explicit booleans and ignores non-boolean entries', () => {
    const parsed = selection.parse({ Completed: false, InProgress: true, NotStarted: 'yes' });
    expect(parsed.has(SpecStatus.Completed)).to.equal(false);
    expect(parsed.has(SpecStatus.InProgress)).to.equal(true);
    expect(parsed.has(SpecStatus.NotStarted)).to.equal(false);
    expect(parsed.has(SpecStatus.FullyCompleted)).to.equal(true);
  });
});
