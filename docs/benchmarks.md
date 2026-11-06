# Benchmark Report

The benchmark measures the cost of parsing a `tasks.md` document of increasing size with
[TasksMarkdownParser](../src/core/parsing/TasksMarkdownParser.ts), using
[mitata](https://github.com/evanwashere/mitata). The measurements are informational and do
not gate CI.

```bash
npm run bench
```

## Extension version 0.1.0

- Environment: Linux, Intel(R) Core(TM) Ultra 7 155H, Node.js v24.21.0
- Date (UTC): 2026-11-06T09:03:22Z

| Input size       | Average latency | Unit |
| ---------------- | --------------- | ---- |
| small (~5 tasks) | 30.11           | µs   |
| medium (~250)    | 1.44            | ms   |
| large (~2500)    | 15.31           | ms   |

## Extension version 0.3.0

Version 0.3.0 reworked the steady-state editing path so a single spec change no longer
reprocesses every spec. A second benchmark,
[incremental-update.bench.ts](../benchmark/incremental-update.bench.ts), contrasts the old
full-render fan-out with the new incremental `specUpdated` path across 50, 200 and 500 specs.

```bash
npm run bench:update
```

- Single-change update path, before (the old fan-out reprojected all N cards and refreshed
  every decoration on each edit): roughly 13 ms at 50 specs, 81 ms at 200 specs and 192 ms at
  500 specs, growing linearly with the spec count.
- Single-change update path, after (the `specUpdated` message carries one `ISpecCardView`):
  flat at a few nanoseconds regardless of the spec count, so editing a 500-spec workspace
  costs the same as editing a handful. The micro-benchmark isolates the projection work that
  changed from O(N) to O(1); the aggregate stats recompute is a shared single-field scan.
- Memory: dropping the retained parsed task tree from each snapshot (the dashboard never used
  it; `RunTasksCommand` now parses `tasks.md` on demand) removes about 107 MB of retained
  task nodes at 500 specs with complex task lists.
- Discovery: spec file reads during a cold scan are now bounded (a default of 12 concurrent
  reads) instead of issuing all N reads at once, smoothing tail latency and file-handle
  pressure on large or remote workspaces without changing the result.

Reproduce the figures with `npm run bench:update`; like the parser benchmark they are
informational and do not gate CI.

## Reading the results

- Parsing a typical spec (a few to a few dozen tasks) costs tens of microseconds: well below
  any perceptible latency when the explorer refreshes a decoration or the dashboard renders.
- A very large spec (~2500 tasks) parses in about 15 ms. Because the repository re-parses
  only the single spec affected by a file change, this cost is paid per changed spec, not
  across the whole workspace.
- Figures vary with the machine and the Node.js version; treat them as orders of magnitude,
  not guarantees. Re-run `npm run bench` to measure on your own hardware.
