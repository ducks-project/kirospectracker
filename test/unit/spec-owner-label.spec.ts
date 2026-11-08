import { expect } from 'chai';

import { deriveSpecOwnerLabel } from '../../src/core/status/SpecOwnerLabel';

/**
 * Behaviour specification for {@link deriveSpecOwnerLabel}.
 */
describe('deriveSpecOwnerLabel', () => {
  it('returns the basename of a POSIX workspace path', () => {
    expect(deriveSpecOwnerLabel('/home/me/project')).to.equal('project');
  });

  it('returns the basename of a Windows workspace path', () => {
    expect(deriveSpecOwnerLabel('C:\\Users\\me\\project')).to.equal('project');
  });

  it('ignores a trailing separator', () => {
    expect(deriveSpecOwnerLabel('/home/me/project/')).to.equal('project');
  });

  it('collapses repeated separators', () => {
    expect(deriveSpecOwnerLabel('/home//me///project')).to.equal('project');
  });

  it('handles a single-segment path', () => {
    expect(deriveSpecOwnerLabel('project')).to.equal('project');
  });

  it('falls back to a stable label on an empty or separator-only path', () => {
    expect(deriveSpecOwnerLabel('')).to.equal('Unknown folder');
    expect(deriveSpecOwnerLabel('/')).to.equal('Unknown folder');
    expect(deriveSpecOwnerLabel('\\\\')).to.equal('Unknown folder');
  });
});
