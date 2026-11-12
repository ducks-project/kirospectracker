/** What the selector engine needs to know about an element. */
export interface ISelectable {
  readonly localName: string;
  getAttribute(name: string): string | null;
  /** Parent element, or `null` at the root. */
  readonly parentElement: ISelectable | null;
}

/** One compound selector: tag, id, classes and attribute conditions. */
interface ICompound {
  readonly tag: string | undefined;
  readonly id: string | undefined;
  readonly classes: readonly string[];
  readonly attributes: readonly { readonly name: string; readonly value: string | undefined }[];
}

/** Compound selectors joined by the descendant combinator, leftmost first. */
type ComplexSelector = readonly ICompound[];

const IDENT = '[A-Za-z_][\\w-]*';
const COMPOUND_PART = new RegExp(
  `^(?:(${IDENT})|#(${IDENT})|\\.(${IDENT})|\\[(${IDENT})(?:=(?:"([^"]*)"|'([^']*)'))?\\])`,
);

/**
 * Parse one compound selector, throwing on any syntax outside the supported subset.
 * @param source The compound text (no whitespace).
 * @param full The whole selector, for error messages.
 * @returns The parsed compound.
 */
function parseCompound(source: string, full: string): ICompound {
  let rest = source;
  let tag: string | undefined;
  let id: string | undefined;
  const classes: string[] = [];
  const attributes: { name: string; value: string | undefined }[] = [];
  while ('' !== rest) {
    const match = COMPOUND_PART.exec(rest);
    if (null === match) {
      throw new Error(`Unsupported selector syntax in "${full}" near "${rest}"`);
    }
    if (undefined !== match[1]) {
      tag = match[1].toLowerCase();
    } else if (undefined !== match[2]) {
      id = match[2];
    } else if (undefined !== match[3]) {
      classes.push(match[3]);
    } else {
      attributes.push({ name: match[4], value: match[5] ?? match[6] });
    }
    rest = rest.slice(match[0].length);
  }
  return { tag, id, classes, attributes };
}

/**
 * Parse a selector list limited to: tag, `#id`, `.class`, `[attr]`, `[attr="v"]`,
 * the descendant combinator (whitespace) and commas. Everything else (child or
 * sibling combinators, pseudo-classes, `*`) throws, so a refactor that starts
 * using a new selector fails the harness instead of matching nothing.
 * @param selector The selector text.
 * @returns The comma-separated complex selectors.
 */
export function parseSelector(selector: string): readonly ComplexSelector[] {
  if ('' === selector.trim()) {
    throw new Error('Unsupported selector: empty');
  }
  return selector.split(',').map((part) => {
    const compounds = part.trim().split(/\s+(?![^[]*\])/);
    return compounds.map((compound) => parseCompound(compound, selector));
  });
}

/**
 * Whether an element satisfies one compound selector.
 * @param element The element.
 * @param compound The compound selector.
 * @returns `true` on a match.
 */
function matchesCompound(element: ISelectable, compound: ICompound): boolean {
  if (undefined !== compound.tag && compound.tag !== element.localName) {
    return false;
  }
  if (undefined !== compound.id && compound.id !== element.getAttribute('id')) {
    return false;
  }
  const classTokens = (element.getAttribute('class') ?? '').split(/\s+/);
  if (!compound.classes.every((name) => classTokens.includes(name))) {
    return false;
  }
  return compound.attributes.every(({ name, value }) => {
    const actual = element.getAttribute(name);
    return null !== actual && (undefined === value || value === actual);
  });
}

/**
 * Whether an element matches a complex selector (descendant combinators, with backtracking).
 * @param element The candidate element (matched against the last compound).
 * @param selector The complex selector.
 * @param index Index of the compound being matched.
 * @returns `true` on a match.
 */
function matchesComplex(element: ISelectable, selector: ComplexSelector, index: number): boolean {
  if (!matchesCompound(element, selector[index])) {
    return false;
  }
  if (0 === index) {
    return true;
  }
  for (let ancestor = element.parentElement; null !== ancestor; ancestor = ancestor.parentElement) {
    if (matchesComplex(ancestor, selector, index - 1)) {
      return true;
    }
  }
  return false;
}

/**
 * Whether an element matches any selector of a parsed list.
 * @param element The element.
 * @param selectors The parsed selector list.
 * @returns `true` on a match.
 */
export function matchesSelector(
  element: ISelectable,
  selectors: readonly ComplexSelector[],
): boolean {
  return selectors.some((selector) => matchesComplex(element, selector, selector.length - 1));
}
