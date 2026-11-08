import { expect } from 'chai';

import { AgentBetaNoticeDecider } from '../../src/core/AgentBetaNoticeDecider';

/**
 * Behaviour specification for the pure {@link AgentBetaNoticeDecider}.
 */
describe('AgentBetaNoticeDecider', () => {
  const decider = new AgentBetaNoticeDecider();

  describe('shouldShow', () => {
    it('shows when enabled and not acknowledged', () => {
      expect(decider.shouldShow(true, false)).to.equal(true);
    });

    it('does not show when already acknowledged', () => {
      expect(decider.shouldShow(true, true)).to.equal(false);
    });

    it('does not show when disabled, even if not acknowledged', () => {
      expect(decider.shouldShow(false, false)).to.equal(false);
    });

    it('does not show when disabled and acknowledged', () => {
      expect(decider.shouldShow(false, true)).to.equal(false);
    });
  });

  describe('effectFor', () => {
    it('persists the acknowledgement on "keep"', () => {
      expect(decider.effectFor('keep')).to.equal('persist-acknowledgement');
    });

    it('disables the integration on "disable"', () => {
      expect(decider.effectFor('disable')).to.equal('disable-integration');
    });

    it('opens the settings on "settings"', () => {
      expect(decider.effectFor('settings')).to.equal('open-settings');
    });

    it('persists nothing when dismissed (undefined)', () => {
      expect(decider.effectFor(undefined)).to.equal('none');
    });
  });
});
