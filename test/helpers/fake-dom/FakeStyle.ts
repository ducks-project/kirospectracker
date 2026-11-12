/** Style properties the dashboard assigns directly (`style.width = ...`). */
const SUPPORTED_PROPERTIES: ReadonlySet<string> = new Set(['width', 'left', 'top']);

/**
 * Inline style declaration. Direct properties are limited to the ones the
 * dashboard uses, custom properties go through `setProperty`; anything else
 * throws. Values are kept in a map so they can be serialised.
 */
export function createFakeStyle(): object {
  const declarations = new Map<string, string>();
  const methods: Record<string, unknown> = {
    setProperty(name: string, value: string): void {
      if (!name.startsWith('--')) {
        throw new Error(
          `Unsupported DOM API: style.setProperty("${name}") (custom properties only)`,
        );
      }
      declarations.set(name, String(value));
    },
    serialize(): string {
      return Array.from(declarations.entries())
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([name, value]) => `${name}: ${value}`)
        .join('; ');
    },
  };
  return new Proxy(methods, {
    get(_target, property): unknown {
      if ('string' !== typeof property) {
        return undefined;
      }
      if (property in methods) {
        return methods[property];
      }
      if (SUPPORTED_PROPERTIES.has(property)) {
        return declarations.get(property) ?? '';
      }
      throw new Error(`Unsupported DOM API: style.${property} is not modelled by the fake DOM`);
    },
    set(_target, property, value): boolean {
      if ('string' !== typeof property || !SUPPORTED_PROPERTIES.has(property)) {
        throw new Error(`Unsupported DOM API: assigning style.${String(property)}`);
      }
      declarations.set(property, String(value));
      return true;
    },
  });
}

/** Serialisable view of a fake style (see {@link createFakeStyle}). */
export interface ISerializableStyle {
  serialize(): string;
}
