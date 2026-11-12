/**
 * Wrap a fake DOM object so that reading or writing a member it does not define
 * THROWS instead of silently yielding `undefined` or creating an expando.
 *
 * This is what makes the hand-written DOM a safety net: when the dashboard starts
 * using a DOM API the fake does not model, the harness fails loudly instead of
 * passing on a no-op.
 * @param target The fake object (every supported member must exist on it, even
 *   when its initial value is `undefined`).
 * @param label Name used in the error message, e.g. `Element`.
 * @returns A proxy enforcing the closed API.
 */
export function strictProxy<T extends object>(target: T, label: string): T {
  return new Proxy(target, {
    get(object, property, receiver): unknown {
      if ('symbol' !== typeof property && !(property in object)) {
        throw new Error(
          `Unsupported DOM API: ${label}.${property} is not modelled by the fake DOM`,
        );
      }
      return Reflect.get(object, property, receiver);
    },
    set(object, property, value, receiver): boolean {
      if ('symbol' !== typeof property && !(property in object)) {
        throw new Error(
          `Unsupported DOM API: assigning ${label}.${property} is not modelled by the fake DOM`,
        );
      }
      return Reflect.set(object, property, value, receiver);
    },
  });
}
