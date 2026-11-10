# Privacy

Kiro Spec Tracker is designed to run entirely on your machine.

## Data collected

None. The extension does not collect, store, or transmit any personal data or any content
from your files.

## Telemetry

The extension ships no telemetry. No usage event is emitted.

## Network

The extension makes no network request. It does not contact any remote server.

## Processing

All processing (discovering specs under `.kiro/specs/`, reading their Markdown files,
parsing task checkboxes, and computing status and progress) happens locally in the IDE.
No information leaves your machine.

## Clipboard

The agent-driven Sync Files and Run tasks actions can, on some editors, send a short fixed
message to the editor's chat agent. When no direct command is available, one fallback path
writes that message to the clipboard, pastes it into the chat input, and then restores the
clipboard to its previous content. This clipboard use is local and transient; it still
involves no network request and no telemetry. The honest fallback (open `tasks.md` and offer
a ready-to-paste prompt) only writes to the clipboard after your explicit consent.

## Settings written locally

If you enable the opt-in `kirospectracker.hideSpecs.mode` setting, the extension writes
`files.exclude` or `search.exclude` entries (spec folder globs) into the settings of your
workspace folder (`.vscode/settings.json`), and keeps a record of those entries in the
workspace state stored by the editor on your machine. These writes are local, still involve no
network request and no telemetry, and are fully described in
[docs/configuration.md](docs/configuration.md). With the default mode `off`, nothing is
written.
