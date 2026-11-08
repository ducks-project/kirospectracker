# Roadmap

This document describes the planned releases of Kiro Spec Tracker. The dates are not
fixed; the order of the milestones is. The details evolve with the project.

Each milestone title carries a status marker: `[Planned]` (not started) or
`[In progress]` (work underway). A milestone is removed from this document once it ships;
its shipped content then lives in the [CHANGELOG](CHANGELOG.md), which is the single source
of truth for what has been released. Items use GitHub task lists: `- [ ]` (not done) and
`- [x]` (done).

## v0.7.0 — Agent-driven task actions (best-effort, isolated behind a port) [Planned]

The three agent actions below have no stable Kiro API; they are wired through an
intent-level `ISpecAgentGateway` port (pure, in core) with a concrete `KiroChatAgentGateway`
adapter confining all fragility (undocumented `kiroAgent.*` commands, clipboard fallback,
focus timing), an `UnavailableAgentGateway` Null-Object fallback degrading to the honest MVP
(open `tasks.md` + consented clipboard copy), and a capability-detection factory
(`getCommands(true)`) selecting the adapter at runtime. Patterns: Strategy, Adapter, Null
Object, Factory. A future official Kiro API or another IDE becomes just another adapter with
no change to core or UI. Design recorded in `.agents/tasks/kiro-agent-api/findings.md`.

- [ ] Add a "Sync Files" button and evolve the "Run tasks" control into a split button with
      a dropdown ("Run required tasks" / "Run required and optional tasks"), matching the
      reference screenshot. Intended behavior: "Sync Files" sends
      `Update the tasks for the {spec name}` to the Kiro chat; "Run required tasks" opens a
      new Kiro chat with `Run all required tasks` and the spec as context; "Run required and
      optional tasks" does the same with `Run required and optional tasks`.
- [ ] Evolve the "Specs by Status" right-click context menu to the same actions, keeping the
      separator between the document actions (requirements / design / tasks) and the task
      actions (run). To respect DRY, the context menu and the dashboard card buttons share
      the same single implementation behind the port (differing menu labels are acceptable).
- [ ] Keep the agent actions enabled by default, and show a one-time VS Code notice
      informing the user that these features adapt best-effort to the editor in beta, are
      subject to change, and can be disabled; once the user acknowledges it, never show it
      again (persist the acknowledgement in global state). Provide a setting to disable the
      agent integration.
- [ ] Document the integration as relying on non-official, unstable editor command surfaces
      with graceful degradation (README, architecture, PRIVACY note on the clipboard path).

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
