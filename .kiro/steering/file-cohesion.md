---
inclusion: fileMatch
fileMatchPattern: "**/*.{ts,tsx}"
---

# File Cohesion

This rule complements the TypeScript conventions. The prose, the code, the
identifiers and the JSDoc are in English.

## One cohesive concept per file

A file carries one cohesive concept, not a single declaration. The review criterion
is: does the file name describe everything the file contains?

No mainstream source recommends "one declaration per file" in TypeScript. The
[Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
describes the structure of a source file (imports, then the implementation) without
capping the number of declarations. The ESLint rule
[`max-classes-per-file`](https://eslint.org/docs/latest/rules/max-classes-per-file)
exists to limit classes for maintainability, but it does not count interfaces or
types. This is therefore a project convention, partly enforced by tooling.

## Declarations that may live together

Declarations may share a file when they form a single concept:

- the members of one discriminated union, with the union itself
  (`IDashboardMessage.ts`);
- a type and its pure derivations or helpers, with its private constants
  (`TaskState.ts`);
- the options, input or result type specific to a single function or class
  (`SpecSnapshotFactory.ts` and `ISpecRawInput`);
- a port and its closely related value types (`IHiddenSpecsNotifier.ts` and
  `IFirstWriteNotice`).

## Declarations that must be split

Declarations must live in separate files when:

- they carry two unrelated responsibilities;
- the file contains more than one public class;
- a declaration is imported elsewhere independently of its host, that is, most of its
  consumers do not need the rest of the file;
- the file name no longer describes the main content.

Example from the repository: `ExcludeSettingKey` and `MANAGED_EXCLUDE_SETTINGS` (the
key of a VS Code setting) used to live in `HideSpecsMode.ts`. Most of their importers
never used `HideSpecsMode`, so they now live in `ExcludeSettingKey.ts`, while
`HideSpecsMode.ts` keeps the enum and `HideSpecsModeMapper`.

## Naming

The file takes the name of its main concept (the main class, interface, type or
function, with the `I` prefix for an interface). A file of functions or constants is
named after the concept, without having to repeat the exported identifier
(`SpecStatusColor.ts`).

## Tooling

ESLint enforces the mechanical part: `max-classes-per-file` is set to `["error", 1]`
for `src/**/*.ts`. Interfaces and types are not counted by this rule, so the rest of
this document is a review criterion.
