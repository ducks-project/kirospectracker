import * as vscode from 'vscode';

import type { ISpecGroup, SpecGrouper } from '../core/status/SpecGrouper';
import type { ISpecSnapshot } from '../core/model/ISpecSnapshot';
import type { SpecRepository } from './SpecRepository';
import { buildSpecTreeContextValue } from '../core/status/SpecTreeContextValue';

/** View id contributed in package.json for the tree fallback. */
export const TREE_VIEW_ID = 'kirospectracker.tree';

/** A tree node: either a status group or a spec leaf. */
export type SpecTreeNode =
  | { readonly kind: 'group'; readonly group: ISpecGroup }
  | { readonly kind: 'spec'; readonly spec: ISpecSnapshot };

/**
 * Resolve the spec folder path from a context-menu command argument.
 *
 * The tree's `view/item/context` menu passes the underlying {@link SpecTreeNode}
 * as the command argument; only a spec leaf carries a folder path.
 * @param argument The raw command argument.
 * @returns The spec folder path, or `undefined` when the argument is not a spec leaf.
 */
export function resolveSpecNodeFolderPath(argument: unknown): string | undefined {
  if (null === argument || 'object' !== typeof argument) {
    return undefined;
  }
  const node = argument as Partial<SpecTreeNode>;
  if ('spec' !== node.kind || undefined === node.spec) {
    return undefined;
  }
  return node.spec.folderPath;
}

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

  private readonly emitter: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();

  private readonly disposeRepositoryListener: () => void;

  /** Event the tree view subscribes to for refreshes. */
  public readonly onDidChangeTreeData: vscode.Event<void> = this.emitter.event;

  /**
   * Build the tree provider over the repository and the pure grouper.
   * @param repository The spec repository supplying snapshots.
   * @param grouper The pure status grouper.
   */
  public constructor(repository: SpecRepository, grouper: SpecGrouper) {
    this.repository = repository;
    this.grouper = grouper;
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
   * Release the repository subscription and the emitter.
   */
  public dispose(): void {
    this.disposeRepositoryListener();
    this.emitter.dispose();
  }
}
