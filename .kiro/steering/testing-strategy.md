---
inclusion: manual
---

# Testing Strategy

This document describes the project's test levels, the tool chosen for each one, and
what the project explicitly chooses not to do. The runner is unique:
Mocha, for all levels. The prose and the code are in English.

## Tools

- Runner: Mocha (single, explicit choice).
- Assertions: Chai.
- Property-based: fast-check.
- VS Code integration: `@vscode/test-electron`, driven by Mocha.
- Benchmark: mitata, non-blocking.

## Unit tests

- Target: the `core/` layer (pure logic, without a `vscode` dependency).
- Scope: `EntityMap`, `EntityMapBuilder` (add / overwrite / disable via
  overrides), `EntityReplacer` (computation of the replacements), and the data table.
- The only active test of the skeleton checks `DEFAULT_ENTITIES`: exact number of
  unique entries, absence of duplicate keys, and absence of the double quote character.

```bash
npm run test:unit
```

## Property-based tests

- Target: `EntityReplacer`, invariant properties over generated inputs.
- Properties: idempotence of the replacement, preservation of unmapped characters,
  no corruption of UTF-16 surrogate pairs.

```bash
npm run test:property
```

## Integration tests

- Target: the two commands in a real VS Code host via `@vscode/test-electron`.
- Scope: registration and execution of the commands, replacement on a selection,
  single undo (one `undo` only), immediate handling of a configuration change
  without a reload.
- On Linux CI, execution goes through `xvfb-run` (virtual display).

```bash
npm run test:integration
```

## Smoke tests

- Minimal and fast check: the extension activates and its two commands are
  registered. Run in the integration harness; it may be skipped locally
  without a display, but must compile and run in CI.

## Benchmark

- Target: cost of a batched replacement on small, medium and large documents.
- Tool: mitata. Measurements are informative and do not block CI.

```bash
npm run bench
```

## What the project does not do

- No disproportionate system or end-to-end tests (full UI driving,
  multi-window scenarios): the added value does not justify the maintenance cost.
- No artificial coverage on generated code or unimplemented skeletons.
- No blocking benchmark in the pipeline.
