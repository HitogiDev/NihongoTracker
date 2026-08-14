# @nihongotracker/yomitan-content

Renders Yomitan structured content — the glossary format every imported
dictionary uses — for both NihongoTracker clients.

Yomitan's own renderer is GPL-3.0 and cannot be copied into an MIT codebase, so
this is written from scratch against a census of all 435,448 Jitendex entries
(`SPIKE-hoshidicts.md` on the `spike/hoshidicts` branch). The Rust engine returns
the JSON tree untouched; everything here is presentation.

```tsx
import { StructuredContent, useLookupHistory } from '@nihongotracker/yomitan-content';

const history = useLookupHistory({ query: '食べる' });

<StructuredContent glossary={glossary} onLookup={history.push} />;
```

## What it renders

Closed on purpose, and the scope came from the data rather than from taste:

| | |
|---|---|
| Tags | `div` `span` `li` `ul` `ol` `ruby` `rt` `a` |
| `data-sc-content` | the eleven hooks above 10 % of entries, plus the `example-*` family |
| `data-sc-class` | `tag` `extra-box` `form-valid` |
| Inline style | `list-style-type` only — the ①②③ sense numbers |

`table`, `tr`, `th`, `td` and `img` are **out of this iteration**. They are not
dropped: an unsupported node renders its own contents, so the text survives, and
the occurrence is counted in `RenderDiagnostics.unsupportedTags`. Nothing
disappears silently.

## Security

The tree and the stylesheet both come out of a `.zip` the user chose to import,
so they are treated as hostile input.

- **No `innerHTML`, no `dangerouslySetInnerHTML`, anywhere.** Every node is built
  with `createElement` from a whitelisted tag. Text stays text.
- **No `href` is ever emitted.** An `<a>` becomes one of two things: a `<button>`
  that asks for another lookup, when the href is Yomitan's internal
  `?query=…&wildcards=off` form; or a `<span>` with the same text. There is no
  third branch, which is why `javascript:`, `data:` and `//host` need no
  blocklist — they simply are not the internal form.
- **Attributes are whitelisted and validated**: `lang` against a BCP-47 shape,
  `title` bounded, `data-sc-*` against `[A-Za-z][A-Za-z0-9_-]*` so a value cannot
  break out of a CSS selector, `list-style-type` against a keyword or a quoted
  string. Rejects are counted, not passed through.
- **The dictionary's stylesheet is scoped, never injected globally.**
  `scopeDictionaryCss(css, DICTIONARY_SCOPE_CLASS)` prefixes every top-level
  selector, rewrites `:root`/`html`/`body` to the scope itself, drops `@import`,
  `@font-face` and every other statement at-rule, and drops declarations that
  fetch from anywhere but a `data:` URI. Nested rules are left alone — Jitendex
  uses CSS nesting and a nested selector already inherits the scope.

## Styling

daisyUI semantic tokens only; no raw Tailwind palette, so the popup follows all
19 themes. The maps in `whitelist.ts` divide the work the way the data does:
**`data-sc-class` owns the shape** (the badge, the box) and **`data-sc-content`
owns colour and typography**, because `part-of-speech-info` always arrives with
`tag` and `xref` always arrives with `extra-box`. Give both a badge recipe and
you get `badge-sm badge-xs` with two competing colours on the same element.

The classes here are a floor. When the dictionary ships `styles.css` it selects
on the same `data-sc-*` attributes and layers on top.

## Strings

There are none. The renderer only ever shows dictionary content, and the popup
chrome — the back control, the empty state — belongs to whichever app is
mounting it, because both have their own i18n bundles. `useLookupHistory` gives
you the stack; you render the button and its label.

## This is a vendored copy — do not edit it here

Upstream is `packages/yomitan-content` in the desktop companion repository
(<https://github.com/HitogiDev/NihongoTrackerDesktopCompanion>), which is where
the tests and the fixtures live. This directory is a copy of that package's
`src/`, checked in so that this repository builds on its own: a clone with no
companion checkout next to it still runs `npm ci`, and so does the Docker image,
whose build context is this repository alone.

The two clients depend on the same source in two different ways:

- desktop companion — `file:packages/yomitan-content`, the real thing
- web frontend — `file:./vendor/yomitan-content`, this copy

A fix belongs upstream first, with a test; then re-copy `src/` here and update
the version below. Nothing else in this directory should diverge — if it ever
has to, the sharing is over and the package needs a registry.

Sync:

```bash
# from the root of this repository, with the companion checked out anywhere
rm -rf Frontend/vendor/yomitan-content/src
cp -r <companion>/packages/yomitan-content/src Frontend/vendor/yomitan-content/src
```

Vendored from upstream `0.1.0`. The upstream test suite (79 assertions, 31
snapshots over 30 real Jitendex entries) is not copied: it needs `vitest` and a
294 KB fixture, and it guards the package, not this consumer.
