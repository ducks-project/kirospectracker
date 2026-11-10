import { expect } from 'chai';
import { readFileSync } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
/** Fully-qualified identifier of the extension under test. */
const EXTENSION_ID = 'ducks-project.kirospectracker';
/** Optional locale the harness was asked to launch the editor with. */
const EXPECTED_LOCALE = process.env.KIRO_SPEC_TRACKER_TEST_LOCALE;
/** Command whose title is checked, with its `package.nls` identifier. */
const COMMAND_ID = 'kirospectracker.resetHiddenSpecs';
const COMMAND_TITLE_KEY = 'command.resetHiddenSpecs.title';
/** Message whose bundle translation is checked. */
const MESSAGE_KEY = 'Fully completed';
/** Shape of a manifest value, plain or `{ value, original }` once localized. */
type ManifestText = string | { readonly value: string; readonly original?: string };
/**
 * Read a JSON dictionary shipped with the extension.
 * @param extensionPath Absolute path of the extension.
 * @param relativePath Path relative to the extension root.
 * @returns The parsed dictionary.
 */
function readDictionary(extensionPath: string, relativePath: string): Record<string, string> {
  return JSON.parse(readFileSync(path.join(extensionPath, relativePath), 'utf8')) as Record<
    string,
    string
  >;
}
/**
 * Resolve a manifest text to its displayed string.
 * @param text A plain string or a `{ value }` object.
 * @returns The displayed text.
 */
function displayed(text: ManifestText | undefined): string | undefined {
  return 'string' === typeof text ? text : text?.value;
}
/**
 * Localization suite: the default run proves English output; a run launched with
 * `KIRO_SPEC_TRACKER_TEST_LOCALE=fr` (see `docs/testing.md`) proves the French
 * manifest titles and `vscode.l10n.t` strings under a real language pack.
 */
describe('Localization', () => {
  let extensionPath = '';
  before(() => {
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    if (undefined === extension) {
      throw new Error('The extension under test is not loaded.');
    }
    extensionPath = extension.extensionPath;
    // eslint-disable-next-line no-console
    console.log(`Localization run: env.language=${vscode.env.language}`);
  });
  it('translates a catalogued message according to the display language', function check() {
    const translated = vscode.l10n.t(MESSAGE_KEY);
    if ('fr' === EXPECTED_LOCALE) {
      const bundle = readDictionary(extensionPath, 'l10n/bundle.l10n.fr.json');
      expect(vscode.env.language.split('-')[0]).to.equal('fr');
      expect(translated).to.equal(bundle[MESSAGE_KEY]);
      expect(translated).to.not.equal(MESSAGE_KEY);
      return;
    }
    if (!vscode.env.language.startsWith('en')) {
      this.skip();
    }
    expect(translated).to.equal(MESSAGE_KEY);
  });
  it('keeps an argument-free message an unmodified template', () => {
    const template = 'Open {0} for {1}';
    const expected =
      'fr' === EXPECTED_LOCALE
        ? readDictionary(extensionPath, 'l10n/bundle.l10n.fr.json')[template]
        : template;
    expect(vscode.l10n.t(template)).to.equal(expected);
  });
  it('substitutes positional arguments after translation', () => {
    expect(vscode.l10n.t('Required: {0}/{1}', 2, 5)).to.match(/2\/5/);
  });
  it('localizes the contributed command title', () => {
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    const contributed = (
      extension?.packageJSON as {
        contributes: { commands: { command: string; title: ManifestText }[] };
      }
    ).contributes.commands.find((entry) => COMMAND_ID === entry.command);
    const english = readDictionary(extensionPath, 'package.nls.json')[COMMAND_TITLE_KEY];
    if ('fr' === EXPECTED_LOCALE) {
      const french = readDictionary(extensionPath, 'package.nls.fr.json')[COMMAND_TITLE_KEY];
      expect(displayed(contributed?.title)).to.equal(french);
      return;
    }
    expect(displayed(contributed?.title)).to.equal(english);
  });
});
