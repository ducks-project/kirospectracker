# Roadmap

This document describes the planned releases of Kiro Spec Tracker. The dates are not
fixed; the order of the milestones is. The details evolve with the project.

Each milestone title carries a status marker: `[Planned]` (not started) or
`[In progress]` (work underway). A milestone is removed from this document once it ships;
its shipped content then lives in the [CHANGELOG](CHANGELOG.md), which is the single source
of truth for what has been released. Items use GitHub task lists: `- [ ]` (not done) and
`- [x]` (done).

## v0.8.0 — Task-level statistics and extended task states [Planned]

- [ ] Add discreet global statistics counted over tasks (not specs): total tasks done, in
      progress, cancelled, and to do, plus an overall percentage complete relative to the
      whole (where complete counts as done or cancelled).
- [ ] Extend task-state parsing to recognize cancelled (`[-]`) and in-progress (`[~]`) in
      addition to done (`[x]`) and not done (`[ ]`).
- [ ] Update the completion model so a spec is complete when every required task is done or
      cancelled, and fully complete when every required and optional task is done or
      cancelled; reflect this in the UI.
- [ ] Update the related documents (steering `kiro-spec-format`, README, architecture) to
      describe the extended task states and completion rules.

## v0.9.0 — Folder-scoped filtering [Planned]

- [ ] Add a filter button on the search box (like the Extensions view) whose menu lists the
      folders (or projects) that contain specs, to filter to (or unfilter) only those.
- [ ] Make the owning-folder (or project) information shown on each spec card clickable to
      filter/unfilter by that folder.

## v0.10.0 — Requirements preview on hover [Planned]

- [ ] On hovering a spec card, load and show the introduction of the spec's `requirements.md`
      when it exists. Load it asynchronously if that is more performant, keeping the
      large-workspace (500-spec) speed goal in mind.

## v1.0.0 — First stable release [Planned]

- [ ] Publish to Open VSX and stabilize the public contribution points and settings.

## to analyse — Dashboard list virtualization [Planned]

- [ ] Investigate whether virtualizing (windowing) the dashboard card list is needed:
      render only visible cards. Not a measured bottleneck in the 500-spec perf study
      (the cost was the per-change fan-out, not the one-time mount), so only pursue it
      if the real large-workspace host still shows mount jank after the v0.3.0 work, to
      avoid over-engineering.
