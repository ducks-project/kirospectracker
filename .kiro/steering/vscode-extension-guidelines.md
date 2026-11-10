---
inclusion: manual
---

# VS Code Extension Guidelines

These rules govern the code of the `adapters/` layer and the `extension.ts` entry
point, that is, the only part of the project that depends on the `vscode` API.
The `core/` layer never imports `vscode` and is therefore not concerned.
The prose, the code and the JSDoc are in English.

## Lazy activation

- Declare targeted `activationEvents` (command-based) rather than a `*`:
  the extension must wake up only when one of its commands is invoked.
- Do no expensive work when the module loads. The entity table is
  (re)built on demand, not at import time.

```json
{
  "activationEvents": [
    "onCommand:htmlentityswaper.replaceInDocument",
    "onCommand:htmlentityswaper.replaceInSelection"
  ]
}
```

## Lifecycle and disposables

- Push every disposable (commands, listeners) into `context.subscriptions`
  so that the host releases them on deactivation.
- `deactivate()` stays empty if everything is registered in `context.subscriptions`.

```ts
context.subscriptions.push(replaceInDocument, replaceInSelection, configurationListener);
```

## Batched editing

- Apply all the modifications of a command through a single batched `vscode.WorkspaceEdit`.
  This produces one undo step and better performance,
  and fixes the defect of the reference extension (one edit per character).
- Do not loop over `editor.edit()` character by character.

## Configuration reactivity

- Listen to `workspace.onDidChangeConfiguration` and invalidate the cached entity
  table when the `htmlentityswaper` section changes, to avoid requiring a reload.

```ts
const configurationListener = vscode.workspace.onDidChangeConfiguration((event) => {
  if (!event.affectsConfiguration('htmlentityswaper')) {
    return;
  }
  // invalidate the cached entity map
});
```

## Non-blocking operations

- No blocking synchronous call on the main thread (I/O, long loops).
- Use `async` / `await` for editor operations.

## Error handling

- Wrap command handlers in explicit error handling and surface a readable
  message through `window.showErrorMessage` rather than letting the exception leak.
- Keep to an active editor through a guard at the start of the handler.

## Security

- User overrides (`htmlentityswaper.overrides`) are data: validate them
  and treat them as text, never evaluate them as code.
- Execute no arbitrary code coming from the configuration or the document.
- No network access: processing is entirely local.
- No telemetry without explicit consent; the project ships none.

## Official references

- [VS Code Extension API](https://code.visualstudio.com/api)
- [WorkspaceEdit (reference API)](https://code.visualstudio.com/api/references/vscode-api#WorkspaceEdit)
- [Open VSX Registry](https://open-vsx.org/)
- [Open VSX publishing documentation](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions)
