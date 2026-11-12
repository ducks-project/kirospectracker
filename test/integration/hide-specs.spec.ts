import { expect } from 'chai';
import * as vscode from 'vscode';
import { SpecExcludeGlob } from '../../src/core/hiding/SpecExcludeGlob';
import type { IExtensionApi } from '../../src/extension';
import { loadTestApi } from '../helpers/test-extension-api';

const USER_ENTRY = '**/user-owned-entry';
/** Completed spec whose name needs escaping; `[` and `]` are valid folder names on every OS. */
const BRACKET_SPEC = 'brackets[1]';
/** In-progress neighbour that an unescaped `brackets[1]` glob would wrongly match. */
const NEIGHBOUR_SPEC = 'brackets1';
const RESET_COMMAND = 'kirospectracker.resetHiddenSpecs';

/** Statuses hidden by default (Completed, FullyCompleted). */
const DEFAULT_HIDDEN = ['Completed', 'FullyCompleted'];

/**
 * Integration suite writing the REAL folder settings of the fixture workspace.
 *
 * The fixture's `.vscode/settings.json` (absent in the repository) is captured
 * before the first write and restored, or removed, in `after`, so no fixture file
 * is left modified, even when a test fails.
 */
describe('Hide specs by status (Node host)', () => {
  let api: IExtensionApi;
  let folder: vscode.WorkspaceFolder;
  let settingsUri: vscode.Uri;
  let settingsDirUri: vscode.Uri;
  let original: Uint8Array | undefined;

  const exclude = (key: 'files' | 'search'): Record<string, boolean> | undefined =>
    vscode.workspace.getConfiguration(key, folder.uri).inspect<Record<string, boolean>>('exclude')
      ?.workspaceFolderValue;

  const setMode = async (mode: string): Promise<void> => {
    await vscode.workspace
      .getConfiguration('kirospectracker.hideSpecs')
      .update('mode', mode, vscode.ConfigurationTarget.Workspace);
    await api.hiddenSpecs.sync();
  };

  const expectedGlobs = (): string[] =>
    api.repository
      .getSpecs()
      .filter((spec) => DEFAULT_HIDDEN.includes(spec.status))
      .map((spec) => new SpecExcludeGlob().build(spec.name) as string)
      .sort();

  const ownedKeys = (value: Record<string, boolean> | undefined): string[] =>
    Object.keys(value ?? {})
      .filter((key) => USER_ENTRY !== key)
      .sort();

  before(async function activateExtension() {
    const loaded = await loadTestApi();
    if (undefined === loaded) {
      this.skip();
      return;
    }
    api = loaded;
    await api.repository.refresh();
    folder = (vscode.workspace.workspaceFolders ?? [])[0];
    settingsDirUri = vscode.Uri.joinPath(folder.uri, '.vscode');
    settingsUri = vscode.Uri.joinPath(settingsDirUri, 'settings.json');
    original = await vscode.workspace.fs.readFile(settingsUri).then(
      (content) => content,
      () => undefined,
    );
  });

  after(async function restoreFixtureSettings() {
    if (undefined === settingsUri) {
      return;
    }
    if (undefined === original) {
      await vscode.workspace.fs.delete(settingsDirUri, { recursive: true, useTrash: false }).then(
        () => undefined,
        () => undefined,
      );
      return;
    }
    await vscode.workspace.fs.writeFile(settingsUri, original);
  });

  it('writes nothing while the mode is off (default)', async () => {
    await api.hiddenSpecs.sync();
    expect(exclude('files')).to.equal(undefined);
    expect(exclude('search')).to.equal(undefined);
    const files = await vscode.workspace.fs.stat(settingsUri).then(
      () => true,
      () => false,
    );
    expect(files).to.equal(undefined === original ? false : true);
  });

  it('reads the folder-level value through inspect and keeps a pre-existing entry', async () => {
    await vscode.workspace
      .getConfiguration('files', folder.uri)
      .update('exclude', { [USER_ENTRY]: true }, vscode.ConfigurationTarget.WorkspaceFolder);
    await setMode('everywhere');
    const value = exclude('files');
    expect(value?.[USER_ENTRY]).to.equal(true);
    expect(ownedKeys(value)).to.deep.equal(expectedGlobs());
    expect(expectedGlobs().length).to.be.greaterThan(0);
    expect(exclude('search')).to.equal(undefined);
  });

  it('does not copy defaults or user-level values into the folder file', () => {
    const keys = Object.keys(exclude('files') ?? {});
    expect(keys.some((key) => '**/.git' === key || '**/node_modules' === key)).to.equal(false);
  });

  it('keeps discovery, watcher path and decorations unaffected by the hiding', async () => {
    const before = api.repository.getSpecs().length;
    await api.repository.refresh();
    expect(api.repository.getSpecs()).to.have.length(before);
    const completed = api.repository.getSpecs().find((spec) => 'completed' === spec.name);
    expect(completed).to.not.equal(undefined);
    const deltas: string[] = [];
    const dispose = api.repository.onDidChangeSpecs((delta) => deltas.push(delta.type));
    api.fileSystem.notifyChanged(`${completed!.folderPath}/tasks.md`);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 600);
    });
    dispose();
    expect(deltas).to.include('specChanged');
    const decoration = api.decorations.provideFileDecoration(
      vscode.Uri.file(completed!.folderPath),
    );
    expect(decoration).to.not.equal(undefined);
  });

  it('hides the specs from findFiles but not when excludes are disabled', async () => {
    const hidden = await vscode.workspace.findFiles('**/.kiro/specs/completed/tasks.md');
    const all = await vscode.workspace.findFiles('**/.kiro/specs/completed/tasks.md', null);
    expect(hidden).to.have.length(0);
    expect(all).to.have.length(1);
  });

  it('hides a spec whose name needs escaping, and only that one', async () => {
    const owned = ownedKeys(exclude('files'));
    expect(owned).to.include('**/.kiro/specs/brackets[[]1[]]/**');
    const hidden = await vscode.workspace.findFiles('**/.kiro/specs/brackets*/tasks.md');
    const all = await vscode.workspace.findFiles('**/.kiro/specs/brackets*/tasks.md', null);
    expect(all.map((uri) => uri.fsPath.split(/[\\/]/).slice(-2)[0]).sort()).to.deep.equal([
      NEIGHBOUR_SPEC,
      BRACKET_SPEC,
    ]);
    expect(hidden.map((uri) => uri.fsPath.split(/[\\/]/).slice(-2)[0])).to.deep.equal([
      NEIGHBOUR_SPEC,
    ]);
  });
  it('moves the entries to search.exclude when the mode switches', async () => {
    await setMode('searchAndQuickOpen');
    expect(ownedKeys(exclude('search'))).to.deep.equal(expectedGlobs());
    expect(exclude('files')).to.deep.equal({ [USER_ENTRY]: true });
  });

  it('Reset removes only the extension entries', async () => {
    await vscode.commands.executeCommand(RESET_COMMAND);
    expect(exclude('search')).to.equal(undefined);
    expect(exclude('files')).to.deep.equal({ [USER_ENTRY]: true });
  });

  it('removes its entries when the mode returns to off, keeping the user ones', async () => {
    await setMode('everywhere');
    expect(ownedKeys(exclude('files'))).to.deep.equal(expectedGlobs());
    await setMode('off');
    expect(exclude('files')).to.deep.equal({ [USER_ENTRY]: true });
    expect(exclude('search')).to.equal(undefined);
  });
});
