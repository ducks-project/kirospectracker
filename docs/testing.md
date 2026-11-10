# Testing

This project uses a single runner, Mocha, across all levels, with Chai for assertions and
fast-check for property-based tests. The core is tested in process without a VS Code host;
the adapters are tested inside a real host.

## Levels

### Unit tests

- Target: the pure `core/` layer (parser, meta reader, status resolver, progress
  calculator, mappers, HTML escaper).
- Scope: checkbox variants (`- [ ]`, `- [x]`, `- [X]`), the `*` optional marker, nested
  numbering and leaf-only counting, the `_Requirements:_` metadata line, junk lines, the
  five status states with document-policy variations, and the empty-required edge case.

```bash
npm run test:unit
```

### Property-based tests

- Target: `TasksMarkdownParser` and `SpecProgressCalculator`, with fast-check.
- Properties checked:
  1. Parsing is total: any string input yields an array and never throws.
  2. Counting invariants: `requiredDone <= requiredTotal` and
     `optionalDone <= optionalTotal`.
  3. Marker exclusivity: a task is optional iff a `*` is glued to its `]`; the word
     "optional" in prose never flips the flag.
  4. Leaf consistency: `requiredTotal + optionalTotal` equals the number of leaf tasks.
  5. State monotonicity: checking more required tasks never moves the status backward.
- Hide specs ([hide-specs.property.spec.ts](../test/property/hide-specs.property.spec.ts)):
  every supported spec name yields a glob matching exactly its folder and files under a
  transcription of the VS Code glob engine
  ([vscode-glob-oracle.ts](../test/helpers/vscode-glob-oracle.ts)); the reconciler never
  alters a key it does not own, is idempotent, and only owns present, true keys; the selector
  accounts for every selected spec (written or skipped).

```bash
npm run test:property
```

### Integration tests

- Target: the extension inside a real VS Code host via `@vscode/test-electron`.
- Scope: activation and command registration, a decoration applied to a fixture spec, a
  non-decoration on an unrelated file, and the dashboard view resolving with a strict CSP
  and a nonce.
- Hide specs by status ([hide-specs.spec.ts](../test/integration/hide-specs.spec.ts)): real
  writes to the fixture workspace folder settings, read back through `inspect`, preservation of
  a pre-existing entry, mode switch, Reset, return to `off`, `findFiles` honoring the written
  globs, and discovery, watcher path and decorations left unaffected. The suite captures the
  fixture's `.vscode` folder first and restores or removes it in an `after` hook, so no
  versioned fixture file is left modified, even on failure.
- On CI Linux the suite runs under `xvfb-run` (virtual display).

```bash
npm run test:integration
```

### Smoke test

- A minimal, fast check that the extension activates and its commands are registered. It
  runs inside the integration harness.

## Coverage

Coverage is gated per layer with c8, run twice (once per config) so each layer is checked
against its own threshold:

- Core layer ([.c8rc.json](../.c8rc.json)): >= 95% statements, >= 90% branches.
- Adapter layer ([.c8rc.adapters.json](../.c8rc.adapters.json)): >= 85% statements.

```bash
npm run coverage
```

Type-only ports and host-only `vscode` wrappers/providers are excluded from the gated
scope with documented rationale in the c8 config comments: they emit no in-process-testable
runtime logic and are evidenced behaviourally by the host harnesses. Each config writes an
`lcov` report under `coverage/core/` and `coverage/adapters/`, uploaded to Codecov from CI
with the flags `core` and `adapters`.

## What the project does not test

- No disproportionate end-to-end scenarios (full UI driving, multi-window flows): the
  maintenance cost would outweigh the value.
- No artificial coverage on type-only declarations or host-only shells.

## Benchmark

See [benchmarks.md](benchmarks.md). The benchmark is informational and does not gate CI.
