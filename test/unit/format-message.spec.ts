import { expect } from 'chai';
import { formatMessage } from '../../src/core/i18n/formatMessage';
/**
 * Behaviour specification for {@link formatMessage}, which mirrors `vscode.l10n.t`.
 */
describe('formatMessage', () => {
  it('returns the template unchanged when there are no arguments', () => {
    expect(formatMessage('Copy {0} of {1}', [])).to.equal('Copy {0} of {1}');
  });
  it('substitutes positional markers', () => {
    expect(formatMessage('{0}/{1} done', [3, 8])).to.equal('3/8 done');
  });
  it('substitutes a repeated marker everywhere', () => {
    expect(formatMessage('{0} and {0}', ['a'])).to.equal('a and a');
  });
  it('leaves a marker without a matching argument unchanged', () => {
    expect(formatMessage('{0} then {2}', ['a'])).to.equal('a then {2}');
  });
  it('does not re-expand a marker contained in an argument', () => {
    expect(formatMessage('{0} {1}', ['{1}', 'x'])).to.equal('{1} x');
  });
  it('renders numbers, including zero', () => {
    expect(formatMessage('{0}%', [0])).to.equal('0%');
  });
  it('ignores text that is not a positional marker', () => {
    expect(formatMessage('{name} {} {0', ['a'])).to.equal('{name} {} {0');
  });
});
