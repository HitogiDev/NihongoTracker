/**
 * Keep this parser aligned with the user mention rule in
 * `Frontend/src/utils/markdown.ts`. Usernames use the registration charset.
 */
const USER_MENTION_REGEX =
  /(^|[^A-Za-z0-9_.+-])@([A-Za-z0-9_-]{1,20})(?![A-Za-z0-9_-])/g;
const FENCED_CODE_REGEX = /```[\s\S]*?(```|$)/g;
const INLINE_CODE_REGEX = /`[^`\n]*`/g;

/** Limit notifications from one text so that a mention list cannot spam users. */
export const MAX_MENTIONS_PER_TEXT = 10;

/**
 * Return the unique usernames that a markdown text mentions, in order.
 * Mentions inside code are ignored because the frontend shows them as code.
 * Comparison is case-insensitive, like the username index.
 */
export function extractMentionedUsernames(content: string): string[] {
  if (!content) return [];
  const text = content
    .replace(FENCED_CODE_REGEX, ' ')
    .replace(INLINE_CODE_REGEX, ' ');

  const seen = new Set<string>();
  const usernames: string[] = [];
  for (const match of text.matchAll(USER_MENTION_REGEX)) {
    const username = match[2];
    const key = username.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    usernames.push(username);
    if (usernames.length >= MAX_MENTIONS_PER_TEXT) break;
  }
  return usernames;
}

/** Return the mentions in `content` that `previousContent` did not have. */
export function extractNewMentions(
  content: string,
  previousContent = ''
): string[] {
  const previous = new Set(
    extractMentionedUsernames(previousContent).map((name) =>
      name.toLowerCase()
    )
  );
  return extractMentionedUsernames(content).filter(
    (name) => !previous.has(name.toLowerCase())
  );
}
