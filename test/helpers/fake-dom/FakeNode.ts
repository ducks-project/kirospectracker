import { FakeEventTarget } from './FakeEventTarget';
import { strictProxy } from './strict-proxy';

/** `Node.nodeType` of an element. */
export const ELEMENT_NODE = 1;
/** `Node.nodeType` of a text node. */
export const TEXT_NODE = 3;
/** `Node.nodeType` of a document. */
export const DOCUMENT_NODE = 9;

/**
 * Validate that a value is a fake node, as the DOM does for `appendChild` and friends.
 * @param value The value to check.
 * @returns The same value typed as a node.
 */
function assertNode(value: unknown): FakeNode {
  if (!(value instanceof FakeNode)) {
    throw new TypeError('Unsupported DOM API: only Node arguments are modelled');
  }
  return value;
}

/** A node of the fake tree: parent/child links and the tree-mutation methods. */
export class FakeNode extends FakeEventTarget {
  public readonly nodeType: number;
  public parentNode: FakeNode | null = null;
  public readonly childNodes: FakeNode[] = [];
  /** Set on the document only: called when a connected part of the tree changes. */
  public mutationListener: (() => void) | undefined = undefined;

  /**
   * Build a node.
   * @param nodeType One of the `*_NODE` constants.
   */
  public constructor(nodeType: number) {
    super();
    this.nodeType = nodeType;
  }

  /** @inheritdoc */
  protected override eventParent(): FakeEventTarget | undefined {
    return this.parentNode ?? undefined;
  }

  /**
   * Whether the node is part of a document tree.
   * @returns `true` when the root of the node is a document.
   */
  public get isConnected(): boolean {
    if (DOCUMENT_NODE === this.nodeType) {
      return true;
    }
    for (let node = this.parentNode; null !== node; node = node.parentNode) {
      if (DOCUMENT_NODE === node.nodeType) {
        return true;
      }
    }
    return false;
  }

  /**
   * Whether another node is this node or one of its descendants.
   * @param other The other node (or `null`).
   * @returns `true` when contained.
   */
  public contains(other: unknown): boolean {
    if (null === other) {
      return false;
    }
    for (let node: FakeNode | null = assertNode(other); null !== node; node = node.parentNode) {
      if (node === this) {
        return true;
      }
    }
    return false;
  }

  /**
   * Append a node, moving it out of its previous parent first.
   * @param child The node to append.
   * @returns The appended node.
   */
  public appendChild<T>(child: T): T {
    const node = assertNode(child);
    if (node.contains(this)) {
      throw new Error('HierarchyRequestError: a node cannot contain itself');
    }
    node.detach();
    node.parentNode = this;
    this.childNodes.push(node);
    this.notifyMutation();
    return child;
  }

  /**
   * Replace all children with the given nodes.
   * @param nodes The new children.
   */
  public replaceChildren(...nodes: unknown[]): void {
    const next = nodes.map(assertNode);
    this.childNodes.splice(0).forEach((child) => {
      child.parentNode = null;
    });
    next.forEach((node) => this.appendChild(node));
    this.notifyMutation();
  }

  /**
   * Replace this node by another one in its parent (no-op when detached).
   * Only a single replacement node is modelled.
   * @param nodes The replacement nodes.
   */
  public replaceWith(...nodes: unknown[]): void {
    if (1 !== nodes.length) {
      throw new Error('Unsupported DOM API: replaceWith with other than one node');
    }
    const replacement = assertNode(nodes[0]);
    const parent = this.parentNode;
    if (null === parent || replacement === this) {
      return;
    }
    replacement.detach();
    const index = parent.childNodes.indexOf(this);
    parent.childNodes.splice(index, 1, replacement);
    replacement.parentNode = parent;
    this.parentNode = null;
    parent.notifyMutation();
  }

  /**
   * The topmost ancestor (this node when detached).
   * @returns The root node.
   */
  public rootNode(): FakeNode {
    return null === this.parentNode ? this : this.parentNode.rootNode();
  }

  /**
   * Descendants in document order (depth-first, pre-order), excluding this node.
   * @returns The descendant nodes.
   */
  public descendants(): FakeNode[] {
    const result: FakeNode[] = [];
    this.childNodes.forEach((child) => {
      result.push(child, ...child.descendants());
    });
    return result;
  }

  /** Remove this node from its parent. */
  protected detach(): void {
    const parent = this.parentNode;
    if (null === parent) {
      return;
    }
    parent.childNodes.splice(parent.childNodes.indexOf(this), 1);
    this.parentNode = null;
    parent.notifyMutation();
  }

  /** Tell the document that a connected part of its tree changed. */
  protected notifyMutation(): void {
    if (this.isConnected) {
      this.rootNode().mutationListener?.();
    }
  }
}

/** A text node (`Text`), holding inert character data. */
export class FakeText extends FakeNode {
  public readonly data: string;

  /**
   * Build a text node.
   * @param data The characters.
   */
  public constructor(data: string) {
    super(TEXT_NODE);
    this.data = data;
  }
}

/**
 * Create a strict text node.
 * @param data The characters.
 * @returns The text node.
 */
export function createFakeText(data: string): FakeText {
  return strictProxy(new FakeText(data), 'Text');
}
