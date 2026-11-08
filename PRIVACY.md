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
