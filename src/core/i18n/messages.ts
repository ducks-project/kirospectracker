/**
 * Single typed catalogue of every translatable English message.
 *
 * The English text is the key (the `vscode.l10n.t` convention) and templates use
 * positional `{0}`, `{1}` markers only. Each key belongs to exactly one group:
 * shared by host and webview, host only, or webview only. The compiler refuses
 * any message outside the group a surface is allowed to use.
 */
/** Messages used by both the host and the webview (status labels). */
export const SHARED_KEYS = [
  'Malformed',
  'Not started',
  'In progress',
  'Completed',
  'Fully completed',
] as const;
/** Messages used by the extension host only. */
export const HOST_ONLY_KEYS = [
  'Unknown folder',
  '{0} — {1}',
  '{0}/{1} required ({2}%) · {3}/{4} optional',
  'Kiro specs — {0} completed, {1} in progress, {2} not started, {3} malformed',
  '{0} ({1})',
  'No spec found at {0}.',
  'The {0} document is not present for "{1}".',
  '"{0}" is malformed (missing or unreadable tasks.md) and cannot be run.',
  'Copy a ready-to-paste execution prompt for this spec to the clipboard?',
  'Copy prompt',
  'Execution prompt copied to the clipboard.',
  'Kiro Spec Tracker: {0}',
  'Run tasks: no spec folder was provided.',
  'No spec was selected in the tree.',
  'Kiro Spec Tracker: the agent action could not be completed ({0}).',
  'Kiro Spec Tracker: sent to Kiro chat \u2014 "{0}".',
  'Kiro Spec Tracker: sent to Kiro chat \u2014 if it did not come to the front, open it from Session History.',
  'Kiro Spec Tracker: filled the chat with "{0}" \u2014 press Enter to run it.',
  'Kiro Spec Tracker: opened the chat with "{0}" \u2014 you may need to send it.',
  'Kiro Spec Tracker: no Kiro chat command is available to run this action.',
  "Kiro Spec Tracker's Sync Files and Run tasks actions adapt on a best-effort basis to the editor and are in beta: they may change and can be disabled at any time.",
  'Keep enabled',
  'Disable',
  'Settings',
  'Open settings file',
  'Kiro Spec Tracker: {0} spec hidden from the Explorer, Search and Quick Open (entries added to {1} in the folder settings).',
  'Kiro Spec Tracker: {0} specs hidden from the Explorer, Search and Quick Open (entries added to {1} in the folder settings).',
  'Kiro Spec Tracker: {0} spec hidden from Search and Quick Open (entries added to {1} in the folder settings).',
  'Kiro Spec Tracker: {0} specs hidden from Search and Quick Open (entries added to {1} in the folder settings).',
  'Kiro Spec Tracker: {0} hidden spec entries removed. Set "kirospectracker.hideSpecs.mode" to "off" to stop hiding specs.',
] as const;
/** Messages used by the webview only. */
export const WEBVIEW_ONLY_KEYS = [
  'done',
  'cancelled',
  'in progress',
  'to-do',
  'resolved',
  '{0}%',
  '{0} done',
  '{0} cancelled',
  '{0} in progress',
  'Required: {0}/{1}',
  'Optional: {0}/{1}',
  'Filter specs by status',
  'Filter by {0}',
  'Filter by {0} status',
  'Filter by {0} folder',
  'Filter by folder',
  'Open {0} for {1}',
  'Run tasks',
  'Run required tasks',
  'Run required and optional tasks',
  'Sync Files',
  'A malformed spec cannot be run',
  'A malformed spec cannot be synced',
  'Run required tasks for {0}',
  'Choose run scope for {0}',
  'Run tasks for {0}',
  'Sync files for {0}',
  'Search specs by name',
  'Clear search',
  'No folders to filter',
  'Dashboard layout',
  'Global task statistics',
  'Active specs',
  'Completed specs',
  'Switch to list view',
  'Switch to grid view',
] as const;
/** Every message the webview may request (shared plus webview only). */
export const WEBVIEW_MESSAGE_KEYS = [...SHARED_KEYS, ...WEBVIEW_ONLY_KEYS] as const;
/** Every translatable message of the extension. */
export const MESSAGE_KEYS = [...SHARED_KEYS, ...HOST_ONLY_KEYS, ...WEBVIEW_ONLY_KEYS] as const;
/** A message of the catalogue. */
export type MessageKey = (typeof MESSAGE_KEYS)[number];
/** A message the webview is allowed to request. */
export type WebviewMessageKey = (typeof WEBVIEW_MESSAGE_KEYS)[number];
