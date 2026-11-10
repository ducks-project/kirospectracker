# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.13.1] - 2026-11-10

### Fixed

- Exclude local `.worktrees/` checkouts from the packaged extension and from version control,
  so a `vsce package` run while a worktree exists no longer ships its content.

### Security

- Ignore dashboard webview messages whose `event.origin` is not the webview's own origin
  (CWE-940), resolving the CodeQL `js/missing-origin-check` alert. Measured on Kiro 1.4.121 and
  VS Code 1.145.2, the webview host posts every message with the webview's own origin, so the
  legitimate traffic is unaffected.

## [0.13.0] - 2026-11-10

### Added

- Add a French translation of the extension, shown when the editor's display language is
  French through a language pack (as with the VS Code French language pack in Kiro); without
  such a pack the extension stays in English. It covers the manifest (command titles, views and
  settings, through `package.nls.json` / `package.nls.fr.json`), the host and core messages
  (notifications, tooltips, tree labels, through `vscode.l10n` and `l10n/bundle.l10n.fr.json`)
  and the dashboard. The French wording follows the impersonal style of the VS Code French
  language pack; "spec", "dashboard", the document names (`requirements`, `design`, `tasks`,
  `notes`, `bugfix`), the prompts sent to the Kiro agent and the diagnostic output channel stay
  in English.
- Translate strings through a core `ITranslator` port backed by a `VscodeTranslator` adapter,
  so the core stays free of the `vscode` API, with a single typed English catalogue as the
  source of every message. The dashboard webview, which has no access to the translation API,
  receives its translated catalogue from the host in a `strings` message posted before each
  render, and its `<html lang>` follows the display language.
- Add tests guarding the catalogues: every manifest placeholder resolves, the English and
  French files carry the same keys and the same template markers, and the French bundle covers
  the whole catalogue. The integration test harness can run under a chosen editor executable and
  locale through `KIRO_SPEC_TRACKER_TEST_*` environment variables, used to check the French
  rendering under Kiro.

### Changed

- Show a readable status label on the dashboard card badge (for example "Fully completed"
  instead of the `FullyCompleted` identifier), in every language. The `SpecStatus` values and
  the keys of the `kirospectracker.hideSpecs.statuses` setting are unchanged.

## [0.12.0] - 2026-11-10

### Added

- Add a `kirospectracker.hideSpecs.mode` setting to hide specs from VS Code views: `off`
  (default, nothing is written), `searchAndQuickOpen` (drives `search.exclude`, so Search and
  Quick Open skip the specs) or `everywhere` (drives `files.exclude`, so the Explorer, Search and
  Quick Open all skip them). VS Code has no lever for Quick Open alone or the Explorer alone, so
  these three states are the only achievable ones.
- Add a `kirospectracker.hideSpecs.statuses` setting that chooses which statuses are hidden, one
  checkbox per spec status (`Completed` and `FullyCompleted` checked by default). The spec
  discovery, the dashboard, the tree view and Kiro's own Specs panel are not affected: hidden
  specs keep being tracked and listed there.
- Write one `**/.kiro/specs/<name>/**` entry per hidden spec into the settings of the workspace
  folder that owns it, refreshed whenever a spec status or one of these settings changes. Writes
  are idempotent and debounced. The extension tracks which entries it added: it never modifies
  or removes an entry it did not add, it does not re-add an entry the user removed by hand while
  the spec stays hidden, and it removes its own entries when the mode returns to `off`. Glob
  characters in spec names are escaped; a name that cannot be escaped reliably is skipped and
  reported in the diagnostic output channel.
- Add the `Kiro Spec Tracker: Reset Hidden Specs` command, which removes every entry the
  extension added.
- Show a non-blocking notification after the first write, with a button that opens the settings
  file.
- Add a configuration guide (`docs/configuration.md`) documenting every setting, the surfaces each
  mode affects and the known side effects: Kiro agent search tools no longer find hidden specs,
  VS Code purges the Quick Open history entries of hidden files, a versioned
  `.vscode/settings.json` gets a diff when a spec status changes, and entries are left behind if
  the extension is uninstalled while the mode is on.

## [0.11.0] - 2026-11-10

### Added

- Resolve each spec's entry document from its `.kiro/specs/<name>/.config.kiro` file, which
  carries two independent axes: `specType` (`feature` / `bugfix`) and `workflowType`
  (`requirements-first` / `design-first`). A bugfix spec opens `bugfix.md`, otherwise a
  design-first spec opens `design.md`, otherwise `requirements.md`. When `.config.kiro` is
  missing, unreadable or carries an unknown value, or when the resolved document does not
  exist, the first present document is used (`requirements.md`, then `design.md`, then
  `tasks.md`), so specs without a configuration file behave as before. The file format is not
  publicly documented by Kiro, so it is read behind a dedicated `ISpecConfigReader` port and
  parsed by a pure, tolerant `parseSpecConfig`; the resolution rules live in a single
  `ENTRY_DOCUMENT_RULES` table, so a new rule is an additive change.
- Add `bugfix` as a first-class spec document kind: `bugfix.md` is detected like the other
  documents, gets its own link on the dashboard card and an "Open Bugfix" entry in the tree
  context menu.

### Changed

- Open the resolved entry document when a dashboard card is clicked, instead of always
  `requirements.md`. The explicit per-document links are unchanged.
- Make the hover preview follow the same entry document as the card click, so a design-first
  spec previews its design and a bugfix spec previews `bugfix.md`. The introduction extractor
  now also recognises an `Overview` / `Vue d'ensemble` section, so a `design.md` without an
  `Introduction` section still gets a meaningful preview. The host-side cache is keyed by
  document path and invalidated per spec, so editing `.config.kiro` or adding `bugfix.md`
  never serves a stale preview.
- Hide the dashboard document links whose document does not exist, instead of rendering them
  disabled; a card with no document renders no link row at all.
- Dismiss the hover popin as soon as the dashboard list scrolls, so it never covers the
  content being scrolled to, and raise the delay before it appears from 150 ms to 300 ms so it
  no longer flashes while the pointer crosses the cards.

## [0.10.0] - 2026-11-09

### Added

- Show a preview of the spec's `requirements.md` introduction when hovering a card in the
  dashboard, in a floating popin styled after the Extensions view hover. The introduction is
  loaded lazily on hover (never added to the card payload), so the 500-spec large-workspace
  speed goal is kept. It is derived by a pure, `vscode`-free `extractRequirementsIntroduction`
  (the `## Introduction` section, falling back to the first paragraph), read through the
  existing `ISpecFileSystem` port by a `SpecIntroductionLoader`, and memoised in a bounded
  `BoundedCache`. The webview asks the host through a new `requestIntroduction` /
  `introduction` message pair correlated by spec folder path.
- Place the popin below the card with an arrow pointing at it, flipping above when there is not
  enough room below and clamping it inside the webview. The placement is computed by a pure
  `computeHoverPlacement` function. The popin uses VS Code theme variables only, so it follows
  light, dark and high-contrast themes, and is dismissed with the Escape key. The card is
  linked to the popin with `aria-describedby`, it also opens on keyboard focus, and its
  animation is disabled under `prefers-reduced-motion`.

### Changed

- Reset the hover request state on every full dashboard re-render, so a spec whose
  `requirements.md` appeared after a first hover, or whose first reply was lost, can be
  requested again. A spec that genuinely has no introduction is still not re-requested within
  the same render.

## [0.9.0] - 2026-11-09

### Added

- Add a folder-scoped filter to the dashboard search box, styled like the Extensions view
  filter affordance: a filter button opens a menu listing the distinct folders (projects) that
  contain specs, with a per-folder spec count. Selecting folders is an additive, multi-select
  toggle (none selected shows every folder; selecting one or more narrows to them) that
  composes (logical AND) with both the status filter and the search text. The decision lives in
  a pure, `vscode`-free `SpecFolderFilter` state machine keyed on the stable owning-folder
  identity (the workspace folder path, not the display basename, so two folders sharing a
  basename stay distinct); the distinct options and the menu items are projected by the pure
  `computeFolderOptions` helper and `SpecFolderToggleView`. The menu is keyboard-accessible and
  the selected folder set is persisted in the webview state like the status filter and layout.
- Make the owning-folder label on each spec card a clickable toggle that filters/unfilters by
  that folder, driving the same `SpecFolderFilter` as the search-box menu so the two surfaces
  stay in sync. The label becomes an accessible button (`aria-pressed` reflecting whether that
  folder filter is active) keeping its discreet styling, and it stops click propagation so
  toggling it never also opens the card.

## [0.8.0] - 2026-11-09

### Added

- Extend task-state parsing to recognize cancelled (`[-]`) and in-progress (`[~]`) in addition
  to done (`[x]`) and not done (`[ ]`), mapped once through a pure `taskStateFromMark` helper so
  no raw bracket literal is scattered across the code.
- Add discreet global, task-level statistics across all specs (total tasks done, cancelled, in
  progress and to do, plus an overall resolved percentage), computed by a pure
  `GlobalTaskStatsCalculator` and surfaced in the dashboard.
- Render the done, cancelled and in-progress task states distinctly in the dashboard (cancelled
  shown struck through and dimmed, in-progress shown subtly), using theme-aware styling.

### Changed

- Count a task as resolved when it is done OR cancelled: completion and progress now treat a
  cancelled task like a done one (it counts in both the numerator and the denominator), so a
  spec whose required tasks are all cancelled resolves to Completed.

## [0.7.1] - 2026-11-09

### Changed

- Clean up the extension manifest: `activationEvents` is now empty because VS Code derives
  activation from the declared command and view contributions; `kirospectracker.openDocument`
  is declared as a command (hidden from the Command Palette via a `commandPalette` `when:
  false` entry, alongside the context-only tree commands) so its activation is generated too.
  No behavior change — the extension still activates on its views and commands.

### Added

- Give each activity-bar view its own icon (`media/view-dashboard.svg` for the Specs
  Dashboard, `media/view-tree.svg` for Specs by Status), resolving the missing per-view icon
  warning when both views share the container.

## [0.7.0] - 2026-11-09

### Added

- Drive the agent-driven Sync Files and Run tasks actions from the dashboard cards and the
  "Specs by Status" tree context menu, wired through an intent-level `ISpecAgentGateway` port
  (pure, in core) so the core and UI never reference any editor command. A
  `KiroChatAgentGateway` adapter confines every fragile detail (the undocumented `kiroAgent.*`
  commands and the generic chat-open fallback); an `UnavailableAgentGateway` Null-Object
  fallback degrades both actions to the honest MVP (open `tasks.md` and offer a consented,
  ready-to-paste prompt); and a capability-detection factory (`getCommands(true)`) selects the
  adapter at runtime. "Sync Files" sends `Update the tasks for the {spec name}`, "Run required
  tasks" sends `Run all required tasks`, and "Run required and optional tasks" sends `Run
  required and optional tasks`; the fixed message templates interpolate only the spec name.
  Both UI entry points call one shared implementation behind the port (DRY). The integration
  relies on non-official, unstable editor command surfaces and degrades gracefully when they
  are absent.
- On supported builds the actions open a new Kiro chat session, activate it and bring it to
  the foreground, then truly submit the templated prompt. `KiroChatAgentGateway` runs a
  capability-probed, cascading try/catch dispatch chain: it creates a session with
  `kiroAgent.sessions.create`, activates it (preferring `kiroAgent.sessions.switch`, which
  reports `{ accepted }`, else the best-effort `kiroAgent.viewSession`), foregrounds the chat
  view with `kiroAgent.chatView.focus`, then dispatches `kiroAgent.sessions.sendPrompt`
  (positional `sessionId, prompt`) fire-and-forget so the "sent to Kiro chat" toast is
  immediate rather than waiting for end-of-turn. The graceful fallbacks are, in order:
  `kiroAgent.focusChatInput({ submit: true, newSession: true })`, `kiroAgent.focusChatInput({
  prompt })` (fill only — press Enter), and the generic `workbench.action.chat.open`. Feedback
  stays honest per path, and when no activation command exists the toast says the session may
  have opened in Session History.
- Attach the spec folder as chat context so the agent acts on the right spec. The pure,
  `vscode`-free `composeMessageWithFolderContext` prepends an in-prompt folder reference token
  `#[[folder:<specFolderFsPath>]]` on its own line before the template; Kiro parses that token
  from the prompt text and resolves it to the spec folder. It degrades gracefully: with no
  folder path the plain template is sent without a token. (`kiroAgent.selectFilesAsContext` is
  not used — it only seeds the chat input box, which the programmatic `sendPrompt` ignores.)
- Surface a one-time beta notice on activation (when the integration is enabled and not yet
  acknowledged) through the native, stable `window.showInformationMessage` toast with three
  buttons: "Keep enabled" (persist the acknowledgement in global state so the notice never
  shows again; integration stays on), "Disable" (turn the integration off; the Null-Object
  fallback takes over), and "Settings" (open the extension settings). Dismissing the toast
  with the close affordance persists nothing, so the notice reappears on the next launch while
  the integration stays enabled. The pure decision logic lives in a `vscode`-free, unit-tested
  helper; only the toast and global-state access live in a thin adapter.
- Add the `kirospectracker.agentIntegration.enabled` setting (default `true`) to enable or
  disable the best-effort agent integration. When disabled, the factory always binds the
  Null-Object fallback regardless of detected capability.
- Add an observability diagnostic for the agent actions: each action appends one concise line
  to a "Kiro Spec Tracker" output channel recording the dispatch path, the activation kind,
  the fire-and-forget send mode, whether the spec folder was attached as context
  (`context=yes|no`), a COUNT of detected `kiroAgent.*` commands (`kiroAgentCommandCount=NNN`)
  and whether the generic chat-open command exists. Read it via View → Output → "Kiro Spec
  Tracker".

### Changed

- Evolve the dashboard "Run tasks" control into a split button (a primary "Run tasks" action
  with a keyboard-accessible dropdown exposing "Run required tasks" and "Run required and
  optional tasks") and add a "Sync Files" button next to it, matching the reference layout.
  The webview dispatches typed `postMessage` intents (a `syncFiles` intent and a `runTasks`
  carrying a scope); the CSP/nonce, `textContent`-only DOM building, accessible buttons
  (`aria-label`, `aria-expanded`, `role`), the v0.1.1 persistent-toolbar focus and the v0.3.0
  incremental protocol are all preserved. The tree context menu replaces its single "Run
  tasks" entry with Sync Files / Run required tasks / Run required and optional tasks, keeping
  the separator between the document actions and the task actions.

## [0.6.0] - 2026-11-08

### Added

- Make each spec card body clickable to open the spec's `requirements.md`, reusing the
  existing openDocument intent. The card body is a keyboard-accessible button (role, tab
  stop, Enter/Space, an `aria-label` naming the spec); its inner controls (document links,
  the run button, and the new status badge) stop click propagation, so clicking them never
  also opens the card, and the open gesture is a disabled no-op when `requirements.md` is
  absent.
- Make the status shown on each spec card a clickable, state-colored badge that toggles the
  status filter for that status. A card badge and the matching toolbar stat toggle drive the
  same additive `SpecStatusFilter`, so they stay in sync; the badge is an accessible button
  with an `aria-pressed` state reflecting whether that status filter is active. Each status
  gets a distinct, theme-aware color (completed green, in progress orange, not started blue,
  malformed red) bound to VS Code theme color variables, resolved through a single
  `SpecStatusColor` mapping keyed by filter key and shared by both surfaces.
- Show the owning workspace folder on each spec card as a discreet label, derived by the pure
  `deriveSpecOwnerLabel` helper (the folder basename, computed filesystem-agnostically). It is
  display-only and rendered as escaped plain text.

### Changed

- Replace the two side-by-side list/grid layout toggles with a single flipping icon button
  that shows the glyph of the layout it will switch to and updates its `aria-label`,
  tooltip and `aria-pressed` on toggle (grid modelled as the pressed state). The decision
  moves to the pure `SpecLayoutToggleView.describeToggle`, and the Command Palette entry
  keeps its text title while the view title-bar command is now icon-driven. The existing
  `setLayout` behaviour and webview persistence are unchanged.

All four items are pure, client-side UI over the card view-models the webview already
receives: no new extension-host round-trip beyond the existing openDocument intent, and no
new full re-render on a card click or badge toggle. The v0.3.0 incremental update protocol,
the v0.1.1 persistent-toolbar focus behaviour, the v0.4.0 persisted filter/layout state and
the v0.4.1 ready handshake are all preserved.

## [0.5.0] - 2026-11-07

### Changed

- Harden the dashboard interaction surfaces without any user-facing behaviour change. The
  tree context-value tokens are now defined once in a pure, `vscode`-free vocabulary that both
  the builder and a new manifest assertion derive from, so renaming a token fails a test
  instead of silently breaking the "Specs by Status" right-click menu; the assertion reads
  `package.json` and checks that every tree-view `when` clause references only canonical
  tokens and that every menu-gating token has exactly one correctly anchored clause.
  `SpecStatToggleView` now reads each stat count through an explicit, compile-time-checked
  `Record<SpecFilterKey, keyof ISpecStats>` map rather than relying on the filter keys
  happening to equal the stats field names, so a future rename on either side fails the build.
  The `resolveSpecNodeFolderPath` guard is narrowed to validate that the resolved `folderPath`
  is actually a string before use, so a malformed tree node can no longer flow a non-string
  value downstream; the pure resolver moved to its own `vscode`-free module for isolated unit
  testing. The v0.3.0 incremental update protocol, the v0.1.1 persistent-toolbar focus
  behaviour, the v0.4.0 persisted filter/layout state, and the v0.4.1 ready handshake are all
  preserved.

## [0.4.1] - 2026-11-06

### Fixed

- Show the cached specs immediately when the dashboard view is closed and reopened, instead
  of an empty list that only filled in after a manual Refresh. VS Code disposes and re-creates
  the webview when the view is hidden and shown again, so the reopened document booted with an
  empty DOM and the render posted during resolve raced its script boot and was lost. The
  webview now sends a `ready` handshake once its message listener is wired, and the provider
  replies by re-posting the current cached snapshots (reused from the in-memory cache, with no
  disk re-scan), so a reopened view restores its specs without any manual action. The v0.3.0
  incremental update protocol, the v0.1.1 persistent-toolbar focus behaviour, and the v0.4.0
  persisted filter/layout webview state are all preserved.

## [0.4.0] - 2026-11-06

### Added

- Make the dashboard statistics clickable as additive, multi-select toggle filters: each
  stat (completed, in progress, not started, malformed) is now an accessible button with an
  `aria-pressed` state. Clicking one narrows the list to that status, clicking another adds
  its specs, and clicking an active one removes it; with none active every spec is shown. The
  status filter composes with the existing name search (both apply together) and the active
  set is persisted in the webview state, so it survives a re-render. The decision lives in a
  pure, `vscode`-free filter state machine (`SpecStatusFilter` plus `SpecCardFilter`) that is
  unit- and property-tested; the webview only applies it and performs no extension-host
  round-trip to filter.
- Add a right-click context menu on a spec in the "Specs by Status" tree view to open its
  requirements, design, tasks and notes, and to run its tasks. Entries whose document is
  absent for that spec are hidden, and "Run tasks" is hidden for a malformed spec, driven by
  a tree-item context value computed by a pure helper.

### Changed

- Replace the list/grid view text toggles with representative icons (list rows and grid
  cells). The toggles remain accessible buttons with an `aria-label`, a title tooltip, and an
  `aria-pressed` state reflecting the active layout; the existing toggle behaviour is
  unchanged.

### Fixed

- Enlarge the hit area of the search box clear (×) button. The clickable target was too small
  (it seemed to require hitting a stroke of the cross); the button is now a comfortable target
  (at least 24x24 CSS px with generous padding), keyboard-focusable with a "Clear search"
  label, and clicking anywhere in it clears the query and refocuses the input, preserving the
  v0.1.1 focus behaviour.

## [0.3.0] - 2026-11-06

### Changed

- Update the dashboard incrementally when a single spec changes: the repository now
  emits a fine-grained change delta, the dashboard replaces only the one affected
  spec card (plus the recomputed aggregate), and the explorer refreshes only the
  changed spec and its `.kiro/specs` root. Steady-state editing no longer scales with
  the number of specs in the workspace (previously about 192 ms per edit at 500 specs).
- Ship a leaner dashboard view-model: the per-spec data sent to the webview and retained
  in memory no longer carries the parsed task tree, which the dashboard never rendered.
  `RunTasksCommand` now parses `tasks.md` on demand when you run a spec, cutting retained
  memory and the message payload at large spec counts.
- Bound the file-read concurrency during spec discovery (a default of 12 concurrent reads)
  instead of issuing every read at once, smoothing cold-scan tail latency and file-handle
  pressure on large or remote workspaces. The discovered result is unchanged.

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

[unreleased]: https://github.com/ducks-project/kirospectracker/compare/v0.13.1...HEAD
[0.13.1]: https://github.com/ducks-project/kirospectracker/compare/v0.13.0...v0.13.1
[0.13.0]: https://github.com/ducks-project/kirospectracker/compare/v0.12.0...v0.13.0
[0.12.0]: https://github.com/ducks-project/kirospectracker/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/ducks-project/kirospectracker/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/ducks-project/kirospectracker/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/ducks-project/kirospectracker/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/ducks-project/kirospectracker/compare/v0.7.1...v0.8.0
[0.7.1]: https://github.com/ducks-project/kirospectracker/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/ducks-project/kirospectracker/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/ducks-project/kirospectracker/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/ducks-project/kirospectracker/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/ducks-project/kirospectracker/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/ducks-project/kirospectracker/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/ducks-project/kirospectracker/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/ducks-project/kirospectracker/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/ducks-project/kirospectracker/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/ducks-project/kirospectracker/releases/tag/v0.1.0
