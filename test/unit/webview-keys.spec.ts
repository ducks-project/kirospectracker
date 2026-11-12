import { expect } from 'chai';
import { readdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { MessageKey } from '../../src/core/i18n/messages';
import type { ITranslator } from '../../src/core/ports/ITranslator';
import { WEBVIEW_MESSAGE_KEYS, WEBVIEW_ONLY_KEYS } from '../../src/core/i18n/messages';
import { SpecStatus } from '../../src/core/model/SpecStatus';
import { SpecLayoutToggleView } from '../../src/core/status/SpecLayoutToggleView';
import { SpecStatToggleView } from '../../src/core/status/SpecStatToggleView';
import { statusLabel } from '../../src/core/status/SpecStatusLabel';
import { SpecStatusFilter } from '../../src/core/status/SpecStatusFilter';
/** Translator recording every requested key. */
class RecordingTranslator implements ITranslator {
  public readonly keys: MessageKey[] = [];
  public t(key: MessageKey): string {
    this.keys.push(key);
    return key;
  }
}
/** Root of the webview sources, read recursively to check the keys they request. */
const WEBVIEW_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../src/webview');
/** Matches `tw('literal'` and `text.t('literal'` calls in the webview sources. */
const TW_CALL = /\b(?:tw|text\.t)\(\s*'((?:[^'\\]|\\.)*)'/g;
/** Matches `twp('literal'` and `text.tp('literal'` plural calls in the webview sources. */
const TWP_CALL = /\b(?:twp|text\.tp)\(\s*'((?:[^'\\]|\\.)*)'/g;
/**
 * Concatenate the source of every `.ts` file under a directory, recursively.
 * @param dir The directory to walk.
 * @returns The concatenated sources.
 */
function readSources(dir: string): string {
  return readdirSync(dir, { withFileTypes: true })
    .map((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        return readSources(path);
      }
      return entry.name.endsWith('.ts') ? readFileSync(path, 'utf8') : '';
    })
    .join('\n');
}
/**
 * The webview may only request messages the host puts in its catalogue.
 */
describe('webview message keys', () => {
  it('only requests catalogued webview keys from the core views', () => {
    const recorder = new RecordingTranslator();
    new SpecStatToggleView(recorder).build(
      { total: 0, completed: 0, inProgress: 0, notStarted: 0, malformed: 0 },
      SpecStatusFilter.fromUnknown([]),
    );
    new SpecLayoutToggleView(recorder).describeToggle('list');
    new SpecLayoutToggleView(recorder).describeToggle('grid');
    Object.values(SpecStatus).forEach((status) => statusLabel(status, recorder));
    expect(recorder.keys.length).to.be.greaterThan(0);
    recorder.keys.forEach((key) => expect(WEBVIEW_MESSAGE_KEYS).to.include(key));
  });
  it('requests only catalogued webview keys through the translator in src/webview', () => {
    const source = readSources(WEBVIEW_DIR);
    const used = [...source.matchAll(TW_CALL), ...source.matchAll(TWP_CALL)].map(
      (match) => match[1],
    );
    expect(used.length).to.be.greaterThan(0);
    used.forEach((key) => expect(WEBVIEW_MESSAGE_KEYS as readonly string[]).to.include(key));
  });
  it('uses every webview-only message (no stale catalogue entry)', () => {
    const source = readSources(WEBVIEW_DIR);
    const used = new Set(
      [...source.matchAll(TW_CALL), ...source.matchAll(TWP_CALL)].map((match) => match[1]),
    );
    const viaCore = ['Switch to list view', 'Switch to grid view'];
    WEBVIEW_ONLY_KEYS.filter((key) => !viaCore.includes(key)).forEach((key) =>
      expect(used.has(key), key).to.equal(true),
    );
  });
});
