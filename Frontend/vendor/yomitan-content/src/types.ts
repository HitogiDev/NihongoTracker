/**
 * Yomitan structured content, as it arrives from an imported dictionary.
 *
 * The shape is the dictionary's, not ours: it comes out of a `.zip` the user
 * chose, so every field here is untrusted input and nothing may be assumed
 * about it beyond "it parsed as JSON".
 */

export type StructuredContentNode =
  | string
  | number
  | StructuredContentNode[]
  | StructuredContentElement;

export interface StructuredContentElement {
  tag?: unknown;
  content?: unknown;
  /** `data-sc-*` hooks the dictionary's own stylesheet selects on. */
  data?: unknown;
  style?: unknown;
  lang?: unknown;
  title?: unknown;
  href?: unknown;
  [key: string]: unknown;
}

/** One glossary of a term. Either a plain string or a structured tree. */
export type Glossary = string | { type?: unknown; content?: unknown };

/** What a click on an internal dictionary link asks for. */
export interface LookupRequest {
  /** The term to look up, already percent-decoded. */
  query: string;
  /** The reading Yomitan suggests for disambiguation, when the link carries one. */
  reading?: string;
}
