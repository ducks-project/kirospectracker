# Dashboard bundle references

Each `<scenario>.txt` file is the recorded observation of one scenario replayed by
`test/unit/dashboard-bundle.spec.ts`: the REAL webview bundle (`src/webview/main.ts`
built by esbuild) runs in `node:vm` against the hand-written fake DOM in
`test/helpers/fake-dom/`. A file lists, after every checkpoint, the ordered effects
(messages posted to the host, `setState` calls, focus changes, DOM mutations), the
pending timers and the active element, then the final listeners and DOM tree.

A refactor of the webview must leave these files untouched. When a behaviour change is
intended, regenerate them and review the diff before committing:

```bash
UPDATE_DASHBOARD_SNAPSHOT=1 npm run test:unit
```

The variable is never set by `npm test` or by the CI.
