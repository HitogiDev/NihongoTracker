/**
 * profanityFilter.ts
 *
 * Lightweight offensive-text detection for user-supplied vanity strings
 * (currently the Patreon custom badge text). The goal is to reject slurs and
 * strong profanity — including common obfuscations (leetspeak, spacing) —
 * while keeping false positives low so ordinary words are not blocked.
 *
 * This is deliberately not a perfect filter: badge text is short, cosmetic,
 * and low-volume, so a curated word list with a few evasion defenses is enough.
 */

// Map look-alike characters back to letters so "n1gg3r" / "sh!t" normalize.
const LEET_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '@': 'a',
  $: 's',
  '!': 'i',
  '|': 'i',
};

function normalize(input: string): string {
  return input
    .toLowerCase()
    .split('')
    .map((ch) => LEET_MAP[ch] ?? ch)
    .join('');
}

/**
 * Slurs and strong profanity that are safe to match anywhere — they almost
 * never appear inside an innocent word, so matching them as substrings catches
 * compounds ("shithead", "motherfucker") and spaced-out evasion ("f a g g o t")
 * without tripping ordinary words.
 */
const SUBSTRING_BLOCKED = [
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'asshole',
  'bastard',
  'pussy',
  'whore',
  'slut',
  'wank',
  'jizz',
  'twat',
  'bollocks',
  'molest',
  'pedo',
  'rapist',
  'retard',
  'nigger',
  'nigga',
  'niglet',
  'faggot',
  'faggit',
  'kike',
  'chink',
  'gook',
  'wetback',
  'beaner',
  'tranny',
  'trannie',
  'shemale',
  'goyim',
  'raghead',
  'towelhead',
];

/**
 * Short / ambiguous terms that are real substrings of innocent words
 * ("ass"→class, "spic"→spicy, "coon"→raccoon, "rape"→grape). These are matched
 * only as whole tokens, with simple inflection handling, to avoid false
 * positives.
 */
const WORD_BLOCKED = [
  'ass',
  'cum',
  'cock',
  'dick',
  'spic',
  'coon',
  'dyke',
  'rape',
  'kys',
  'kkk',
  'nazi',
  'hitler',
];

const WORD_BLOCKED_SET = new Set(WORD_BLOCKED);

// Try to reduce an inflected token to its stem, handling the dropped-"e"
// case ("raping" -> "rap" -> "rape", "raped" -> "rap" -> "rape").
function stemVariants(token: string): string[] {
  const variants = new Set<string>([token]);
  const stripped = token.replace(/(ing|ers|er|es|ed|s)$/i, '');
  if (stripped && stripped !== token) {
    variants.add(stripped);
    variants.add(stripped + 'e');
  }
  return [...variants];
}

/**
 * Returns true if the text contains blocked slurs or profanity.
 */
export function containsOffensiveText(text: string): boolean {
  if (!text) return false;

  const normalized = normalize(text);

  // Substring pass over the de-spaced text: catches embedded, compound, and
  // spaced-out forms of the unambiguous terms.
  const collapsed = normalized.replace(/[^a-z]/g, '');
  for (const word of SUBSTRING_BLOCKED) {
    if (collapsed.includes(word)) return true;
  }

  // Whole-token pass for the ambiguous short terms.
  const tokens = normalized.split(/[^a-z]+/).filter(Boolean);
  for (const token of tokens) {
    for (const variant of stemVariants(token)) {
      if (WORD_BLOCKED_SET.has(variant)) return true;
    }
  }

  return false;
}
