import { expect } from 'chai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import * as path from 'path';
import { HideSpecsMode } from '../../src/core/hiding/HideSpecsMode';
import { DEFAULT_HIDDEN_STATUSES } from '../../src/core/hiding/HiddenStatusSelection';
import { SpecStatus } from '../../src/core/model/SpecStatus';
import { resolveNls } from '../helpers/manifest-nls';
import { RESET_HIDDEN_SPECS_COMMAND_ID } from '../../src/adapters/commands/ResetHiddenSpecsCommand';

const MANIFEST_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../package.json',
);

interface IProperty {
  readonly type?: string;
  readonly default?: unknown;
  readonly enum?: readonly string[];
  readonly enumDescriptions?: readonly string[];
  readonly properties?: Readonly<Record<string, IProperty>>;
  readonly additionalProperties?: unknown;
}

interface IManifest {
  readonly contributes: {
    readonly commands: readonly { command: string; title: string }[];
    readonly menus: { commandPalette: readonly { command: string; when?: string }[] };
    readonly configuration: { properties: Readonly<Record<string, IProperty>> };
  };
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as IManifest;
const properties = manifest.contributes.configuration.properties;

describe('package.json hideSpecs contribution', () => {
  const statuses = properties['kirospectracker.hideSpecs.statuses'];
  const mode = properties['kirospectracker.hideSpecs.mode'];

  it('lists exactly the SpecStatus enum values, in a Settings-UI checkbox shape', () => {
    expect(statuses.type).to.equal('object');
    expect(statuses.additionalProperties).to.equal(false);
    expect(Object.keys(statuses.properties ?? {})).to.have.members(Object.values(SpecStatus));
    Object.values(statuses.properties ?? {}).forEach((entry) => {
      expect(entry.type).to.equal('boolean');
    });
  });

  it('defaults to hiding exactly the default statuses, consistently per entry and as a whole', () => {
    const asObject = statuses.default as Record<string, boolean>;
    Object.values(SpecStatus).forEach((status) => {
      const expected = DEFAULT_HIDDEN_STATUSES.has(status);
      expect(asObject[status], status).to.equal(expected);
      expect(statuses.properties?.[status].default, status).to.equal(expected);
    });
  });

  it('exposes the three modes with a description each, off by default', () => {
    expect(mode.enum).to.deep.equal(Object.values(HideSpecsMode));
    expect(mode.default).to.equal('off');
    expect(mode.enumDescriptions).to.have.length(mode.enum?.length as number);
  });

  it('contributes a Reset command visible in the command palette', () => {
    const command = manifest.contributes.commands.find(
      (c) => RESET_HIDDEN_SPECS_COMMAND_ID === c.command,
    );
    expect(resolveNls(command?.title ?? '')).to.equal('Kiro Spec Tracker: Reset Hidden Specs');
    const hidden = manifest.contributes.menus.commandPalette.find(
      (entry) => RESET_HIDDEN_SPECS_COMMAND_ID === entry.command,
    );
    expect(hidden).to.equal(undefined);
  });
});
