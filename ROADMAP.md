# Roadmap

This document describes the planned releases of Kiro Spec Tracker. The dates are not
fixed; the order of the milestones is. The details evolve with the project.

Each milestone title carries a status marker: `[Planned]` (not started) or
`[In progress]` (work underway). A milestone is removed from this document once it ships;
its shipped content then lives in the [CHANGELOG](CHANGELOG.md), which is the single source
of truth for what has been released. Items use GitHub task lists: `- [ ]` (not done) and
`- [x]` (done).

## v0.4.1 — Dashboard re-open fix [Planned]

- [ ] Fix the dashboard showing an empty list after the view is closed and reopened (the
      specs only reappear after clicking Refresh). On re-resolution the webview is recreated
      empty and waits for a render, but the repository only emits on change, so the current
      cached specs are never sent. `resolveWebviewView` should post the current cached state
      immediately on (re)resolve. Confirmed a bug, not an intended behavior.

## v0.5.0 — Dashboard interaction hardening [Planned]

- [ ] Lock the tree-view context-menu `when` clauses in `package.json` against the pure
      context-value token vocabulary with an automated assertion, so renaming a token cannot
      silently break the menu.
- [ ] Make `SpecStatToggleView.valueFor` depend on an explicit typed mapping from filter key
      to the statistics field, rather than relying on the key names lining up implicitly.
- [ ] Narrow `resolveSpecNodeFolderPath` to validate that the resolved `folderPath` is a
      string before use (defensive; the host always supplies a real node today).

## v0.6.0 — Richer spec cards and task actions [Planned]

- [ ] Make each spec card clickable: clicking the card body opens the spec's
      `requirements.md`.
- [ ] Make the status shown on each spec card a clickable badge that toggles the status
      filter for that status (filter/unfilter specs with the same status), with a distinct,
      state-representative color per status.
- [ ] Add a "Sync Files" button and evolve the "Run tasks" control into a split button with
      a dropdown ("Run required tasks" / "Run required and optional tasks"), matching the
      reference screenshot.
- [ ] Wire those actions through Kiro. No official API exists for syncing files or running
      tasks, so this relies on NON-OFFICIAL, unstable Kiro integration points and must be
      documented as such and degrade gracefully when unavailable (this supersedes the former
      "best-effort task execution" item). Intended behavior: "Sync Files" sends
      `Update the tasks for the {spec name}` to the Kiro chat; "Run required tasks" opens a
      new Kiro chat with `Run all required tasks` and the spec as context; "Run required and
      optional tasks" does the same with `Run required and optional tasks`.
- [ ] Evolve the "Specs by Status" right-click context menu to the same actions, keeping the
      separator between the document actions (requirements / design / tasks) and the task
      actions (run). To respect DRY, the context menu and the dashboard card buttons should
      share the same underlying action code (differing menu labels are acceptable).
- [ ] Replace the "Toggle Dashboard Layout" command text with a single button that switches
      between a grid icon and a list icon (one toggling button, not two side-by-side buttons).
- [ ] Show, on each spec card, the folder (or project) that owns the spec.

## v0.7.0 — Task-level statistics and extended task states [Planned]

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

## v0.8.0 — Folder-scoped filtering [Planned]

- [ ] Add a filter button on the search box (like the Extensions view) whose menu lists the
      folders (or projects) that contain specs, to filter to (or unfilter) only those.
- [ ] Make the owning-folder (or project) information shown on each spec card clickable to
      filter/unfilter by that folder.

## v0.9.0 — Requirements preview on hover [Planned]

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
