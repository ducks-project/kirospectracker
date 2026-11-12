import { expect } from 'chai';
import { SpecStatus } from '../../src/core/model/SpecStatus';
import { SpecFolderFilter } from '../../src/core/status/SpecFolderFilter';
import { SpecStatusFilter } from '../../src/core/status/SpecStatusFilter';
import {
  buildBadgeModel,
  buildCardBreakdown,
  buildOwnerModel,
} from '../../src/webview/card/CardViewModel';
import { IDENTITY_VIEW_TEXT } from '../helpers/identity-view-text';
import { buildCardView } from '../helpers/spec-card-view-builder';

describe('CardViewModel', () => {
  describe('buildCardBreakdown', () => {
    it('is empty when no task is done, cancelled or in progress', () => {
      expect(
        buildCardBreakdown(buildCardView(SpecStatus.NotStarted), IDENTITY_VIEW_TEXT),
      ).to.deep.equal([]);
    });

    it('sums required and optional counts and hides zero states', () => {
      const base = buildCardView(SpecStatus.InProgress);
      const card = buildCardView(SpecStatus.InProgress, {
        progress: {
          ...base.progress,
          requiredResolvedDone: 2,
          optionalResolvedDone: 1,
          requiredInProgress: 1,
        },
      });
      expect(buildCardBreakdown(card, IDENTITY_VIEW_TEXT)).to.deep.equal([
        { cssClass: 'task-state-done', text: '3 done' },
        { cssClass: 'task-state-inProgress', text: '1 in progress' },
      ]);
    });

    it('keeps cancelled between done and in progress', () => {
      const base = buildCardView(SpecStatus.InProgress);
      const card = buildCardView(SpecStatus.InProgress, {
        progress: { ...base.progress, optionalResolvedCancelled: 4, requiredInProgress: 1 },
      });
      const classes = buildCardBreakdown(card, IDENTITY_VIEW_TEXT).map((item) => item.cssClass);
      expect(classes).to.deep.equal(['task-state-cancelled', 'task-state-inProgress']);
    });
  });

  describe('buildBadgeModel', () => {
    it('reflects an inactive status filter', () => {
      const model = buildBadgeModel(
        buildCardView(SpecStatus.Malformed),
        SpecStatusFilter.fromUnknown([]),
        IDENTITY_VIEW_TEXT,
      );
      expect(model.pressed).to.equal(false);
      expect(model.cssClass.startsWith('card-status badge ')).to.equal(true);
      expect(model.ariaLabel).to.equal(`Filter by ${model.label} status`);
    });

    it('is pressed once its status filter is active', () => {
      const card = buildCardView(SpecStatus.Malformed);
      const inactive = buildBadgeModel(card, SpecStatusFilter.fromUnknown([]), IDENTITY_VIEW_TEXT);
      const active = buildBadgeModel(
        card,
        SpecStatusFilter.fromUnknown([inactive.key]),
        IDENTITY_VIEW_TEXT,
      );
      expect(active.pressed).to.equal(true);
    });
  });

  describe('buildOwnerModel', () => {
    it('is pressed when the folder filter holds the card folder key', () => {
      const card = buildCardView(SpecStatus.InProgress);
      const model = buildOwnerModel(
        card,
        SpecFolderFilter.fromUnknown(['/ws']),
        IDENTITY_VIEW_TEXT,
      );
      expect(model).to.deep.equal({ pressed: true, ariaLabel: 'Filter by ws folder' });
    });

    it('is not pressed for another folder', () => {
      const card = buildCardView(SpecStatus.InProgress);
      const model = buildOwnerModel(
        card,
        SpecFolderFilter.fromUnknown(['/other']),
        IDENTITY_VIEW_TEXT,
      );
      expect(model.pressed).to.equal(false);
    });
  });
});
