# Roadmap

This document describes the planned releases of Kiro Spec Tracker. The dates are not
fixed; the order of the milestones is. The details evolve with the project.

Each milestone title carries a status marker: `[Planned]` (not started) or
`[In progress]` (work underway). A milestone is removed from this document once it ships;
its shipped content then lives in the [CHANGELOG](CHANGELOG.md), which is the single source
of truth for what has been released. Items use GitHub task lists: `- [ ]` (not done) and
`- [x]` (done).

## v0.5.0 — Dashboard interaction hardening [Planned]

- [ ] Lock the tree-view context-menu `when` clauses in `package.json` against the pure
      context-value token vocabulary with an automated assertion, so renaming a token cannot
      silently break the menu.
- [ ] Make `SpecStatToggleView.valueFor` depend on an explicit typed mapping from filter key
      to the statistics field, rather than relying on the key names lining up implicitly.
- [ ] Narrow `resolveSpecNodeFolderPath` to validate that the resolved `folderPath` is a
      string before use (defensive; the host always supplies a real node today).

## v1.0.0 — First stable release [Planned]

- [ ] Publish to Open VSX and stabilize the public contribution points and settings.

## unknown — Best-effort task execution (opt-in) [Planned]

- [ ] Add an opt-in setting, disabled by default, that probes for Kiro task-execution
      commands and uses them when present, degrading gracefully to the MVP behavior
      (open `tasks.md`, consented clipboard copy) when they are absent.
- [ ] Document the integration as relying on non-official, unstable Kiro internals.

## to analyse — Dashboard list virtualization [Planned]

- [ ] Investigate whether virtualizing (windowing) the dashboard card list is needed:
      render only visible cards. Not a measured bottleneck in the 500-spec perf study
      (the cost was the per-change fan-out, not the one-time mount), so only pursue it
      if the real large-workspace host still shows mount jank after the v0.3.0 work, to
      avoid over-engineering.
