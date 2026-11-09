# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- The agent actions now attach the spec folder as chat context so the agent acts on the right
  spec instead of asking "which spec?". `KiroChatAgentGateway` composes the submitted prompt as
  an in-prompt folder reference token followed by the fixed template (the pure, `vscode`-free
  `composeMessageWithFolderContext` builds `#[[folder:<specFolderFsPath>]]` on its own line, then
  the template), mirroring how Kiro's own context references are shaped; Kiro parses that token
  out of the prompt text and resolves it to the spec folder on both the `kiroAgent.sessions.sendPrompt`
  path and the `kiroAgent.focusChatInput` fallbacks. `kiroAgent.selectFilesAsContext` is not used:
  it only seeds the chat input box, which the programmatic `sendPrompt` ignores. The attach
  degrades gracefully: when no spec folder path is available the plain template is sent without
  any token, so the prior submit behaviour is preserved and the send is never blocked. The
  create + activate + `chatView.focus` + fire-and-forget `sendPrompt` sequence is otherwise
  unchanged.
- The agent diagnostic line is now a concise single line. Instead of logging the entire detected
  `kiroAgent.*` id list on every action, it records the dispatch path, the activation kind, the
  fire-and-forget send mode, whether the spec folder was attached as context (`context=yes|no`), a
  COUNT of detected `kiroAgent.*` commands (`kiroAgentCommandCount=NNN`) and whether the generic
  chat-open command exists, still in the "Kiro Spec Tracker" output channel.
- The agent actions now activate and bring the new Kiro chat session to the foreground, and the
  confirmation toast is immediate. After creating the session with `kiroAgent.sessions.create`,
  `KiroChatAgentGateway` activates it (preferring `kiroAgent.sessions.switch`, which reports
  `{ accepted }`, and falling back to the best-effort `kiroAgent.viewSession`) and foregrounds the
  chat view with `kiroAgent.chatView.focus`, both guarded by the capability probe and wrapped so a
  failure never aborts the send. It then dispatches `kiroAgent.sessions.sendPrompt` fire-and-forget
  (the command resolves only at end-of-turn) and shows the "sent to Kiro chat" toast right away
  instead of after the agent finishes, removing the multi-second delay. When no activation command
  is available the prompt is still sent, and the toast says the session may have opened in Session
  History. The diagnostic line now records how the session was activated (`activation=switch`,
  `viewSession` or `none`) and that the submission was fire-and-forget.
- The agent actions (Sync Files, Run required tasks, Run required and optional tasks) now open
  a new Kiro chat session and submit the templated prompt on supported builds, instead of only
  opening the chat for a manual send. `KiroChatAgentGateway` runs a capability-probed,
  cascading try/catch dispatch chain ordered by robustness: it first creates a fresh session
  with `kiroAgent.sessions.create` and truly submits the prompt with
  `kiroAgent.sessions.sendPrompt` (positional `sessionId, prompt`), which starts the agent run;
  it proceeds only when `create` returns a non-empty session id, otherwise it falls through. The
  graceful fallbacks are, in order: `kiroAgent.focusChatInput({ submit: true, newSession: true })`
  (UI submit in a new session), `kiroAgent.focusChatInput({ prompt })` (fill only — the user
  presses Enter), and the generic `workbench.action.chat.open`. Feedback stays honest per path:
  a submitting path confirms the prompt was sent; the fill-only path says to press Enter; the
  generic fallback says the chat was opened and may still need to be sent; and when no usable
  command exists the error toast fires. The legacy, absent-on-target-builds command ids
  (`kiroAgent.executions.queueUserMessage`, `kiroAgent.sendMainUserInput`,
  `kiroAgent.focusContinueInput`) and the clipboard-paste workaround were removed as dead code.

### Added

- Add an observability diagnostic for the agent actions: each action appends one concise line to
  a "Kiro Spec Tracker" output channel recording a COUNT of detected `kiroAgent.*` commands,
  whether the generic chat-open command was found, and which dispatch path was taken
  (`create+sendPrompt`, `focusInput-submit`, `focusInput-fill`, `chat-open` or `none`). The
  dispatch logic stays unit-tested in the `vscode`-free adapter; only the output channel lives
  in a thin, host-only `Vscode*` wrapper. Read it via View → Output → "Kiro Spec Tracker" to
  see what your Kiro host actually exposes and which path your build took.

## [0.7.0] - 2026-11-08

### Added

- Drive the agent-driven Sync Files and Run tasks actions from the dashboard cards and the
  "Specs by Status" tree context menu, wired through an intent-level `ISpecAgentGateway` port
  (pure, in core) so the core and UI never reference any editor command. A
  `KiroChatAgentGateway` adapter confines every fragile detail (the undocumented `kiroAgent.*`
  commands, the generic chat-open fallback, the focus/paste timing, and the clipboard
  workaround) and always restores the prior clipboard around a paste; an
  `UnavailableAgentGateway` Null-Object fallback degrades both actions to the honest MVP (open
  `tasks.md` and offer a consented, ready-to-paste prompt); and a capability-detection factory
  (`getCommands(true)`) selects the adapter at runtime. "Sync Files" sends
  `Update the tasks for the {spec name}`, "Run required tasks" sends `Run all required tasks`,
  and "Run required and optional tasks" sends `Run required and optional tasks`; the fixed
  message templates interpolate only the spec name. Both UI entry points call one shared
  implementation behind the port (DRY). The integration relies on non-official, unstable
  editor command surfaces and degrades gracefully when they are absent; there is no stable way
  to attach the spec as structured chat context or to guarantee a new chat session, so the
  spec name is interpolated into the message text as the best available approximation.
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

[unreleased]: https://github.com/ducks-project/kirospectracker/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/ducks-project/kirospectracker/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/ducks-project/kirospectracker/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/ducks-project/kirospectracker/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/ducks-project/kirospectracker/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/ducks-project/kirospectracker/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/ducks-project/kirospectracker/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/ducks-project/kirospectracker/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/ducks-project/kirospectracker/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/ducks-project/kirospectracker/releases/tag/v0.1.0
