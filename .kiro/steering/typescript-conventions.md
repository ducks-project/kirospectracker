---
inclusion: fileMatch
fileMatchPattern: "**/*.{ts,tsx}"
---

# TypeScript Conventions

These conventions apply to all TypeScript code in the project. The prose, the code,
the identifiers, the code comments and the JSDoc are all in English (the rule that
code comments and JSDoc are in English is imposed by the common review, comments
section). They complement the project's JavaScript/TypeScript review rules without
replacing them.

## Strict mode

- The project compiles with `strict: true`. No strict option is disabled on a case-by-case basis.
- The `any` type is forbidden. When a type is truly unknown, prefer `unknown`
  and then narrow it with a type guard.
- No non-null assertion (`!`) unless the context clearly guarantees it, to be documented in a comment.
- The parameters of public functions and methods carry explicit types;
  so do public return types whenever inference is not obvious.

## Interfaces and types

- Prefer `interface` over `type` to describe objects (extensibility, declaration merging).
- Reserve `type` for unions, intersections, tuples and utility aliases.
- Interfaces are prefixed with `I`: this is the project's explicit convention
  (`IConfigurationProvider`, `ITextDocument`, `IReplacement`). Apply this prefix everywhere.
- Use generics when they avoid duplication or an `any`.

Example:

```ts
export interface IConfigurationProvider {
  getOverrides(): Readonly<Record<string, string>>;
}
```

## Naming

- `camelCase` for variables, functions and methods.
- `PascalCase` for classes, types and interfaces (after the `I` prefix).
- `UPPER_SNAKE_CASE` for module constants.
- Descriptive names: avoid `data`, `info`, `tmp` outside a very local scope.

```ts
const CONFIGURATION_SECTION = 'htmlentityswaper';

export class EntityMapBuilder {
  public withDefaults(): this {
    // ...
    return this;
  }
}
```

## Early return

- Exit early with guards at the start of a function to reduce nesting.
- Avoid an `else` after a `return`.

```ts
function activate(context: vscode.ExtensionContext): void {
  if (!context) {
    return;
  }
  // main path, a single level of indentation
}
```

## Yoda style

- Place the constant or literal on the left in strict equality comparisons.

```ts
if (undefined === entity) {
  return;
}
```

## Equality and declarations

- Always `===` and `!==`, never `==` nor `!=`.
- `const` by default, `let` only when reassigning, never `var`.
- No magic numbers: extract them into a named constant.

## Function size and purity

- Aim for functions of fewer than thirty lines, with a single responsibility.
- Prefer pure functions without side effects in the `core` layer.
- Never mutate arguments; return new immutable values.

## Modules and async

- Use ES modules (`import` / `export`), not `require`.
- Prefer `async` / `await` over `.then()` chains.
- Import types with `import type` when only the shape is used.

```ts
import type { EntityMap } from './EntityMap';
import { ReplacementResult } from './models/ReplacementResult';
```

## Documentation

- Document classes, public methods and interfaces with English JSDoc.
- Describe parameters and return values with `@param` and `@returns`.
- Do not leave dead code in comments.
