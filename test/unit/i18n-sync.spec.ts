import { expect } from 'chai';
import { existsSync, statSync } from 'fs';
import * as path from 'path';
import { MESSAGE_KEYS } from '../../src/core/i18n/messages';
import { SpecStatus } from '../../src/core/model/SpecStatus';
import {
  REPOSITORY_ROOT,
  collectPlaceholders,
  readJson,
  readManifest,
  resolveNls,
} from '../helpers/manifest-nls';

type Dictionary = Readonly<Record<string, string>>;
interface IManifest {
  readonly l10n?: string;
  readonly contributes: {
    readonly commands: readonly { command: string; title: string }[];
    readonly configuration: {
      properties: Readonly<Record<string, { properties?: Readonly<Record<string, unknown>> }>>;
    };
  };
}
const manifest = readManifest<IManifest>();
const nlsEn = readJson<Dictionary>('package.nls.json');
const nlsFr = readJson<Dictionary>('package.nls.fr.json');
const bundleFr = readJson<Dictionary>('l10n/bundle.l10n.fr.json');
/** Positional markers of a template, sorted so the comparison ignores word order. */
function markers(template: string): string[] {
  return (template.match(/\{\d+\}/g) ?? []).slice().sort();
}
/** Inline code and settings-link segments that a translation must keep verbatim. */
function codeSegments(template: string): string[] {
  return (template.match(/`[^`]*`/g) ?? []).slice().sort();
}
/** Whether the keys of a dictionary are in code-unit order. */
function isSorted(dictionary: Dictionary): boolean {
  const keys = Object.keys(dictionary);
  return keys.every((key, index) => 0 === index || keys[index - 1] < key);
}
/**
 * Synchronisation guards between the manifest, the typed catalogue and the
 * translation files. They replace extraction tooling (no new dependency).
 */
describe('i18n synchronisation', () => {
  describe('manifest placeholders', () => {
    const used = collectPlaceholders(manifest);
    it('resolves every %id% of package.json in package.nls.json', () => {
      expect(used.length).to.be.greaterThan(0);
      used.forEach((id) => expect(nlsEn, id).to.have.property(id));
    });
    it('has no orphan entry in package.nls.json', () => {
      expect(Object.keys(nlsEn).sort()).to.deep.equal([...new Set(used)].sort());
    });
    it('leaves no unresolved placeholder once resolved', () => {
      used.forEach((id) => expect(resolveNls(`%${id}%`)).to.not.match(/^%.+%$/));
    });
    it('keeps the English text of the manifest unchanged', () => {
      const reset = manifest.contributes.commands.find(
        (entry) => 'kirospectracker.resetHiddenSpecs' === entry.command,
      );
      expect(resolveNls(reset?.title ?? '')).to.equal('Kiro Spec Tracker: Reset Hidden Specs');
      expect(nlsEn['view.dashboard.name']).to.equal('Specs Dashboard');
      expect(nlsEn['view.tree.name']).to.equal('Specs by Status');
      expect(nlsEn['command.tree.syncFiles.title']).to.equal('Sync Files');
    });
    it('keeps the status keys of hideSpecs.statuses equal to the SpecStatus values', () => {
      const statuses =
        manifest.contributes.configuration.properties['kirospectracker.hideSpecs.statuses'];
      expect(Object.keys(statuses.properties ?? {}).sort()).to.deep.equal(
        Object.values(SpecStatus).sort(),
      );
    });
  });
  describe('French manifest translation', () => {
    it('has exactly the keys of the English file', () => {
      expect(Object.keys(nlsFr).sort()).to.deep.equal(Object.keys(nlsEn).sort());
    });
    it('keeps the same {n} markers and inline code as English', () => {
      Object.keys(nlsEn).forEach((id) => {
        expect(markers(nlsFr[id]), id).to.deep.equal(markers(nlsEn[id]));
        expect(codeSegments(nlsFr[id]), id).to.deep.equal(codeSegments(nlsEn[id]));
      });
    });
    it('has no empty value', () => {
      Object.entries(nlsFr).forEach(([id, value]) => expect(value.trim(), id).to.not.equal(''));
    });
  });
  describe('French message bundle', () => {
    it('translates every catalogued message and holds no unknown key', () => {
      expect(Object.keys(bundleFr).sort()).to.deep.equal([...MESSAGE_KEYS].sort());
    });
    it('keeps the same {n} markers as the English message', () => {
      MESSAGE_KEYS.forEach((key) => {
        expect(markers(bundleFr[key]), key).to.deep.equal(markers(key));
      });
    });
    it('keeps literal identifiers of the English message', () => {
      MESSAGE_KEYS.forEach((key) => {
        ['"kirospectracker.hideSpecs.mode"', '"off"', 'tasks.md'].forEach((literal) => {
          if (key.includes(literal)) {
            expect(bundleFr[key], key).to.contain(literal);
          }
        });
      });
    });
    it('has no empty value', () => {
      Object.entries(bundleFr).forEach(([key, value]) =>
        expect(value.trim(), key).to.not.equal(''),
      );
    });
  });
  describe('layout and ordering', () => {
    it('declares the l10n folder in package.json and ships it', () => {
      expect(manifest.l10n).to.equal('./l10n');
      const folder = path.join(REPOSITORY_ROOT, 'l10n');
      expect(existsSync(folder) && statSync(folder).isDirectory()).to.equal(true);
    });
    it('keeps the three translation files sorted by key', () => {
      expect(isSorted(nlsEn), 'package.nls.json').to.equal(true);
      expect(isSorted(nlsFr), 'package.nls.fr.json').to.equal(true);
      expect(isSorted(bundleFr), 'l10n/bundle.l10n.fr.json').to.equal(true);
    });
  });
});
