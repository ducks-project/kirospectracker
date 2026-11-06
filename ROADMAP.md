# Roadmap

This document describes the planned releases of Kiro Spec Tracker. The dates are not
fixed; the order of the milestones is. The details evolve with the project.

Each milestone title carries a status marker: `[Planned]` (not started) or
`[In progress]` (work underway). A milestone is removed from this document once it ships;
its shipped content then lives in the [CHANGELOG](CHANGELOG.md), which is the single source
of truth for what has been released. Items use GitHub task lists: `- [ ]` (not done) and
`- [x]` (done).

## v0.2.0 — Hardening and dependency updates [Planned]

- [ ] Update the vulnerable dev dependencies (esbuild, `@vscode/vsce`, `ovsx`/glob,
      mocha/serialize-javascript, typescript-eslint) to patched majors and re-validate the
      full quality gate. These are build/CI tools only; they are not shipped in the VSIX.
- [ ] Add batching and a strategy for workspaces with a very large number of specs,
      validated against the parsing benchmark budget.

## v0.3.0 — Best-effort task execution (opt-in) [Planned]

- [ ] Add an opt-in setting, disabled by default, that probes for Kiro task-execution
      commands and uses them when present, degrading gracefully to the MVP behavior
      (open `tasks.md`, consented clipboard copy) when they are absent.
- [ ] Document the integration as relying on non-official, unstable Kiro internals.

## v1.0.0 — First stable release [Planned]

- [ ] Publish to Open VSX and stabilize the public contribution points and settings.
