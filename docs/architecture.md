# Architecture

Kiro Spec Tracker is structured in layers to isolate the business logic from the editor
API. The goal: a core that is testable without a VS Code host, portable (web), and a single
boundary with `vscode`.

## Layers

- Core (`core/`): pure logic. Never imports `vscode`. Contains the `tasks.md` parser, the
  tolerant meta reader, the status resolver, the progress calculator, the per-spec stats and
  decoration mappers, the global task-level statistics calculator, the dashboard view
  projectors (card view, stat toggles, layout toggles, folder-filter options and menu), the
  additive status-filter and folder-filter state machines and card-visibility composer, the
  tree-item context-value builder, the HTML escaper and nonce factory, and the immutable value
  objects.
- Ports (`core/ports/` and `adapters/ports/`): interfaces describing what each side needs
  ([IDocumentPolicy](../src/core/ports/IDocumentPolicy.ts),
  [IScheduler](../src/core/ports/IScheduler.ts),
  [IRandomSource](../src/core/ports/IRandomSource.ts),
  [ISpecAgentGateway](../src/core/ports/ISpecAgentGateway.ts),
  [ISpecFileSystem](../src/adapters/ports/ISpecFileSystem.ts),
  [IWorkspaceGateway](../src/adapters/ports/IWorkspaceGateway.ts),
  [ICommandGateway](../src/adapters/ports/ICommandGateway.ts),
  [IAgentErrorReporter](../src/adapters/ports/IAgentErrorReporter.ts)).
- Adapters (`adapters/`): the only layer that imports `vscode`. Implements the ports, reads
  the file system, decorates the explorer, hosts the dashboard webview and the tree view,
  and registers the commands.
- Entry point ([extension.ts](../src/extension.ts)): composition root that wires the
  dependencies and registers everything into `context.subscriptions`.

## Layer diagram

```mermaid
flowchart TD
  subgraph Host["VS Code / Kiro host"]
    EXT["extension.ts (composition root)"]
  end

  subgraph Adapters["adapters/ (imports vscode)"]
    REPO["SpecRepository"]
    DEC["SpecFileDecorationProvider"]
    DASH["SpecDashboardViewProvider"]
    TREE["SpecTreeDataProvider"]
    CMD["commands/*"]
    VFS["VscodeSpecFileSystem"]
    VWG["VscodeWorkspaceGateway"]
    AGT["agent/* (Kiro / Null / Factory)"]
    VCG["VscodeCommandGateway"]
  end

  subgraph Ports["ports (type-only)"]
    ISFS["ISpecFileSystem"]
    IWG["IWorkspaceGateway"]
    IDP["IDocumentPolicy"]
    ISAG["ISpecAgentGateway"]
    ICG["ICommandGateway"]
  end

  subgraph Core["core/ (pure, no vscode)"]
    PARSE["TasksMarkdownParser"]
    META["TasksMetaReader"]
    RES["SpecStatusResolver"]
    PROG["SpecProgressCalculator"]
    FACT["SpecSnapshotFactory"]
    MAPS["SpecDecorationMapper / SpecStatsCalculator / SpecGrouper"]
    GSTATS["GlobalTaskStatsCalculator"]
    HTML["DashboardHtmlBuilder / HtmlEscaper / NonceFactory"]
  end

  EXT --> REPO
  EXT --> DEC
  EXT --> DASH
  EXT --> TREE
  EXT --> CMD
  REPO --> VFS
  REPO --> FACT
  VFS -. implements .-> ISFS
  VWG -. implements .-> IWG
  AGT -. implements .-> ISAG
  VCG -. implements .-> ICG
  EXT --> AGT
  AGT --> VCG
  FACT --> PARSE
  FACT --> META
  FACT --> RES
  FACT --> PROG
  RES -. uses .-> IDP
  DEC --> MAPS
  DASH --> HTML
```

## Task-state model

A parsed task carries a [TaskState](../src/core/model/TaskState.ts) discriminated union, never
a floating bracket literal: `'todo'` (`[ ]`), `'done'` (`[x]`/`[X]`), `'cancelled'` (`[-]`) and
`'inProgress'` (`[~]`). The raw bracket mark is read in exactly ONE place, the pure
`taskStateFromMark` helper, which is the single source of truth for the mapping and is tolerant
(any other character, including a space, maps to `'todo'`). Nothing downstream re-inspects a
`[-]` or `[~]` literal; consumers branch on the `TaskState` value.

Progress and completion are RESOLVED-based: a task is RESOLVED when it is done OR cancelled
(`isResolved`), and a cancelled task counts in BOTH the numerator and the denominator. So
[SpecProgressCalculator](../src/core/status/SpecProgressCalculator.ts) folds done + cancelled
into `requiredDone` / `optionalDone` while also exposing the per-state breakdown (done,
cancelled, in-progress, todo) so the dashboard can render each state distinctly without
re-deriving it. [SpecStatusResolver](../src/core/status/SpecStatusResolver.ts) treats a spec as
`Completed` when every required task is resolved and `FullyCompleted` when every optional task
is resolved too; a spec whose required tasks are all `[-]` (cancelled) therefore resolves to the
Completed badge, exactly like one whose tasks are all `[x]`.

The [GlobalTaskStatsCalculator](../src/core/status/GlobalTaskStatsCalculator.ts) aggregates the
leaf tasks of every spec into a single `IGlobalTaskStats` (done, cancelled, in-progress, todo,
total, and a RESOLVED-based `percentComplete`), walking each tree once and bucketing leaves by
state. These discreet global, task-level statistics sit alongside the existing per-spec stats
and are surfaced in the dashboard. Being pure core, it is gate-covered and host-free.

## Dashboard flow

```mermaid
sequenceDiagram
  participant FS as Workspace files
  participant R as SpecRepository
  participant C as core (parser/resolver/calculator)
  participant D as SpecDashboardViewProvider
  participant W as Webview

  FS-->>R: file change under .kiro/specs (FileSystemWatcher)
  R->>R: re-parse only the affected spec
  R->>C: parse tasks.md, resolve status, compute progress
  C-->>R: ISpecSnapshot (immutable)
  R-->>D: onDidChangeSpecs(SpecChangeDelta)
  D->>D: project the one changed snapshot to ISpecCardView + recompute stats
  D->>W: postMessage(specUpdated: one card + stats)
  W-->>D: postMessage(openDocument / runTasks / search / setLayout)
```

`onDidChangeSpecs` carries a fine-grained `SpecChangeDelta`
([ISpecChangeDelta](../src/core/model/ISpecChangeDelta.ts)): a `specChanged` delta names the
single changed `folderPath`, while a `fullRefresh` delta marks a full rediscovery. On mount
or a `fullRefresh` the provider sends a `render` message carrying every card; on a
`specChanged` it sends an incremental `specUpdated` message carrying only the one
[ISpecCardView](../src/core/model/ISpecCardView.ts) plus the recomputed aggregate stats. The
webview keeps a `Map` of mounted card nodes keyed by `folderPath` and replaces only the
changed node, so a single edit no longer reprocesses or re-renders all N specs.

## Dashboard interactions (filtering, toggles, tree menu)

The dashboard's status filter is a pure, client-side view concern layered over the card
view-models the webview has already received; it never triggers an extension-host round-trip
or a full re-render. The clickable statistics are additive toggle filters backed by the
immutable [SpecStatusFilter](../src/core/status/SpecStatusFilter.ts) state machine (toggle a
key to add it, toggle again to remove it; an empty set shows everything). Card visibility
composes that status filter with the free-text search through
[SpecCardFilter](../src/core/status/SpecCardFilter.ts) (a logical AND). The dashboard also
offers a folder-scoped filter: a search-box folder button opens a menu listing the distinct
spec-owning folders as additive toggles, backed by the immutable
[SpecFolderFilter](../src/core/status/SpecFolderFilter.ts) state machine, which mirrors
`SpecStatusFilter` but keys on the stable owning-folder identity (the workspace folder path)
rather than the display basename, so two folders sharing a basename stay distinct.
`SpecCardFilter` now composes all three criteria (status AND folder AND search). The distinct
folder options (key, display label and per-folder count) are computed once over the cards by
the pure [computeFolderOptions](../src/core/status/SpecFolderOptions.ts) helper (O(n), no
per-task work), and the menu items with their pressed state by the pure
[SpecFolderToggleView](../src/core/status/SpecFolderToggleView.ts). The header status toggles
and their pressed state are projected by the pure
[SpecStatToggleView](../src/core/status/SpecStatToggleView.ts), and the single flipping
list/grid layout button by [SpecLayoutToggleView](../src/core/status/SpecLayoutToggleView.ts)
(`describeToggle` returns the glyph of the layout the button switches to, its label and its
pressed state). The webview only renders the decision and persists the active status-filter
keys, folder-filter keys and layout in its own `setState`. Keeping the state machines and the
mappings in `core/` makes the least-covered DOM/CSS layer thin and the logic unit- and
property-testable without a VS Code host.

Each spec card is itself a view over the card view-model: its body is a keyboard-accessible
button reusing the existing `openDocument` intent to open the spec's entry document (a
disabled no-op when none exists), and its inner controls stop click propagation so only the card
background is the open gesture. The status shown on the card is a clickable badge that toggles
the same [SpecStatusFilter](../src/core/status/SpecStatusFilter.ts) as its matching toolbar
stat toggle, so the two surfaces stay in sync. The state-representative badge colors come from
the single [SpecStatusColor](../src/core/status/SpecStatusColor.ts) mapping (keyed by filter
key and shared by both surfaces), bound to VS Code theme color variables in CSS so they
respect light and dark themes. The discreet owning-folder label on each card is derived by the
pure [deriveSpecOwnerLabel](../src/core/status/SpecOwnerLabel.ts) helper and is itself a
clickable toggle button driving the same [SpecFolderFilter](../src/core/status/SpecFolderFilter.ts)
as the search-box folder menu (keyed on the card's stable `folderKey`), so the label and the
menu stay in sync; it carries an `aria-pressed` state and stops click propagation so it never
also opens the card. All of these are client-side over the received view-models: they trigger
no extension-host round-trip beyond the existing openDocument intent and no full re-render
beyond the existing filter re-render.

The "Specs by Status" tree view contributes a declarative `view/item/context` menu (open
requirements/design/tasks/notes, plus the agent actions Sync Files / Run required tasks / Run
required and optional tasks). Each spec tree item carries a `contextValue` built by the pure
[buildSpecTreeContextValue](../src/core/status/SpecTreeContextValue.ts): a `spec` base token,
one `doc-<kind>` token per present document, and the three agent-action tokens (`agent-sync`,
`agent-run-required`, `agent-run-optional`) for a non-malformed spec. The package.json `when`
clauses match these tokens with regular expressions, so an action whose document is absent is
hidden and the task actions are hidden for a malformed spec; a separator keeps the document
actions apart from the task actions. The open commands are thin, tree-item-aware wrappers over
the existing `OpenDocumentCommand`, while the three task-action commands call the SAME
[SpecAgentActions](../src/adapters/SpecAgentActions.ts) the dashboard buttons use, so no
behaviour is duplicated.

## Run-tasks flow (MVP)

```mermaid
sequenceDiagram
  participant U as User
  participant X as RunTasksCommand
  participant G as IWorkspaceGateway
  participant P as RunPromptBuilder (core)

  U->>X: "Run tasks" (dashboard / explorer / palette)
  X->>X: guard: refuse a Malformed spec
  X->>G: open tasks.md
  X->>U: ask for consent to copy a prompt
  alt consent granted
    X->>X: read + parse tasks.md on demand (ISpecFileSystem + TasksMarkdownParser)
    X->>P: build the ready-to-paste prompt from the pending leaf tasks
    P-->>X: prompt text
    X->>G: write to clipboard
  end
```

Since 0.3.0 the snapshot no longer caches the parsed task tree, so `RunTasksCommand` parses
`tasks.md` on demand through the `ISpecFileSystem` port and `TasksMarkdownParser` when the
user actually runs a spec, then derives the pending leaf titles for the prompt. It is the
only consumer of the full task tree, which keeps the retained dashboard data lean.

## Agent actions flow (Sync Files / Run tasks)

The agent-driven Sync Files and Run tasks actions are modelled as an intent-level, pure port
[ISpecAgentGateway](../src/core/ports/ISpecAgentGateway.ts) with three members
(`availability`, `syncTasks`, `runTasks`). The core and the webview depend only on this port
and on the fixed message templates in
[SpecAgentMessages](../src/core/SpecAgentMessages.ts) (only the spec name is interpolated, a
security property: no instruction is built from untrusted free text). They never reference
any `kiroAgent.*` command, the clipboard, or focus timing.

Both UI entry points route through one shared implementation
[SpecAgentActions](../src/adapters/SpecAgentActions.ts): the dashboard delegates its typed
`syncFiles` / `runTasks` (with a scope) `postMessage` intents through
[IDashboardActions](../src/adapters/ports/IDashboardActions.ts), and the tree context-menu
commands (`kirospectracker.tree.syncFiles`, `.runRequired`, `.runRequiredAndOptional`) resolve
the targeted spec from the node argument. Each entry point resolves a `folderPath`, looks the
cached [ISpecSnapshot](../src/core/model/ISpecSnapshot.ts) up from `SpecRepository`, and calls
exactly one gateway method (DRY).

```mermaid
flowchart TD
  DASH["Dashboard split button + Sync Files"] --> ACT["SpecAgentActions (shared)"]
  TREE["Tree context menu"] --> ACT
  ACT --> PORT["ISpecAgentGateway (port)"]
  PORT -. Strategy .-> KIRO["KiroChatAgentGateway (best-effort)"]
  PORT -. Strategy .-> NULL["UnavailableAgentGateway (Null Object)"]
  KIRO --> VCG["VscodeCommandGateway (thin, vscode)"]
  NULL --> RTC["RunTasksCommand (honest MVP)"]
  FACT["SpecAgentGatewayFactory"] -. selects .-> KIRO
  FACT -. selects .-> NULL
```

The concrete gateway is chosen once in the composition root by
[SpecAgentGatewayFactory](../src/adapters/agent/SpecAgentGatewayFactory.ts): it probes
`getCommands(true)` through the thin
[VscodeCommandGateway](../src/adapters/VscodeCommandGateway.ts) and, when the integration is
enabled and a `kiroAgent.*` (or the generic `workbench.action.chat.open`) surface is present,
builds [KiroChatAgentGateway](../src/adapters/agent/KiroChatAgentGateway.ts); otherwise, or
when the integration is disabled, it binds the Null-Object
[UnavailableAgentGateway](../src/adapters/agent/UnavailableAgentGateway.ts). The gateway starts
on the always-valid Null Object and is upgraded once detection resolves, so the UI works from
the first tick and never needs an `if (gateway)` guard.

`KiroChatAgentGateway` is the single containment point for all fragility: it knows the
undocumented `kiroAgent.*` ids and the generic chat-open fallback. For each send it builds the
fixed message, then runs a capability-probed, cascading try/catch chain ordered by robustness,
each step guarded by a `getCommands(true)` membership check and wrapped so any throw falls
through to the next:

1. `kiroAgent.sessions.create` + activate + foreground + `kiroAgent.sessions.sendPrompt` — open a
   NEW session, **activate** it so it becomes the visible chat (prefer `kiroAgent.sessions.switch`,
   which returns `{ accepted }`, else the best-effort `kiroAgent.viewSession`), bring the chat view
   to the **foreground** with `kiroAgent.chatView.focus`, then **fire-and-forget**
   `kiroAgent.sessions.sendPrompt` (positional `sessionId, prompt`) so the "sent" toast is
   immediate rather than delayed to end-of-turn. It proceeds only when `create` returns a non-empty
   string `sessionId` (otherwise `sendPrompt` silently no-ops), falling through otherwise.
   Activation and focus are best-effort: a throw or `accepted: false` never aborts the send, and a
   fire-and-forget `sendPrompt` rejection is swallowed into the diagnostic sink. → notify "sent"
   (or, when no activation command exists, "sent — open it from Session History if it did not come
   to the front").
2. `kiroAgent.focusChatInput({ prompt, submit: true, newSession: true })` — UI submit in a new
   session (best-effort; depends on the chat webview being rendered). → notify "sent".
3. `kiroAgent.focusChatInput({ prompt })` — fill only, no submit. → notify "press Enter".
4. `workbench.action.chat.open` — the generic host fallback. → notify "you may need to send it".
5. none → the error reporter path.

A failure is surfaced through the
[IAgentErrorReporter](../src/adapters/ports/IAgentErrorReporter.ts) channel and never thrown to
the UI. The dispatch logic lives in this adapter and is unit-tested against a fake
[ICommandGateway](../src/adapters/ports/ICommandGateway.ts) (whose `executeCommand<T>` returns
the `sessions.create` result the preferred path narrows with a type guard); only the raw
`vscode` calls live in the excluded thin wrapper.

Context attach rides the same dispatch chain rather than adding a command. The pure, `vscode`-free
[SpecAgentContext](../src/core/SpecAgentContext.ts) composes the submitted prompt as an in-prompt
folder reference token on its own line followed by the fixed template
(`#[[folder:<specFolderFsPath>]]\n<template>`, the folder path taken from the snapshot's
`folderPath`), mirroring the reference shape Kiro resolves. Kiro parses that token out of the
prompt text and attaches the spec folder as context on both the `sendPrompt` path and the
`focusChatInput` fallbacks, so the agent acts on the right spec. `kiroAgent.selectFilesAsContext`
is **not** used: it only seeds the chat input box, which the programmatic `sendPrompt` ignores, so
the token-in-text approach supersedes it. The attach degrades gracefully: when no spec folder path
is available the plain template is sent without any token, preserving the no-context submit. The
concise diagnostic line records whether context was attached (`context=yes|no`) and a COUNT of the
detected `kiroAgent.*` commands rather than the full id list (see
`.kiro/steering/kiro-agent-commands.md`).

A future official Kiro API or another spec-driven IDE becomes just another adapter plus a
factory branch, with no change to the core, the UI wiring, the message templates, or the DRY
action path.

## Agent integration beta notice

On activation, when the integration is enabled and not yet acknowledged, the extension shows a
one-time, non-modal `window.showInformationMessage` toast (the native, stable API — the notice
itself is not fragile, only the Sync/Run actions it describes are best-effort). The pure
[AgentBetaNoticeDecider](../src/core/AgentBetaNoticeDecider.ts) owns the decision logic (given
`enabled?` and `acknowledged?`, whether to show; and which effect a choice maps to), while the
thin [VscodeAgentBetaNotice](../src/adapters/VscodeAgentBetaNotice.ts) adapter reads the
setting and the `globalState` flag, shows the toast, and applies the effect: "Keep enabled"
persists the acknowledgement (never shows again), "Disable" turns off the
`kirospectracker.agentIntegration.enabled` setting (the Null Object takes over), "Settings"
opens the extension settings, and dismissing with the close affordance persists nothing (the
notice reappears next launch while the integration stays enabled).

## Patterns

- Dependency Inversion: the core depends on ports (`IDocumentPolicy`, `IScheduler`,
  `IRandomSource`), and the adapters implement the file-system and workspace ports. The
  core never references a concrete adapter.
- Tolerant parsing: [TasksMarkdownParser](../src/core/parsing/TasksMarkdownParser.ts) and
  [TasksMetaReader](../src/core/parsing/TasksMetaReader.ts) never throw on bad input; they
  skip unparseable lines and return an empty meta on invalid JSON.
- Immutable value objects: [ISpecSnapshot](../src/core/model/ISpecSnapshot.ts) is the plain,
  serializable contract that crosses both the layer boundary and the `postMessage` boundary,
  so the webview holds no `vscode` object and the core holds no webview state.
- Single-responsibility helpers: badge/color/tooltip, stats, grouping, HTML/CSP/nonce and
  prompt building each live in their own pure core class, kept out of the host-only
  providers.
- Observer with a fine-grained payload: `SpecRepository.onDidChangeSpecs` notifies its
  listeners with a `SpecChangeDelta` ([ISpecChangeDelta](../src/core/model/ISpecChangeDelta.ts))
  rather than a payloadless "something changed" signal, so the dashboard and the decoration
  providers react to only the changed spec instead of reprocessing the whole workspace.
- DTO / view-model projection: [SpecCardViewMapper](../src/core/status/SpecCardViewMapper.ts)
  projects a full [ISpecSnapshot](../src/core/model/ISpecSnapshot.ts) onto the lean
  [ISpecCardView](../src/core/model/ISpecCardView.ts) the webview consumes, dropping the task
  tree so each `postMessage` payload stays small and deriving the card's owner label via
  [deriveSpecOwnerLabel](../src/core/status/SpecOwnerLabel.ts).
- Bounded-concurrency iterator: [mapWithLimit](../src/core/BoundedMap.ts) is a pure,
  order-preserving worker-pool used by `SpecRepository` discovery to cap the number of
  in-flight spec reads, smoothing cold-scan tail latency and file-handle pressure without
  changing the result.
- Immutable state machine: [SpecStatusFilter](../src/core/status/SpecStatusFilter.ts) models
  the additive status-filter selection as an immutable value object (every toggle returns a
  new instance); [SpecFolderFilter](../src/core/status/SpecFolderFilter.ts) models the
  folder-scoped selection the same way, keyed on the stable owning-folder identity. Both are
  composed with the search by [SpecCardFilter](../src/core/status/SpecCardFilter.ts) (status
  AND folder AND search). The pure decision is unit- and property-tested, and the webview DOM
  only applies it.
- Strategy / Adapter / Null Object / Factory for the agent actions:
  [ISpecAgentGateway](../src/core/ports/ISpecAgentGateway.ts) is the strategy interface;
  [KiroChatAgentGateway](../src/adapters/agent/KiroChatAgentGateway.ts) adapts the messy
  command/clipboard surface and is the single containment point for fragility;
  [UnavailableAgentGateway](../src/adapters/agent/UnavailableAgentGateway.ts) is the Null
  Object that removes `if (gateway)` guards from the UI and degrades to the honest MVP; and
  [SpecAgentGatewayFactory](../src/adapters/agent/SpecAgentGatewayFactory.ts) selects the
  strategy at runtime by capability detection, honoring the disable setting. The three fixed
  message strings live once in [SpecAgentMessages](../src/core/SpecAgentMessages.ts) (data
  table + DRY).

## Security boundary

- Only `adapters/` and `extension.ts` import `vscode`; `core/` is pure and portable.
- The dashboard webview uses a strict Content Security Policy with a per-render nonce, loads
  only local bundled resources, and renders untrusted spec text as plain text.
- No network, no telemetry, no evaluation of spec or configuration content as code.
- The agent actions invoke only host commands discovered via `getCommands`, and only with
  fixed message templates whose sole interpolated value is the already-trusted spec folder
  name (plus the session id returned by `sessions.create`). The honest fallback keeps its
  explicit consent prompt. The new `vscode`-touching surfaces are the thin
  [VscodeCommandGateway](../src/adapters/VscodeCommandGateway.ts) and
  [VscodeAgentBetaNotice](../src/adapters/VscodeAgentBetaNotice.ts) wrappers; the beta notice
  uses the native, stable `window.showInformationMessage` API.

## Entry document resolution

The document opened on card click, and read for the hover introduction, is resolved once per
snapshot on the host. The undocumented `.config.kiro` is isolated behind the
[ISpecConfigReader](../src/core/ports/ISpecConfigReader.ts) port (adapter `KiroSpecConfigReader`,
Null Object `NullSpecConfigReader`), parsed tolerantly by the pure `parseSpecConfig`, and mapped to
a document by the [EntryDocumentResolver](../src/core/EntryDocumentResolver.ts), a Strategy over the
ordered `ENTRY_DOCUMENT_RULES` table with a `requirements → design → tasks` fallback. The result is
`ISpecSnapshot.entryDocument`, projected to `ISpecCardView.entryDocument`, so the webview decides
click and hover locally with no extra message or per-render disk read. The document kinds live in
one registry (`SPEC_DOCUMENT_KINDS`). `SpecIntroductionLoader` caches per resolved file path and is
invalidated from the repository change events; the webview drops a card's hover cache on
`specUpdated`.
