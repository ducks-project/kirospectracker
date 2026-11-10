import { expect } from 'chai';
import { readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import * as path from 'path';

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src');

/** Every `.ts` file below a directory. */
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(full);
    }
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

/**
 * Hidden specs are written to `files.exclude`, which `findFiles` honors even with
 * an explicit exclude glob. Spec discovery must therefore never rely on it.
 */
describe('Spec discovery is immune to files.exclude', () => {
  it('uses no findFiles / findFiles2 / findTextInFiles call in src', () => {
    const offenders = sourceFiles(SRC_ROOT).filter((file) =>
      /\b(findFiles2?|findTextInFiles)\s*\(/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).to.deep.equal([]);
  });

  it('reads specs through workspace.fs, which ignores exclusion settings', () => {
    const source = readFileSync(path.join(SRC_ROOT, 'adapters/VscodeSpecFileSystem.ts'), 'utf8');
    expect(source).to.contain('workspace.fs.readDirectory');
    expect(source).to.contain('workspace.fs.readFile');
  });

  it('never writes an exclusion entry for .kiro or .kiro/specs themselves', () => {
    const source = readFileSync(path.join(SRC_ROOT, 'core/hiding/SpecExcludeGlob.ts'), 'utf8');
    expect(source).to.contain("'**/.kiro/specs/'");
  });
});
