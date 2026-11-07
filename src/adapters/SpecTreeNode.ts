import type { ISpecGroup } from '../core/status/SpecGrouper';
import type { ISpecSnapshot } from '../core/model/ISpecSnapshot';

/** A tree node: either a status group or a spec leaf. */
export type SpecTreeNode =
  | { readonly kind: 'group'; readonly group: ISpecGroup }
  | { readonly kind: 'spec'; readonly spec: ISpecSnapshot };

/**
 * Resolve the spec folder path from a context-menu command argument.
 *
 * The tree's `view/item/context` menu passes the underlying {@link SpecTreeNode}
 * as the command argument; only a spec leaf carries a folder path. The guard is
 * defensive: it accepts the argument only when it is a spec leaf whose
 * `folderPath` is actually a string, so a malformed node can never flow a
 * non-string value downstream. Being `vscode`-free, it is unit-testable in
 * isolation.
 * @param argument The raw command argument.
 * @returns The spec folder path, or `undefined` when the argument is not a spec leaf with a string folder path.
 */
export function resolveSpecNodeFolderPath(argument: unknown): string | undefined {
  if (null === argument || 'object' !== typeof argument) {
    return undefined;
  }
  const node = argument as Partial<SpecTreeNode>;
  if ('spec' !== node.kind || undefined === node.spec) {
    return undefined;
  }
  const { folderPath } = node.spec;
  if ('string' !== typeof folderPath) {
    return undefined;
  }
  return folderPath;
}
