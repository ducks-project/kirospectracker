# Kiro Spec Tracker

[![CI](https://github.com/ducks-project/kirospectracker/actions/workflows/ci.yml/badge.svg)](https://github.com/ducks-project/kirospectracker/actions/workflows/ci.yml)
[![CodeQL](https://github.com/ducks-project/kirospectracker/actions/workflows/codeql.yml/badge.svg)](https://github.com/ducks-project/kirospectracker/actions/workflows/codeql.yml)
[![codecov](https://codecov.io/gh/ducks-project/kirospectracker/branch/main/graph/badge.svg)](https://codecov.io/gh/ducks-project/kirospectracker)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Open VSX Version](https://img.shields.io/open-vsx/v/ducks-project/kirospectracker)](https://open-vsx.org/extension/ducks-project/kirospectracker)
[![Open VSX Downloads](https://img.shields.io/open-vsx/dt/ducks-project/kirospectracker)](https://open-vsx.org/extension/ducks-project/kirospectracker)

Kiro Spec Tracker reads the [Kiro](https://kiro.dev) specs in your workspace
(`.kiro/specs/<name>/`) and surfaces their progress across the IDE: status badges in the
file explorer, a dedicated dashboard in the activity bar, and quick entry points to open
or run a spec. It is read-only, fully local, and ships no telemetry and no network calls.

## Table of contents

- [Features](#features)
- [Screenshots](#screenshots)
- [How progress is computed](#how-progress-is-computed)
- [Agent actions (beta)](#agent-actions-beta)
- [Usage](#usage)
- [Settings](#settings)
- [Security and privacy](#security-and-privacy)
- [Requirements](#requirements)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Explorer decorations** — each spec folder under `.kiro/specs/` and the `.kiro/specs/`
  folder itself gets a short status badge, a theme color, and a tooltip summarizing its
  required and optional progress.
- **Dashboard view** — a dedicated activity-bar webview listing every spec with its status,
  a required-progress bar and percentage, the optional progress shown separately, a search
  box, and icon-based list or grid layouts. The aggregate statistics are additive toggle
  filters: click one or more to narrow the list by status, and they compose with the search
  box. A folder filter button on the search box opens a menu of the folders (projects) that
  contain specs, and the owning-folder label on each card is clickable, to scope the list to
  one or more folders; the folder filter composes with the status filter and the search too. A
  discreet global strip reports task-level statistics across all specs (done,
  cancelled, in-progress and to-do counts, plus an overall resolved percentage). Completed
  specs are set apart but stay visible. Each spec links to its `requirements.md`, `design.md`,
  `tasks.md`, `notes.md` and `bugfix.md` when present. Clicking a card (and hovering it for
  the introduction preview) uses the spec's _entry document_, read from its `.config.kiro`:
  `specType: bugfix` opens `bugfix.md`, else `workflowType: design-first` opens `design.md`,
  else `requirements.md`. When `.config.kiro` is absent, unreadable or has unknown values, or
  the resolved document is missing, the first present of `requirements.md`, `design.md`,
  `tasks.md` is used. The `.config.kiro` format is not publicly documented by Kiro, so this is
  best-effort and isolated behind a dedicated port.
- **Specs-by-status tree** — a lightweight activity-bar tree grouping specs by status for
  quick navigation, with a right-click context menu to open a spec's documents or run its
  tasks.
- **Run tasks (honest MVP)** — from the explorer context menu on a spec folder or the
  Command Palette, open a spec's `tasks.md` and, only with your explicit consent, copy a
  ready-to-paste execution prompt to the clipboard.
- **Agent actions (beta, best-effort)** — from the dashboard cards (a "Sync Files" button and
  a "Run tasks" split button) and the "Specs by Status" tree context menu, ask the editor's
  chat agent to update or run a spec's tasks. See
  [Agent actions (beta)](#agent-actions-beta) for scope and limitations.

## Screenshots

The activity-bar dashboard with per-spec status, progress bars and statistics:

![Kiro Spec Tracker dashboard showing specs grouped by status with required and optional progress bars](media/screenshots/dashboard.png)

Status badges applied to spec folders in the file explorer:

![File explorer showing status badges on spec folders under .kiro/specs](media/screenshots/explorer-decorations.png)

## How progress is computed

A spec lives in `.kiro/specs/<name>/` and must contain a `tasks.md`. Task status is read
only from the checkbox mark in `tasks.md`, across four states: `- [ ]` (to-do), `- [x]`
(done), `- [-]` (cancelled), and `- [~]` (in-progress). A **cancelled** task counts as
**resolved** (done or cancelled), so it progresses a spec exactly like a done task; the
transient in-progress state is shown distinctly but does not count as resolved. A task is
**optional** when an asterisk is glued to its checkbox (`- [ ]* 1.2`); the word "optional" in
prose is never treated as a marker. Only leaf tasks are counted, so a parent is never
double-counted with its sub-tasks.

The extension exposes two **separate** progress ratios, never merged into one number:
required (`required resolved / required total`) and optional (`optional resolved / optional
total`), where "resolved" means done or cancelled. Each spec resolves to one of five states:

| State            | Meaning                                                                 |
| ---------------- | ----------------------------------------------------------------------- |
| `Malformed`      | `tasks.md` is missing or unreadable, or a required document is absent   |
| `NotStarted`     | `tasks.md` is present and no task is resolved or in progress            |
| `InProgress`     | at least one task resolved or in progress, but not all required tasks   |
| `Completed`      | all required tasks resolved, done or cancelled (optional tasks ignored) |
| `FullyCompleted` | all required and all optional tasks resolved (done or cancelled)        |

The full model is documented in the project steering file `kiro-spec-format.md`.

## Agent actions (beta)

The dashboard cards and the "Specs by Status" tree context menu offer three agent actions
that ask the editor's chat agent (such as Kiro) to act on a spec:

- **Sync Files** — sends `Update the tasks for the {spec name}` to the chat.
- **Run required tasks** — sends `Run all required tasks`.
- **Run required and optional tasks** — sends `Run required and optional tasks`.

These actions are **best-effort and in beta**. There is no official, stable editor command
for driving a chat agent, so the integration uses non-official command surfaces and may
change or stop working on an editor update. It degrades gracefully: when no usable command
surface is detected (or when you disable the integration), the same actions fall back to the
honest MVP, opening the spec's `tasks.md` and offering a consented, ready-to-paste prompt.

Two things are not achievable through a stable contract and are approximated: attaching the
spec as structured chat context, and guaranteeing a brand-new chat session. The spec name is
interpolated into the message text as the best available disambiguator.

Every action gives honest, visible feedback: a confirmation toast when the prompt is sent
directly, a "pasted — press Enter to run it" toast when only the focus + clipboard-paste
workaround is available, an "opened the chat — you may need to send it" toast for the generic
chat fallback, and an error toast when no usable command exists. Each action also writes a
diagnostic line to the **"Kiro Spec Tracker" output channel** (View → Output → "Kiro Spec
Tracker") naming the detected `kiroAgent.*` command ids and which dispatch path was taken; use
it to see what your editor actually exposes when an action behaves unexpectedly.

On first activation (while the integration is enabled) a one-time, non-modal notice explains
this and lets you keep it enabled, disable it, or open the settings. You can enable or disable
the integration at any time with the `kirospectracker.agentIntegration.enabled` setting; when
disabled, the actions use the honest fallback described above.

## Usage

1. Open a workspace that contains one or more `.kiro/specs/<name>/` folders.
2. Open the **Kiro Spec Tracker** view from the activity bar to see the dashboard.
3. Browse the file explorer to see per-spec status badges.
4. Use the Command Palette (`Kiro Spec Tracker: ...`) or the explorer context menu on a
   spec folder to refresh, toggle the dashboard layout, or run a spec's tasks.

## Settings

The extension works with no configuration.

- `kirospectracker.agentIntegration.enabled` (boolean, default `true`) — enable the
  best-effort agent integration driving the Sync Files and Run tasks actions through the
  editor's chat agent. When disabled, those actions degrade to opening `tasks.md` and offering
  a consented, ready-to-paste prompt. See [Agent actions (beta)](#agent-actions-beta).

Other behaviors, such as which documents make a spec `Malformed`, are documented in the
extension's contribution points.

## Security and privacy

- No network request, no telemetry.
- Spec content is treated as untrusted data and never evaluated as code.
- The dashboard webview enforces a strict Content Security Policy with a per-render nonce,
  loads only local bundled resources, and renders spec text as plain text.

See [PRIVACY.md](PRIVACY.md) for details.

## Requirements

- An IDE compatible with the VS Code extension API (VS Code `^1.85.0`), such as Kiro.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, conventions,
tests, and the pull request process.

## License

[MIT](LICENSE) © ducks-project
