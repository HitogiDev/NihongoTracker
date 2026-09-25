# Translation glossary — English → Spanish

Locked terms. Translate these the same way everywhere; do not improvise
synonyms per screen. English is the source of truth for all keys.

## Domain terms

| English | Spanish | Notes |
| --- | --- | --- |
| immersion | inmersión | |
| log (noun) | log | |
| log (verb) | loguear | |
| streak | racha | |
| XP | XP | not translated |
| level | nivel | |
| club | club (pl. clubes) | |
| texthooker | texthooker | product name, not translated |
| visual novel / VN | novela visual | |
| chars / characters | caracteres | |
| reading | lectura | |
| listening | escucha | |
| media | contenido | **not** *medios* |
| goal | objetivo | |
| ranking | clasificación | |
| leaderboard | tabla de clasificación | |
| review | reseña | |
| achievement | logro | |
| badge | insignia | |
| settings | ajustes | |
| anime | anime | not translated |
| manga | manga | not translated |

## Register

- Informal **tú**, never *usted*.
- Neutral international Spanish: no *vosotros*, no regional slang. The audience
  is Japanese learners worldwide.
- Prefer gender-neutral phrasing where it costs nothing
  ("te damos la bienvenida" over "bienvenido").

## Mechanics

- Interpolation is always named (`{{count}}`, `{{clubName}}`), never positional.
  Never accept a machine translation of a key with interpolation without
  checking word order — Spanish frequently reorders the placeholder.
- Plurals use i18next JSON v4 `_one` / `_other`. Spanish has the same two
  categories as English, so it is a 1:1 mapping.
- Spanish runs 15–25% longer than English. Check the narrowest breakpoints;
  DaisyUI `btn`, `tab`, `stat-title` and table headers overflow first.
