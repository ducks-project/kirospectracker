import { expect } from 'chai';
import { readFileSync } from 'fs';
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
/** Webview entry point source, read to check the keys it requests. */
const MAIN_PATH = join(dirname(fileURLToPath(import.meta.url)), '../../src/webview/main.ts');
/** Matches `tw('literal'` calls in the webview entry point. */
const TW_CALL = /\btw\(\s*'((?:[^'\\]|\\.)*)'/g;
/** Matches `twp('literal'` plural calls in the webview entry point. */
const TWP_CALL = /\btwp\(\s*'((?:[^'\\]|\\.)*)'/g;
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
  it('requests only catalogued webview keys through tw() in main.ts', () => {
    const source = readFileSync(MAIN_PATH, 'utf8');
    const used = [...source.matchAll(TW_CALL), ...source.matchAll(TWP_CALL)].map(
      (match) => match[1],
    );
    expect(used.length).to.be.greaterThan(0);
    used.forEach((key) => expect(WEBVIEW_MESSAGE_KEYS as readonly string[]).to.include(key));
  });
  it('uses every webview-only message (no stale catalogue entry)', () => {
    const source = readFileSync(MAIN_PATH, 'utf8');
    const used = new Set(
      [...source.matchAll(TW_CALL), ...source.matchAll(TWP_CALL)].map((match) => match[1]),
    );
    const viaCore = ['Switch to list view', 'Switch to grid view'];
    WEBVIEW_ONLY_KEYS.filter((key) => !viaCore.includes(key)).forEach((key) =>
      expect(used.has(key), key).to.equal(true),
    );
  });
});
