import { expect } from 'chai';
import type { ITranslator } from '../../src/core/ports/ITranslator';
import { SpecStatus } from '../../src/core/model/SpecStatus';
import { IdentityTranslator } from '../../src/core/i18n/IdentityTranslator';
import { STATUS_LABEL_KEY, statusLabel } from '../../src/core/status/SpecStatusLabel';
/** Small French dictionary used to prove the label comes from the translator. */
const FRENCH: ITranslator = {
  t: (key) =>
    ({ Malformed: 'Mal formé', 'Fully completed': 'Entièrement terminé' })[key as string] ?? key,
};
/**
 * Behaviour specification for {@link statusLabel}: identifier and label are
 * separate.
 */
describe('statusLabel', () => {
  it('keeps the status identifiers unchanged', () => {
    expect(Object.values(SpecStatus)).to.deep.equal([
      'Malformed',
      'NotStarted',
      'InProgress',
      'Completed',
      'FullyCompleted',
    ]);
  });
  it('labels every status in readable English by default', () => {
    expect(
      Object.values(SpecStatus).map((s) => statusLabel(s, new IdentityTranslator())),
    ).to.deep.equal(['Malformed', 'Not started', 'In progress', 'Completed', 'Fully completed']);
  });
  it('covers every status with a label key', () => {
    expect(Object.keys(STATUS_LABEL_KEY).sort()).to.deep.equal(Object.values(SpecStatus).sort());
  });
  it('takes the label from the translator, not from the identifier', () => {
    expect(statusLabel(SpecStatus.FullyCompleted, FRENCH)).to.equal('Entièrement terminé');
    expect(statusLabel(SpecStatus.Malformed, FRENCH)).to.equal('Mal formé');
  });
});
