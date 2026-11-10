import { expect } from 'chai';
import { SpecExcludeGlob } from '../../src/core/hiding/SpecExcludeGlob';
import { vscodeGlobMatches } from '../helpers/vscode-glob-oracle';

describe('SpecExcludeGlob', () => {
  const glob = new SpecExcludeGlob();

  it('builds the folder-and-contents glob for a plain name', () => {
    expect(glob.build('my-spec')).to.equal('**/.kiro/specs/my-spec/**');
  });

  it('escapes wildcards as one-character classes', () => {
    expect(glob.build('a*b?c[d]e}f')).to.equal('**/.kiro/specs/a[*]b[?]c[[]d[]]e[}]f/**');
  });

  it('leaves characters that are literal in the engine untouched', () => {
    expect(glob.build('a(b)!,^-c d')).to.equal('**/.kiro/specs/a(b)!,^-c d/**');
  });

  it('rejects names that cannot be expressed reliably', () => {
    ['', 'a{b', 'a/b', 'a\\b', 'trailing ', 'tab\t', 'nul\u0000'].forEach((name) => {
      expect(glob.build(name), JSON.stringify(name)).to.equal(undefined);
      expect(glob.isSupported(name)).to.equal(false);
    });
  });

  it('matches the folder and its files but not siblings, under the engine rules', () => {
    ['plain', 'a*b', 'a?b', '[x]', 'a]b', 'a[b', 'a}b', 'a(b)', 'a,b', '!x', '**'].forEach(
      (name) => {
        const built = glob.build(name) as string;
        expect(vscodeGlobMatches(built, `/w/.kiro/specs/${name}`), name).to.equal(true);
        expect(vscodeGlobMatches(built, `.kiro/specs/${name}`), name).to.equal(true);
        expect(vscodeGlobMatches(built, `/w/.kiro/specs/${name}/tasks.md`), name).to.equal(true);
        expect(vscodeGlobMatches(built, `/w/.kiro/specs/${name}x/tasks.md`), name).to.equal(false);
        expect(vscodeGlobMatches(built, '/w/.kiro/specs'), name).to.equal(false);
        expect(vscodeGlobMatches(built, '/w/.kiro'), name).to.equal(false);
      },
    );
  });

  it('documents why a bare folder glob is not enough for the Quick Open history', () => {
    expect(vscodeGlobMatches('**/.kiro/specs/foo', '/w/.kiro/specs/foo/tasks.md')).to.equal(false);
    expect(vscodeGlobMatches('**/.kiro/specs/foo/**', '/w/.kiro/specs/foo/tasks.md')).to.equal(
      true,
    );
  });

  it('shows why a brace in a name is rejected: the escaped form breaks the folder match', () => {
    expect(vscodeGlobMatches('**/.kiro/specs/a[{]b/**', '/w/.kiro/specs/a{b')).to.equal(false);
  });
});
