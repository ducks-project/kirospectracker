import type { ITaskItem } from '../model/ITaskItem';

/** A mutable task node used while building the immutable tree. */
interface IMutableTask {
  id: string;
  title: string;
  done: boolean;
  optional: boolean;
  readonly children: IMutableTask[];
  readonly requirements: string[];
  readonly indent: number;
}

/** Match a task list line: indentation, checkbox, optional `*`, number, title. */
const TASK_LINE =
  /^(?<indent>[ \t]*)-\s+\[(?<mark>[ xX])\](?<optional>\*?)\s*(?<id>\d+(?:\.\d+)*)?\.?\s*(?<title>.*)$/;

/** Match a `_Requirements: 1.1, 2.3_` metadata line, capturing the list body. */
const REQUIREMENTS_LINE = /^\s*(?:-\s+)?_Requirements:\s*(?<body>.*?)_\s*$/i;

/** Tab width used to normalise indentation into a comparable column count. */
const TAB_WIDTH = 2;

/**
 * Compute the visual indentation width of a leading whitespace run.
 * @param indent The captured leading whitespace.
 * @returns The width in columns, counting a tab as {@link TAB_WIDTH}.
 */
function indentWidth(indent: string): number {
  return Array.from(indent).reduce((width, char) => width + ('\t' === char ? TAB_WIDTH : 1), 0);
}

/**
 * Build a mutable task from a line when it is a checkbox entry.
 * @param line The raw line text.
 * @returns The mutable task, or `undefined` when the line is not a task.
 */
function matchTask(line: string): IMutableTask | undefined {
  const match = TASK_LINE.exec(line);
  if (null === match || undefined === match.groups) {
    return undefined;
  }
  const { indent, mark, optional, id, title } = match.groups;
  return {
    id: id ?? '',
    title: title.trim(),
    done: 'x' === mark || 'X' === mark,
    optional: '*' === optional,
    children: [],
    requirements: [],
    indent: indentWidth(indent),
  };
}

/**
 * Attach a task to its parent or the roots, using indentation for nesting.
 * @param task The task to attach.
 * @param roots The accumulated top-level tasks.
 * @param stack The open-ancestors stack, deepest last.
 */
function attach(task: IMutableTask, roots: IMutableTask[], stack: IMutableTask[]): void {
  while (0 < stack.length && stack[stack.length - 1].indent >= task.indent) {
    stack.pop();
  }
  if (0 === stack.length) {
    roots.push(task);
  } else {
    stack[stack.length - 1].children.push(task);
  }
  stack.push(task);
}

/**
 * Attach a `_Requirements:_` line to the most recently opened task.
 * @param line The raw line text.
 * @param stack The open-ancestors stack, deepest last.
 */
function captureRequirements(line: string, stack: IMutableTask[]): void {
  const match = REQUIREMENTS_LINE.exec(line);
  if (null === match || undefined === match.groups || 0 === stack.length) {
    return;
  }
  const ids = match.groups.body
    .split(',')
    .map((part) => part.trim())
    .filter((part) => 0 < part.length);
  stack[stack.length - 1].requirements.push(...ids);
}

/**
 * Freeze a mutable task into an immutable {@link ITaskItem}, recursively.
 * @param task The mutable task to freeze.
 * @returns The immutable task item.
 */
function freeze(task: IMutableTask): ITaskItem {
  return {
    id: task.id,
    title: task.title,
    done: task.done,
    optional: task.optional,
    children: task.children.map((child) => freeze(child)),
    requirements: [...task.requirements],
  };
}

/**
 * Consume a single line, dispatching to task creation or requirement capture.
 * @param line The raw line text.
 * @param roots The accumulated top-level tasks.
 * @param stack The open-ancestors stack, deepest last.
 */
function consumeLine(line: string, roots: IMutableTask[], stack: IMutableTask[]): void {
  const task = matchTask(line);
  if (undefined !== task) {
    attach(task, roots, stack);
    return;
  }
  captureRequirements(line, stack);
}

/**
 * Pure parser turning `tasks.md` text into an immutable {@link ITaskItem} tree.
 *
 * It recognises the GitHub-Flavored-Markdown checkbox (`- [ ]` / `- [x]` /
 * `- [X]`), the `*` optional marker glued to the closing bracket, the
 * hierarchical task number, nesting via indentation, and the
 * `_Requirements: ..._` metadata line. It is total: it never throws on
 * malformed input and silently skips lines it cannot parse. The word "optional"
 * in free text is NOT a marker; only the `*` after `]` flips the flag.
 */
export class TasksMarkdownParser {
  /** Pattern splitting the document body into lines (LF and CRLF). */
  private readonly lineSeparator: RegExp = /\r?\n/;

  /**
   * Parse the full text of a `tasks.md` into a task tree.
   * @param content Raw file text; may be empty or malformed.
   * @returns The parsed top-level tasks; an empty array when none are found.
   */
  public parse(content: string): readonly ITaskItem[] {
    const roots: IMutableTask[] = [];
    const stack: IMutableTask[] = [];

    content.split(this.lineSeparator).forEach((line) => consumeLine(line, roots, stack));

    return roots.map((task) => freeze(task));
  }
}
