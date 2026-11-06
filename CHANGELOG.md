# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[unreleased]: https://github.com/ducks-project/kirospectracker/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/ducks-project/kirospectracker/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/ducks-project/kirospectracker/releases/tag/v0.1.0
