import * as vscode from 'vscode';

import type { SpecGrouper } from '../core/status/SpecGrouper';
import type { SpecIntroductionLoader } from './SpecIntroductionLoader';
import type { SpecRepository } from './SpecRepository';
import type { SpecTreeNode } from './SpecTreeNode';
import { buildSpecTreeContextValue } from '../core/status/SpecTreeContextValue';

export { resolveSpecNodeFolderPath } from './SpecTreeNode';
export type { SpecTreeNode } from './SpecTreeNode';

/** View id contributed in package.json for the tree fallback. */
export const TREE_VIEW_ID = 'kirospectracker.tree';

/**
 * Lightweight activity-bar {@link vscode.TreeDataProvider} grouping specs by
 * status, as a navigation fallback alongside the dashboard.
 *
 * The grouping/sorting is delegated to the pure {@link SpecGrouper}; this
 * adapter only turns nodes into `TreeItem`s and refreshes on `onDidChangeSpecs`.
 */
export class SpecTreeDataProvider implements vscode.TreeDataProvider<SpecTreeNode> {
  private readonly repository: SpecRepository;

  private readonly grouper: SpecGrouper;

  private readonly introductionLoader: SpecIntroductionLoader;

  private readonly emitter: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();

  private readonly disposeRepositoryListener: () => void;

  /** Event the tree view subscribes to for refreshes. */
  public readonly onDidChangeTreeData: vscode.Event<void> = this.emitter.event;

  /**
   * Build the tree provider over the repository and the pure grouper.
   * @param repository The spec repository supplying snapshots.
   * @param grouper The pure status grouper.
   * @param introductionLoader The lazy loader for a spec's requirements introduction.
   */
  public constructor(
    repository: SpecRepository,
    grouper: SpecGrouper,
    introductionLoader: SpecIntroductionLoader,
  ) {
    this.repository = repository;
    this.grouper = grouper;
    this.introductionLoader = introductionLoader;
    this.disposeRepositoryListener = this.repository.onDidChangeSpecs(() => this.emitter.fire());
  }

  /**
   * Convert a node into its tree item.
   * @param node The node to render.
   * @returns The corresponding tree item.
   */
  // eslint-disable-next-line class-methods-use-this
  public getTreeItem(node: SpecTreeNode): vscode.TreeItem {
    if ('group' === node.kind) {
      const item = new vscode.TreeItem(
        `${node.group.label} (${node.group.specs.length})`,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      item.contextValue = 'specGroup';
      return item;
    }
    const item = new vscode.TreeItem(node.spec.name, vscode.TreeItemCollapsibleState.None);
    item.resourceUri = vscode.Uri.file(node.spec.folderPath);
    item.contextValue = buildSpecTreeContextValue(node.spec.documents, node.spec.status);
    return item;
  }

  /**
   * Return the children of a node, or the root groups when none is given.
   * @param node The parent node, or `undefined` for the root.
   * @returns The child nodes.
   */
  public getChildren(node?: SpecTreeNode): SpecTreeNode[] {
    if (undefined === node) {
      return this.grouper
        .group(this.repository.getSpecs())
        .map((group) => ({ kind: 'group', group }));
    }
    if ('group' === node.kind) {
      return node.group.specs.map((spec) => ({ kind: 'spec', spec }));
    }
    return [];
  }

  /**
   * Resolve a spec leaf's hover tooltip on demand with its requirements intro.
   *
   * VS Code calls this once per tree item on hover, so the `requirements.md`
   * introduction is read and parsed lazily here (never pre-loaded for every
   * spec). A group node, a spec without a requirements document, or a document
   * without a derivable introduction leaves the tooltip untouched.
   * @param item The tree item whose undefined tooltip may be resolved.
   * @param node The node associated with the tree item.
   * @param _token The cancellation token (unused: the single read is cheap).
   * @returns The same item, with a markdown tooltip when an introduction exists.
   */
  public async resolveTreeItem(
    item: vscode.TreeItem,
    node: SpecTreeNode,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: vscode.CancellationToken,
  ): Promise<vscode.TreeItem> {
    if ('spec' !== node.kind || !node.spec.documents.requirements) {
      return item;
    }
    const introduction = await this.introductionLoader.load(node.spec.folderPath);
    if (undefined === introduction) {
      return item;
    }
    item.tooltip = new vscode.MarkdownString(introduction);
    return item;
  }

  /**
   * Release the repository subscription and the emitter.
   */
  public dispose(): void {
    this.disposeRepositoryListener();
    this.emitter.dispose();
  }
}
