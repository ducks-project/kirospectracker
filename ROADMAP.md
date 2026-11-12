# Roadmap

This document describes the planned releases of Kiro Spec Tracker. The dates are not
fixed; the order of the milestones is. The details evolve with the project.

Each milestone title carries a status marker: `[Planned]` (not started) or
`[In progress]` (work underway). A milestone is removed from this document once it ships;
its shipped content then lives in the [CHANGELOG](CHANGELOG.md), which is the single source
of truth for what has been released. Items use GitHub task lists: `- [ ]` (not done) and
`- [x]` (done).

## v0.16.0 — Split webview/main.ts into view modules [In progress]

- [ ] Before any production change, add a safety net: a test that runs the real dashboard
      bundle against a hand-written fake DOM, replays scenarios and compares the result with
      a reference snapshot recorded beforehand. Keep it as a permanent test of the dashboard
      wiring.
- [ ] Split `src/webview/main.ts` (about 1,400 lines mixing state, DOM helpers, cards,
      toolbar, filters, stats, preview wiring and message handling) into cohesive modules
      grouped in feature subfolders, with no behaviour or protocol change. `main.ts` becomes
      a composition root that keeps the message origin guard.
- [ ] Measure the webview's DOM-free modules with a dedicated coverage gate and Codecov
      flag, and keep the production dashboard bundle within ±5 % of its current size.
- [ ] Merge the duplicated keyboard key constants in a separate final step.

## v0.17.0 — Restrict the test-only extension API [Planned]

- [ ] Return the internal objects that `activate` exposes for the integration tests
      (`repository`, `fileSystem`, `hiddenSpecs`, `agentActions`, `agentErrorReporter` and
      the other test hooks) only when the extension runs in test mode
      (`context.extensionMode === ExtensionMode.Test`), so another installed extension
      cannot reach them, for example to swap the agent gateway.

## v1.0.0 — First stable release [Planned]

- [ ] Publish to Open VSX and stabilize the public contribution points and settings.
- [ ] Resolve the agent-gateway availability loose ends from v0.7.0: either surface the
      three-state `availability()` in the UI (an honest integrated / degraded / unavailable
      affordance on the agent actions) or simplify the `SpecAgentAvailability` union to the
      states actually produced, so no discriminant stays dead.

## to analyse — Dashboard list virtualization [Planned]

- [ ] Investigate whether virtualizing (windowing) the dashboard card list is needed:
      render only visible cards. Not a measured bottleneck in the 500-spec perf study
      (the cost was the per-change fan-out, not the one-time mount), so only pursue it
      if the real large-workspace host still shows mount jank after the v0.3.0 work, to
      avoid over-engineering.
