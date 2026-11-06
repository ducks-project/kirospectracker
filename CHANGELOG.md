# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-11-06

### Security

- Upgrade the vulnerable development dependencies to patched major versions,
  bringing `npm audit` to 0 known vulnerabilities (previously 14: 2 high, 12
  moderate). None of the affected packages ship in the VSIX; this is build and
  tooling hygiene with no user-facing change. Bumped `esbuild` 0.24 to 0.28,
  `mocha` 10 to 12, `@vscode/vsce` 3 to 4, `ovsx` 0.10 to 1.3,
  `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin` 7 to 8, and
  the direct `glob` dependency 11 to 14, and pinned patched `glob` and `minimatch`
  transitively via `overrides`.

### Changed

- Replace the unmaintained `eslint-config-airbnb-typescript` base (hard-pinned to
  the vulnerable `@typescript-eslint` 7 line and to rules removed in
  `@typescript-eslint` 8) with a minimal ESLint config built on
  `@typescript-eslint/recommended`, `eslint-plugin-import`, and `prettier`. The
  project's enforced rules (strict equality, Yoda equality, no `var`, no
  `any`, import ordering, naming) are preserved and the lint suite stays green
  with no source changes.

## [0.1.1] - 2026-11-06

### Fixed

- Keep the dashboard search box focused and its caret in place while typing: the
  webview now preserves the toolbar across re-renders and rewrites only the stats
  and spec-list regions, so a render triggered by a file change no longer steals
  focus or wipes the query after each keystroke.

## [0.1.0] - 2026-11-06

### Added

- Spec discovery across all workspace folders under `.kiro/specs/`, excluding `.history/`,
  with live refresh on file changes.
- A `tasks.md` parser that reads GFM checkboxes, the `*` optional-task marker, hierarchical
  numbering, and `_Requirements:_` metadata, counting only leaf tasks.
- Status resolution into five states (`Malformed`, `NotStarted`, `InProgress`, `Completed`,
  `FullyCompleted`) and two separate required/optional progress ratios.
- File-explorer decorations (badge, theme color, tooltip) on each spec folder and on the
  `.kiro/specs/` folder.
- A CSP-locked activity-bar dashboard webview with list and grid layouts, a search box,
  aggregate statistics, per-spec progress bars, and links to the spec documents.
- A "Specs by Status" activity-bar tree view for quick navigation.
- A consent-gated "Run tasks" action from the dashboard, the explorer context menu, and the
  Command Palette, with no dependency on undocumented Kiro commands.
- Unit, property-based (fast-check), and VS Code integration test suites, plus a mitata
  parsing benchmark.

[unreleased]: https://github.com/ducks-project/kirospectracker/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/ducks-project/kirospectracker/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/ducks-project/kirospectracker/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/ducks-project/kirospectracker/releases/tag/v0.1.0
