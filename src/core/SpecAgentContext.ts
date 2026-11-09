/**
 * Pure, `vscode`-free helpers composing an in-prompt folder context reference for
 * the agent message, so the programmatic `sendPrompt` carries the spec folder as
 * chat context.
 *
 * Context is NOT carried by the chat input box: `kiroAgent.sessions.sendPrompt`
 * sends only its text argument, and Kiro resolves `#[[provider:query]]` tokens
 * parsed FROM that text into real context entries. Mirroring how Kiro's own
 * `selectFilesAsContext` builds a reference for a directory, a spec folder is
 * referenced by a `folder` token `#[[folder:<fsPath>]]`; `selectFilesAsContext`
 * itself is NOT used because it only seeds the input box the programmatic send
 * ignores. See `.kiro/steering/kiro-agent-commands.md` and
 * `.agents/tasks/kiro-agent-api/context-attach.md`.
 *
 * This is a security property too: the token is built by plain string
 * concatenation from a trusted on-disk spec folder path (never evaluated as
 * code), alongside the fixed {@link SPEC_AGENT_MESSAGES} templates whose only
 * interpolated value is the already-trusted spec name.
 */

/** The context-provider id resolving a directory reference, as Kiro parses it. */
const FOLDER_PROVIDER_ID = 'folder';

/**
 * The separator placing the context token on its own line before the template,
 * so the composed message reads as a reference line then the instruction.
 */
const CONTEXT_SEPARATOR = '\n';

/**
 * Build the folder context reference token for a spec folder path, mirroring
 * Kiro's `selectFilesAsContext` reference shape for a directory.
 * @param folderFsPath The absolute filesystem path of the spec folder.
 * @returns The `#[[folder:<fsPath>]]` reference token.
 */
export function buildFolderContextToken(folderFsPath: string): string {
  return `#[[${FOLDER_PROVIDER_ID}:${folderFsPath}]]`;
}

/**
 * Compose the final prompt text by prepending the spec folder context token (on
 * its own line) before the fixed template, so the submitted prompt carries the
 * spec folder as context.
 *
 * Degrades gracefully: when the folder path is missing or empty, the plain
 * template is returned WITHOUT any token, preserving the no-context send.
 * @param template The fixed, ready-to-send template message.
 * @param folderFsPath The absolute filesystem path of the spec folder, if any.
 * @returns The composed message (token + template) or the plain template.
 */
export function composeMessageWithFolderContext(template: string, folderFsPath: string): string {
  if (0 === folderFsPath.length) {
    return template;
  }
  return `${buildFolderContextToken(folderFsPath)}${CONTEXT_SEPARATOR}${template}`;
}
