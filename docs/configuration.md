# Configuration

Kiro Spec Tracker works with no configuration. This page lists every setting, and explains
in detail what the opt-in "hide specs by status" feature writes to your workspace settings.

## Table of contents

- [Settings reference](#settings-reference)
- [Hide specs by status](#hide-specs-by-status)
- [Which surfaces are affected](#which-surfaces-are-affected)
- [What is written, and where](#what-is-written-and-where)
- [Ownership and cleanup rules](#ownership-and-cleanup-rules)
- [Spec names with special characters](#spec-names-with-special-characters)
- [Known side effects and limits](#known-side-effects-and-limits)

## Settings reference

| Setting                                    | Type               | Default                                 | Scope  | Values                                    |
| ------------------------------------------ | ------------------ | --------------------------------------- | ------ | ----------------------------------------- |
| `kirospectracker.agentIntegration.enabled` | boolean            | `true`                                  | window | `true` or `false`                         |
| `kirospectracker.hideSpecs.mode`           | string (enum)      | `off`                                   | window | `off`, `searchAndQuickOpen`, `everywhere` |
| `kirospectracker.hideSpecs.statuses`       | object of booleans | `Completed` and `FullyCompleted` ticked | window | one boolean per status, see below         |

### kirospectracker.agentIntegration.enabled

Enables the best-effort agent integration driving the Sync Files and Run tasks actions
through the editor's chat agent. When disabled, those actions degrade to opening `tasks.md`
and offering a consented, ready-to-paste prompt. See
[Agent actions (beta)](../README.md#agent-actions-beta).

### kirospectracker.hideSpecs.mode

Chooses where the selected specs are hidden. The default `off` never hides anything and never
writes to any exclusion setting.

| Value                | Writes to        | Effect                                                                    |
| -------------------- | ---------------- | ------------------------------------------------------------------------- |
| `off`                | nothing          | Nothing is hidden. Entries previously added by the extension are removed. |
| `searchAndQuickOpen` | `search.exclude` | Hidden from Search and Quick Open. The Explorer is unchanged.             |
| `everywhere`         | `files.exclude`  | Hidden from the Explorer, Search and Quick Open.                          |

There is deliberately no "Quick Open only" or "Explorer only" value: the editor offers no
setting for them (see [Which surfaces are affected](#which-surfaces-are-affected)).

### kirospectracker.hideSpecs.statuses

One checkbox per spec status in the Settings UI. A spec is hidden when its status is ticked.

| Key              | Default | Meaning                                                 |
| ---------------- | ------- | ------------------------------------------------------- |
| `Malformed`      | `false` | `tasks.md` is missing, or a required document is absent |
| `NotStarted`     | `false` | No task is done yet                                     |
| `InProgress`     | `false` | Some tasks are done, required tasks remain              |
| `Completed`      | `true`  | Every required task is done                             |
| `FullyCompleted` | `true`  | Every required and optional task is done                |

The checkbox descriptions are translated, but the keys above are identifiers and are never translated.

In `settings.json` the same setting is a plain object, and a missing key keeps its default:

```json
{
  "kirospectracker.hideSpecs.mode": "everywhere",
  "kirospectracker.hideSpecs.statuses": {
    "Completed": true,
    "FullyCompleted": true,
    "InProgress": false
  }
}
```

The Settings UI renders an object setting as checkboxes when its schema is `type: object`
with a non-empty `properties` map whose entries are all `type: boolean`, and
`additionalProperties` is `false` (VS Code `settingsTreeModels.ts` and `preferencesModels.ts`,
`allKeysAreBoolean`; the same logic is present in the Kiro workbench bundle). The manifest uses
exactly this shape. A unit test keeps the keys in `package.json` identical to the `SpecStatus`
enum, so a future status is a localized, additive change: add the enum member and the manifest
entry.

## Hide specs by status

When the mode is not `off`, the extension keeps the exclusion settings of each workspace
folder in line with the specs whose status is ticked. It reacts to spec changes (a spec
completing, being deleted, and so on) and to changes of the two settings above, debounced and
idempotent: nothing is written when the settings already match, and each exclusion setting of
a folder is updated at most once per run.

The first time entries are written, a non-blocking notification reports how many specs were
hidden and offers a button to open the settings file. It is not repeated afterwards.

Hiding applies while the extension is active. It activates when you open the Kiro Spec
Tracker view or run one of its commands.

The command **Kiro Spec Tracker: Reset Hidden Specs** (command palette) removes every entry
the extension wrote. While the mode is not `off`, entries come back at the next spec or
configuration change; set the mode to `off` to stop hiding.

## Which surfaces are affected

Measured against the VS Code source (tag 1.104.0), also present in the Kiro workbench:

| Surface                      | `files.exclude`    | `search.exclude`   |
| ---------------------------- | ------------------ | ------------------ |
| Explorer                     | hidden             | unchanged          |
| Search view (files and text) | hidden             | hidden             |
| Quick Open (file list)       | hidden             | hidden             |
| Quick Open (recent history)  | hidden, and purged | hidden, and purged |

Because Quick Open follows Search, and `files.exclude` covers both, only three combinations
exist: nothing, Search plus Quick Open, or everywhere.

The extension's own discovery is not affected: it reads specs through `workspace.fs`, which
ignores the exclusion settings, and its file watcher is filtered by `files.watcherExclude`
only. Specs stay in the dashboard, the tree view and the Explorer badges' data. The invariant
is guarded by a unit test: the source must never call `findFiles`, `findFiles2` or
`findTextInFiles`, since `findFiles` applies `files.exclude` even when an explicit exclude is
passed (only `null` disables it).

Neither `.kiro` nor `.kiro/specs` is ever hidden, only individual spec folders.

## What is written, and where

- Target: the settings of the **workspace folder** (`ConfigurationTarget.WorkspaceFolder`),
  that is `<folder>/.vscode/settings.json`. Each folder of a multi-root workspace gets its own
  entries.
- Glob: `**/.kiro/specs/<name>/**`, one per hidden spec, with the value `true`.
- The `/**` suffix matters: the Quick Open history is matched against file paths, so a bare
  folder glob would leave history entries of the hidden spec in place, and a hidden spec would
  be matched on its folder but not on its files. The suffix also matches the folder itself.
- The extension reads the folder's **own** value (`inspect().workspaceFolderValue`), never the
  merged value, so defaults and your user settings are never copied into the project file.
  The whole object is replaced in a single update, because that is how the API writes.

Example after hiding a completed spec named `my-feature` with the mode `everywhere`:

```json
{
  "files.exclude": {
    "**/.kiro/specs/my-feature/**": true
  }
}
```

## Ownership and cleanup rules

A boolean entry carries no metadata, so the extension records the keys it added in the
workspace state (per folder and per setting).

- A key is added only if it is **absent** from the folder's value. A key already present
  belongs to you and is never modified or removed, even if it matches a spec.
- Only keys the extension recorded are removed, and only when no longer wanted: the status
  changed, the spec was deleted, the status was unticked, or the mode changed.
- If you edited (for example set it to `false`) or deleted one of those keys, the extension
  releases it and does not rewrite it. The removal is remembered in the workspace state: a line
  you delete by hand stays deleted while its spec remains hidden. It is forgotten as soon as
  the spec stops being hidden (status changed, spec deleted, status unticked, mode changed or
  `off`), or when you run **Reset Hidden Specs**; the next time the spec is hidden, the entry
  is written again. A key you set to `false` stays yours and is never changed or removed.
- Switching between `searchAndQuickOpen` and `everywhere` moves the entries from one setting
  to the other.
- Setting the mode back to `off` removes the extension's entries, and only those. A setting
  left empty is removed from the file.

## Spec names with special characters

The VS Code glob engine has no backslash escape. A wildcard is made literal by wrapping it in
a one-character class: `*` becomes `[*]`, `?` becomes `[?]`, `[` becomes `[[]`, `}` becomes
`[}]` and `]` becomes `[]]`. Characters such as `( ) ! , ^ -` are already literal. The
behavior was verified against the engine's source and a transcription of it is used by the
tests.

A name is **skipped**, with a line in the "Kiro Spec Tracker" output channel, when it cannot
be written reliably: a name containing `{` (the engine keeps its brace state open even inside
a class, which breaks the `/**` suffix), a backslash or a slash, a control character, an empty
name, or trailing whitespace (the engine trims the pattern).

## Known side effects and limits

- **Kiro agent**: its file and text search tools honor `files.exclude` and `search.exclude`,
  so the agent no longer finds hidden specs by search. It can still read them by explicit
  path, and Kiro's own Specs panel lists them (it uses `workspace.fs`).
- **Quick Open history**: VS Code permanently drops the history entries of files that become
  excluded. They are not restored when the spec is shown again.
- **Version control**: if `.vscode/settings.json` is committed, every status change produces a
  diff in it. Consider ignoring that file, or keep the mode `off` for shared projects.
- **Uninstalling**: an extension cannot clean up on uninstall. If you uninstall it while the
  mode is active, its entries stay in your settings; set the mode to `off` first, or run
  **Reset Hidden Specs**, or remove the entries by hand.
- **Lost state**: the ownership record lives in the workspace state. If it is lost (new
  clone, cleared storage), existing entries look like your own and are left alone.
- **Transient empty snapshot**: if a full refresh temporarily finds no spec at all (for example
  a read error), the extension removes its entries, then writes them back at the next refresh.
  In a committed `.vscode/settings.json` this can show up as a back-and-forth in the diff.
- **Folder not open**: if a recorded folder is no longer an open workspace folder, nothing is
  written for it and a line is added once to the "Kiro Spec Tracker" output channel.
