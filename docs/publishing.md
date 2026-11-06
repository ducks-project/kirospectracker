# Publishing

This document describes how the extension is built, packaged, and published to
[Open VSX](https://open-vsx.org/) under the `ducks-project` namespace.

## Prerequisites

- An Open VSX account with permission to publish under the `ducks-project` namespace.
- An Open VSX personal access token. This token must never be committed or shared.

## CI secrets

The GitHub Actions workflows expect two repository secrets:

- `OVSX_TOKEN` — used by the release workflow to publish to Open VSX.
- `CODECOV_TOKEN` — used by the CI workflow to upload coverage reports to Codecov.

Neither token ever appears in plain text in the repository.

## Creating the namespace

A one-time operation:

```bash
ovsx create-namespace ducks-project -p "$OVSX_TOKEN"
```

## Packaging

Build and package the `.vsix` before publishing:

```bash
npm run build
npm run package
```

The packaged `.vsix` excludes development files through `.vscodeignore`, so dev
dependencies are never shipped to users.

## Manual publishing

```bash
ovsx publish -p "$OVSX_TOKEN"
```

## Automated publishing in CI

Publishing is triggered by CI on the creation of a `v*` tag (for example `v0.1.0`). The
release workflow builds the package and then runs `ovsx publish`, using the `OVSX_TOKEN`
secret.

## Release checklist

1. The version in [package.json](../package.json) matches the intended tag.
2. The [changelog](../CHANGELOG.md) moves the `[Unreleased]` entries under a dated version
   section, and a comparison link is added.
3. The [roadmap](../ROADMAP.md) drops any milestone shipped by this release (the CHANGELOG
   becomes its single source of truth).
4. Lint, type-check, build (node + browser), unit/property/integration tests and packaging
   all pass.
5. Tag the release (`git tag vX.Y.Z && git push origin vX.Y.Z`) to trigger the release
   workflow.

## Post-publishing

- Verify the extension page on Open VSX shows the new version, the README, and the icon.
- Confirm the Open VSX badges in the README resolve (enable them in the README once the
  first version is live).
