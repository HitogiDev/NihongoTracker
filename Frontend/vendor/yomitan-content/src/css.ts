/**
 * Scope a dictionary's own `styles.css` to the popup.
 *
 * The stylesheet ships inside the `.zip` the user imported, so it is untrusted
 * and it must not be able to reach the rest of the page. Every top-level
 * selector is prefixed with the scope, `@import` and friends are dropped, and
 * external `url()` references are removed.
 *
 * Nested rules are left alone on purpose: Jitendex uses CSS nesting
 * (`li[data-sc-content="sense"] { & ul { … } }`), and a nested selector already
 * inherits the scope from its parent. Prefixing it again would break it.
 */

export interface ScopeResult {
  css: string;
  /** At-rules dropped whole, by name — `@import`, `@font-face`, … */
  droppedAtRules: Record<string, number>;
  /** Declarations dropped for referencing something outside the dictionary. */
  droppedDeclarations: number;
}

/** At-rules whose body is a normal rule list, so scoping recurses into them. */
const NESTING_AT_RULES = new Set(['media', 'supports', 'layer', 'container']);

export function scopeDictionaryCss(css: string, scope: string): ScopeResult {
  const result: ScopeResult = { css: '', droppedAtRules: {}, droppedDeclarations: 0 };
  if (typeof css !== 'string' || css.length === 0) return result;

  const scopeSelector = scope.startsWith('.') ? scope : `.${scope}`;
  result.css = scopeBlock(stripComments(css), scopeSelector, result).trim();
  return result;
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * One rule list. Walks characters rather than using a regex, because selectors
 * and declarations can only be told apart by which delimiter comes first, and
 * because braces nest.
 */
function scopeBlock(input: string, scopeSelector: string, result: ScopeResult): string {
  let out = '';
  let head = '';
  let index = 0;

  while (index < input.length) {
    const char = input[index];

    if (char === '{') {
      const body = readBlock(input, index);
      const prelude = head.trim();
      head = '';
      index = body.end;

      if (prelude.startsWith('@')) {
        const name = prelude.slice(1).split(/[\s(]/, 1)[0].toLowerCase();
        if (NESTING_AT_RULES.has(name)) {
          out += `${prelude} {${scopeBlock(body.inner, scopeSelector, result)}}\n`;
        } else {
          result.droppedAtRules[`@${name}`] = (result.droppedAtRules[`@${name}`] ?? 0) + 1;
        }
        continue;
      }

      out += `${scopeSelectors(prelude, scopeSelector)} {${sanitiseDeclarations(body.inner, result)}}\n`;
      continue;
    }

    if (char === ';' && head.trim().startsWith('@')) {
      // A statement at-rule: `@import url(...)`, `@charset "utf-8"`. Never kept.
      const name = head.trim().slice(1).split(/[\s(]/, 1)[0].toLowerCase();
      result.droppedAtRules[`@${name}`] = (result.droppedAtRules[`@${name}`] ?? 0) + 1;
      head = '';
      index += 1;
      continue;
    }

    head += char;
    index += 1;
  }

  return out;
}

/** The matching `}` for the `{` at `start`, and what is between them. */
function readBlock(input: string, start: number): { inner: string; end: number } {
  let depth = 0;
  for (let index = start; index < input.length; index += 1) {
    const char = input[index];
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return { inner: input.slice(start + 1, index), end: index + 1 };
    }
  }
  // Unbalanced input: treat the remainder as the block rather than dropping it.
  return { inner: input.slice(start + 1), end: input.length };
}

function scopeSelectors(prelude: string, scopeSelector: string): string {
  return prelude
    .split(',')
    .map((selector) => selector.trim())
    .filter((selector) => selector.length > 0)
    .map((selector) => {
      // `:root`/`html`/`body` would otherwise escape the scope entirely.
      if (/^(:root|html|body)\b/i.test(selector)) return scopeSelector;
      return `${scopeSelector} ${selector}`;
    })
    .join(', ');
}

/**
 * Declarations survive unless they reach outside the dictionary. `url(data:…)`
 * is fine; anything else is a request to a host the user never chose, from a
 * file they merely imported.
 */
function sanitiseDeclarations(body: string, result: ScopeResult): string {
  // A nested rule list inside a declaration block (CSS nesting) is kept as-is:
  // it is already under the parent's scope.
  return body
    .split(';')
    .filter((declaration) => {
      if (!/url\(/i.test(declaration)) return true;
      const safe = /url\(\s*['"]?data:/i.test(declaration);
      if (!safe) result.droppedDeclarations += 1;
      return safe;
    })
    .join(';');
}
