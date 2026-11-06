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

## Reading the results

- Parsing a typical spec (a few to a few dozen tasks) costs tens of microseconds: well below
  any perceptible latency when the explorer refreshes a decoration or the dashboard renders.
- A very large spec (~2500 tasks) parses in about 15 ms. Because the repository re-parses
  only the single spec affected by a file change, this cost is paid per changed spec, not
  across the whole workspace.
- Figures vary with the machine and the Node.js version; treat them as orders of magnitude,
  not guarantees. Re-run `npm run bench` to measure on your own hardware.
