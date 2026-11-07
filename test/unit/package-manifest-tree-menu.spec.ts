import { expect } from 'chai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import * as path from 'path';

import {
  SPEC_TREE_CONTEXT_TOKENS,
  SPEC_TREE_MENU_GATING_TOKENS,
} from '../../src/core/status/SpecTreeContextValue';

/** Tree view id the `view/item/context` entries must be scoped to. */
const TREE_VIEW_ID = 'kirospectracker.tree';

/** Absolute path of the extension manifest in the repository. */
const MANIFEST_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../package.json',
);

/** Shape of a single `view/item/context` menu contribution we assert against. */
interface IMenuEntry {
  readonly when?: string;
}

/** Minimal shape of the manifest fields the assertion reads. */
interface IManifest {
  readonly contributes?: {
    readonly menus?: {
      readonly 'view/item/context'?: readonly IMenuEntry[];
    };
  };
}

/**
 * Extract the single token a `viewItem =~ /.../` regex gates on, requiring the
 * canonical word-boundary anchoring `(^| )<token>( |$)` the manifest uses so a
 * space-joined token list matches a whole token and never a substring.
 * @param when The raw `when` clause.
 * @returns The anchored token, or `undefined` when the clause gates no token.
 */
function anchoredViewItemToken(when: string): string | undefined {
  const match = /viewItem =~ \/\(\^\| \)([^/]+?)\( \|\$\)\//.exec(when);
  if (null === match) {
    return undefined;
  }
  return match[1];
}

/**
 * Read and parse the extension manifest from the repository.
 * @returns The parsed manifest.
 */
function readManifest(): IManifest {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as IManifest;
}

/**
 * Collect every `view/item/context` clause scoped to the tree view.
 * @returns The `when` clauses of the tree-view context-menu entries.
 */
function treeViewWhenClauses(): string[] {
  const entries = readManifest().contributes?.menus?.['view/item/context'] ?? [];
  return entries
    .map((entry) => entry.when ?? '')
    .filter((when) => when.includes(`view == ${TREE_VIEW_ID}`));
}

/**
 * Assertion locking the hand-written manifest `when` clauses against the
 * canonical context-value token vocabulary, so renaming a token can no longer
 * silently break the tree context menu.
 */
describe('package.json tree context menu when clauses', () => {
  it('finds at least the gating clauses in the manifest', () => {
    expect(treeViewWhenClauses().length).to.be.at.least(SPEC_TREE_MENU_GATING_TOKENS.length);
  });

  it('references only tokens from the canonical vocabulary', () => {
    treeViewWhenClauses().forEach((when) => {
      const token = anchoredViewItemToken(when);
      expect(token, `clause has a canonically anchored viewItem token: ${when}`).to.not.equal(
        undefined,
      );
      expect(
        SPEC_TREE_CONTEXT_TOKENS,
        `token "${String(token)}" is in the canonical vocabulary`,
      ).to.include(token as string);
    });
  });

  it('gates every menu-gating token with exactly one anchored clause', () => {
    const gatedTokens = treeViewWhenClauses()
      .map(anchoredViewItemToken)
      .filter((token): token is string => undefined !== token);
    SPEC_TREE_MENU_GATING_TOKENS.forEach((token) => {
      const occurrences = gatedTokens.filter((candidate) => candidate === token).length;
      expect(occurrences, `token "${token}" has exactly one anchored when clause`).to.equal(1);
    });
  });

  it('gates no token outside the menu-gating set (notably not the bare spec token)', () => {
    const gatedTokens = treeViewWhenClauses()
      .map(anchoredViewItemToken)
      .filter((token): token is string => undefined !== token);
    gatedTokens.forEach((token) => {
      expect(SPEC_TREE_MENU_GATING_TOKENS, `token "${token}" is meant to gate a menu`).to.include(
        token,
      );
    });
  });
});
