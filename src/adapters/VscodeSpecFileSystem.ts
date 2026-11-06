import * as vscode from 'vscode';

import { Debouncer } from '../core/Debouncer';
import type { ISpecChangeNotifier } from './ports/ISpecChangeNotifier';
import type { ISpecFileSystem } from './ports/ISpecFileSystem';
import { TimeoutScheduler } from './TimeoutScheduler';

/** Glob matching every file under any workspace `.kiro/specs/` tree. */
const SPECS_GLOB = '**/.kiro/specs/**';

/** UTF-8 decoder reused for every file read. */
const TEXT_DECODER = new TextDecoder('utf-8');

/**
 * Thin host wrapper implementing the file-system and change-notifier ports over
 * the real `vscode` API.
 *
 * It is the only spec-reading component that imports `vscode`: it reads through
 * `vscode.workspace.fs`, lists workspace folders, joins paths with
 * `vscode.Uri`, and owns a `FileSystemWatcher` on the specs tree. It carries no
 * parsing or status logic, so the host-agnostic {@link SpecRepository} stays
 * unit-testable against a fake and this wrapper is evidenced by the integration
 * harness instead of the in-process coverage gate.
 */
export class VscodeSpecFileSystem implements ISpecFileSystem, ISpecChangeNotifier {
  private readonly watcher: vscode.FileSystemWatcher;

  private readonly emitter: vscode.EventEmitter<string> = new vscode.EventEmitter<string>();

  private readonly debouncer: Debouncer = new Debouncer(new TimeoutScheduler());

  /**
   * Build the wrapper and wire the specs file-system watcher to the emitter.
   *
   * Burst events for the same path are debounced per path, so a flurry of writes
   * to one spec fires a single change (and thus a single scoped re-parse).
   */
  public constructor() {
    this.watcher = vscode.workspace.createFileSystemWatcher(SPECS_GLOB);
    const forward = (uri: vscode.Uri): void =>
      this.debouncer.schedule(uri.fsPath, () => this.emitter.fire(uri.fsPath));
    this.watcher.onDidCreate(forward);
    this.watcher.onDidChange(forward);
    this.watcher.onDidDelete(forward);
  }

  /**
   * Absolute paths of the open workspace folders.
   * @returns One path per folder; empty when no folder is open.
   */
  // eslint-disable-next-line class-methods-use-this
  public workspaceFolders(): readonly string[] {
    return (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath);
  }

  /**
   * List the direct sub-directory names of a folder.
   * @param folderPath Absolute path of the folder to list.
   * @returns Sub-directory names; empty when the folder is absent/unreadable.
   */
  // eslint-disable-next-line class-methods-use-this
  public async listDirectories(folderPath: string): Promise<readonly string[]> {
    try {
      const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(folderPath));
      return entries.filter(([, type]) => vscode.FileType.Directory === type).map(([name]) => name);
    } catch {
      return [];
    }
  }

  /**
   * Read a UTF-8 text file.
   * @param filePath Absolute path of the file.
   * @returns The file text, or `undefined` when absent/unreadable.
   */
  // eslint-disable-next-line class-methods-use-this
  public async readFile(filePath: string): Promise<string | undefined> {
    try {
      const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
      return TEXT_DECODER.decode(bytes);
    } catch {
      return undefined;
    }
  }

  /**
   * Join path segments through `vscode.Uri` path semantics.
   * @param segments Path segments to join.
   * @returns The joined absolute path.
   */
  // eslint-disable-next-line class-methods-use-this
  public join(...segments: string[]): string {
    const [first, ...rest] = segments;
    return vscode.Uri.joinPath(vscode.Uri.file(first), ...rest).fsPath;
  }

  /**
   * Fire a change for a path through the same emitter the watcher feeds.
   *
   * This is the deterministic test seam: it drives the exact entry point the
   * production `FileSystemWatcher` callback uses, so the integration harness can
   * assert the scoped-delta path without racing a host watcher within a fixed
   * timeout. Production code never calls it; only the wiring exposes it.
   * @param changedPath Absolute path of the changed file.
   */
  public notifyChanged(changedPath: string): void {
    this.emitter.fire(changedPath);
  }

  /**
   * Register a listener for spec file changes.
   * @param listener Callback receiving the changed file path.
   * @returns A disposer removing the listener.
   */
  public onDidChange(listener: (changedPath: string) => void): () => void {
    const subscription = this.emitter.event(listener);
    return () => subscription.dispose();
  }

  /**
   * Release the watcher and emitter.
   */
  public dispose(): void {
    this.debouncer.cancelAll();
    this.watcher.dispose();
    this.emitter.dispose();
  }
}
