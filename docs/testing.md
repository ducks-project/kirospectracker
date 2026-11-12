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
- Pinned VS Code version: the harness ([runTest.ts](../test/runTest.ts)) downloads the build
  named by `PINNED_VSCODE_VERSION` (currently 1.146.0) instead of the moving `stable`, so a
  commit behaves the same from one day to the next. CI uses the same script and needs no
  change. To bump it, edit that constant, run `xvfb-run -a npm run test:integration` several
  times, and commit the new value. When `KIRO_SPEC_TRACKER_TEST_EXECUTABLE` is set, that
  executable takes precedence and the pinned version is not used.

```bash
npm run test:integration
```

### Localization

- Synchronisation unit tests ([i18n-sync.spec.ts](../test/unit/i18n-sync.spec.ts)): every `%id%`
  of `package.json` exists in `package.nls.json` (no orphan, none unresolved); the French files
  have the same keys, `{n}` markers and inline code as English; `l10n/bundle.l10n.fr.json` holds
  exactly the typed catalogue keys; the three JSON files are sorted by key; `package.json`
  declares `"l10n": "./l10n"` and the folder exists; the `hideSpecs.statuses` keys equal the
  `SpecStatus` values. [webview-keys.spec.ts](../test/unit/webview-keys.spec.ts) checks that
  every `.ts` file under `src/webview` (read recursively) only requests catalogued webview keys. Tests that read a manifest title resolve it
  through [manifest-nls.ts](../test/helpers/manifest-nls.ts).
- Real French run: [localization.spec.ts](../test/integration/localization.spec.ts) checks English
  output by default and, when `KIRO_SPEC_TRACKER_TEST_LOCALE=fr` is set, the French command title and
  a `vscode.l10n.t` string. `test/runTest.ts` reads these optional variables (unset keeps the
  default CI behaviour):

| Variable                                | Effect                                             |
| --------------------------------------- | -------------------------------------------------- |
| `KIRO_SPEC_TRACKER_TEST_EXECUTABLE`     | Editor executable to launch (for example Kiro)     |
| `KIRO_SPEC_TRACKER_TEST_LOCALE`         | Passes `--locale=<value>`                          |
| `KIRO_SPEC_TRACKER_TEST_USER_DATA_DIR`  | Passes `--user-data-dir=<dir>` (disposable)        |
| `KIRO_SPEC_TRACKER_TEST_EXTENSIONS_DIR` | Passes `--extensions-dir=<dir>` (disposable)       |
| `KIRO_SPEC_TRACKER_TEST_EXTRA_ARGS`     | Extra whitespace-separated flags (`--disable-gpu`) |

- French needs the language pack in the disposable profile: copy the pack folder into the
  extensions directory and write a `languagepacks.json` in the user data directory whose
  `translations` paths point at that copy. Never reuse the real profile.

```bash
KIRO_SPEC_TRACKER_TEST_EXECUTABLE=/usr/share/kiro/kiro KIRO_SPEC_TRACKER_TEST_LOCALE=fr \
KIRO_SPEC_TRACKER_TEST_USER_DATA_DIR=/tmp/i18n/ud KIRO_SPEC_TRACKER_TEST_EXTENSIONS_DIR=/tmp/i18n/ex \
KIRO_SPEC_TRACKER_TEST_EXTRA_ARGS="--disable-gpu" xvfb-run -a npm run test:integration
```

- Not covered: the web target, sub-locales such as `fr-CA`, and the visual rendering of the
  French dashboard (to check by hand in a French IDE).

### Smoke test

- A minimal, fast check that the extension activates and its commands are registered. It
  runs inside the integration harness.

## Coverage

Coverage is gated per layer with c8, run once per config so each layer is checked
against its own threshold:

- Core layer ([.c8rc.json](../.c8rc.json)): >= 95% statements, >= 90% branches.
- Adapter layer ([.c8rc.adapters.json](../.c8rc.adapters.json)): >= 85% statements.
- Webview ([.c8rc.webview.json](../.c8rc.webview.json)): >= 90% statements, >= 80% branches,
  on the DOM-free modules of `src/webview/**` and the preview modules tested against fakes.
  `main.ts`, the type-only `I*.ts` files and the modules that only build real DOM nodes are
  excluded, with the reason in the `_comment` of the config.

```bash
npm run coverage
```

Type-only ports and host-only `vscode` wrappers/providers are excluded from the gated
scope with documented rationale in the c8 config comments: they emit no in-process-testable
runtime logic and are evidenced behaviourally by the host harnesses. Each config writes an
`lcov` report under `coverage/core/`, `coverage/adapters/` and `coverage/webview/`, uploaded to
Codecov from CI with the flags `core`, `adapters` and `webview`.

### Dashboard bundle safety net

The dashboard script is a browser bundle that c8 cannot measure in `node:vm`, so its behaviour
is pinned by [dashboard-bundle.spec.ts](../test/unit/dashboard-bundle.spec.ts). It builds the
real `src/webview/main.ts` with esbuild, runs it in `node:vm` against the hand-written fake DOM
in [test/helpers/fake-dom](../test/helpers/fake-dom), replays 61 scenarios (renders, clicks,
keyboard, origin guard, scoped updates, rendering cost) and compares a serialized trace of the
DOM, the `postMessage` and `setState` effects and their order with the reference snapshots in
[test/fixtures/dashboard-snapshot](../test/fixtures/dashboard-snapshot). The fake DOM throws on
any API it does not model, so a refactor cannot silently start using a new one.

The reference is only regenerated on purpose, when a visible behaviour change is intended and
reviewed: run `UPDATE_DASHBOARD_SNAPSHOT=1 npm run test:unit` and review the diff of the fixtures
like production code. A refactor must never need it; a snapshot diff means the refactor changed
behaviour. This net does not replace a manual pass for visual rendering, focus and real
keyboard behaviour in the editor.

## What the project does not test

- No disproportionate end-to-end scenarios (full UI driving, multi-window flows): the
  maintenance cost would outweigh the value.
- No artificial coverage on type-only declarations or host-only shells.

## Benchmark

See [benchmarks.md](benchmarks.md). The benchmark is informational and does not gate CI.
