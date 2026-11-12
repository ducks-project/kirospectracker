import { expect } from 'chai';
import { SpecStatus } from '../../src/core/model/SpecStatus';
import { SpecFolderFilter } from '../../src/core/status/SpecFolderFilter';
import { SpecStatusFilter } from '../../src/core/status/SpecStatusFilter';
import { filterCards, isDoneStatus, partitionCards } from '../../src/webview/card/CardGrouping';
import { buildCardView } from '../helpers/spec-card-view-builder';

describe('CardGrouping', () => {
  it('treats Completed and FullyCompleted as done', () => {
    expect(isDoneStatus(SpecStatus.Completed)).to.equal(true);
    expect(isDoneStatus(SpecStatus.FullyCompleted)).to.equal(true);
    expect(isDoneStatus(SpecStatus.InProgress)).to.equal(false);
  });

  it('partitions cards into active and completed, keeping order', () => {
    const a = buildCardView(SpecStatus.InProgress, { name: 'a' });
    const b = buildCardView(SpecStatus.Completed, { name: 'b' });
    const c = buildCardView(SpecStatus.NotStarted, { name: 'c' });
    const [active, done] = partitionCards([a, b, c]);
    expect(active).to.deep.equal([a, c]);
    expect(done).to.deep.equal([b]);
  });

  it('composes status, folder and query filters', () => {
    const a = buildCardView(SpecStatus.InProgress, { name: 'alpha', folderKey: '/one' });
    const b = buildCardView(SpecStatus.InProgress, { name: 'beta', folderKey: '/two' });
    const result = filterCards(
      [a, b],
      SpecStatusFilter.fromUnknown([]),
      SpecFolderFilter.fromUnknown(['/two']),
      'bet',
    );
    expect(result).to.deep.equal([b]);
    expect(
      filterCards(
        [a, b],
        SpecStatusFilter.fromUnknown([]),
        SpecFolderFilter.fromUnknown(['/one']),
        'bet',
      ),
    ).to.deep.equal([]);
  });
});
