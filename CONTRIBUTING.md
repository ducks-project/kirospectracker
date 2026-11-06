# Contributing

Thank you for your interest in Kiro Spec Tracker. This guide describes the setup, the
conventions, the tests, and the contribution process.

## Prerequisites

- Node.js 20 or newer and npm.
- A VS Code-compatible IDE to test the extension.

## Setup

```bash
npm install
```

Installation sets up [lefthook](https://github.com/evilmartians/lefthook), which wires in
the project's Git hooks (pre-commit and pre-push checks).

## Conventions

The code must follow the project's review and style rules, recorded in the following
steering files:

- [TypeScript conventions](./.kiro/steering/typescript-conventions.md)
- [VS Code extension guidelines](./.kiro/steering/vscode-extension-guidelines.md)
- [Testing strategy](./.kiro/steering/testing-strategy.md)

In short: strict TypeScript, no `any`, interfaces prefixed with `I`, early return, Yoda
style, short functions, ES modules, and comments and JSDoc in English.

## Running the tests

```bash
npm run test:unit
npm run test:property
npm run test:integration
npm run bench
```

In a headless environment, the integration tests can be skipped locally; they run in CI
through a virtual display.

## Local checks

```bash
npm run lint
npm run compile
npm run build
```

## Commit format

The project follows the
[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) convention. Use a
type prefix: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`.

## Pull request process

- Create a dedicated branch from the default branch.
- Make sure lint, compilation, and tests pass.
- Document the change and update the [changelog](./CHANGELOG.md) when relevant.
- Open the pull request with a clear description of the problem and the solution.
