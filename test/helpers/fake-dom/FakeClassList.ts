import { strictProxy } from './strict-proxy';

/** Read and write access to the `class` attribute of the owning element. */
export interface IClassAttributeAccess {
  read(): string;
  write(value: string): void;
}

/**
 * Validate a token as `DOMTokenList` does (non-empty, no whitespace).
 * @param token The class token.
 */
function assertToken(token: string): void {
  if ('' === token || /\s/.test(token)) {
    throw new Error(`Invalid class token "${token}"`);
  }
}

/** `classList` backed by the `class` attribute (add, remove, toggle, contains). */
export class FakeClassList {
  private readonly access: IClassAttributeAccess;

  /**
   * Build a class list over an attribute.
   * @param access Reads and writes the `class` attribute.
   */
  public constructor(access: IClassAttributeAccess) {
    this.access = access;
  }

  /**
   * Whether the token is present.
   * @param token The class token.
   * @returns `true` when present.
   */
  public contains(token: string): boolean {
    return this.tokens().includes(token);
  }

  /**
   * Add tokens (existing ones are kept in place).
   * @param tokens The class tokens.
   */
  public add(...tokens: string[]): void {
    const next = this.tokens();
    tokens.forEach((token) => {
      assertToken(token);
      if (!next.includes(token)) {
        next.push(token);
      }
    });
    this.access.write(next.join(' '));
  }

  /**
   * Remove tokens.
   * @param tokens The class tokens.
   */
  public remove(...tokens: string[]): void {
    tokens.forEach(assertToken);
    this.access.write(
      this.tokens()
        .filter((token) => !tokens.includes(token))
        .join(' '),
    );
  }

  /**
   * Toggle a token.
   * @param token The class token.
   * @param force When given, add (`true`) or remove (`false`) instead of flipping.
   * @returns Whether the token is present afterwards.
   */
  public toggle(token: string, force?: boolean): boolean {
    assertToken(token);
    const present = force ?? !this.contains(token);
    if (present) {
      this.add(token);
    } else {
      this.remove(token);
    }
    return present;
  }

  private tokens(): string[] {
    return this.access
      .read()
      .split(/\s+/)
      .filter((token) => '' !== token);
  }
}

/**
 * Create a strict class list.
 * @param access Reads and writes the `class` attribute.
 * @returns The class list.
 */
export function createFakeClassList(access: IClassAttributeAccess): FakeClassList {
  return strictProxy(new FakeClassList(access), 'DOMTokenList');
}
