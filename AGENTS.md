# AGENTS.md

This file gives Codex and other coding agents repository-specific guidance. It applies to the entire repository.

## Project overview

NihongoTracker is a gamified Japanese immersion tracker with XP, levels, streaks, leaderboards, achievements, clubs, media tracking, and realtime texthooker sessions.

The repository is a monorepo with two independently versioned npm packages and no root `package.json`:

- `Backend/`: Express, TypeScript, MongoDB/Mongoose, Socket.IO, and Vitest. Source is in `Backend/src`; TypeScript compiles to `Backend/build`.
- `Frontend/`: React 19, TypeScript, Vite, TanStack Query, Zustand, Tailwind CSS v4, and daisyUI v5. Production output is `Frontend/dist`.

In production, the frontend build is copied to `Backend/dist`; Express serves the API, static frontend files, and the SPA fallback from one process.

## Working rules

- Run npm commands from `Backend/` or `Frontend/`, never from the repository root.
- Preserve unrelated user changes. The worktree may already be dirty.
- Do not use em dashes in UI copy, documentation, comments, or user-facing responses. Use commas, periods, colons, or parentheses instead.
- Both packages use ESM. Backend TypeScript imports use explicit `.js` extensions, including imports of `.ts` source modules.
- Keep backend code compatible with the strict settings in `Backend/tsconfig.json`, including unused-symbol and implicit-return checks.
- Prefer focused verification: typecheck/test the backend area changed, and lint/build the frontend area changed.
- There is no configured frontend test runner; verify UI behavior manually when appropriate.
- When adding an environment variable, update both the README environment table and `Backend/.env.example`.

## Code comment style

Apply the relevant word, verb, sentence, punctuation, and style rules from [ASD-STE100 Issue 9, Part 1](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf). This adapts the rules for source code. It does not claim full ASD-STE100 compliance.

- Keep a comment only when code and names do not explain a constraint, reason, edge case, compatibility rule, security rule, or contract.
- Delete comments that repeat the next statement, describe an obvious UI region, or preserve inactive code. Keep TODOs, license notices, generated-file markers, and tool directives.
- Write one idea per sentence. Use direct words, active voice, and consistent names. Use the imperative for instructions.
- Keep descriptive sentences to 25 words or fewer. Keep procedural instructions to 20 words or fewer. Split longer explanations into separate sentences or a list.
- Use full words and standard punctuation. Do not use contractions, semicolons as sentence punctuation, or em dashes. Prefer a direct verb to a noun that describes an action.
- Use dictionary words with their approved meaning and part of speech when verified. Keep code identifiers, protocol names, and domain terms exact as project terminology.
- Do not change behavior or user-facing copy while editing comments.
- Preserve the meaning of comments that document non-obvious behavior. Do not force dictionary substitutions that make a technical explanation less accurate.

## Common commands

### Backend

Run from `Backend/`:

```bash
npm run dev
npm run build
npm start
npm test
npm run test:watch
npm run test:coverage
npx vitest run path/to/file.test.ts
npx tsc --noEmit
npx eslint path/to/file.ts
npm run migrate:indexes
npm run migrate:indexes:prod
npm run seed:achievements
npm run backfill:achievements
npm run backfill:ranks
```

Backend tests live under `Backend/src/__tests__/**/*.test.ts`. Coverage is currently scoped to `src/services/achievements/**`. `npm run lint` runs the backend ESLint gate.

### Frontend

Run from `Frontend/`:

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

### Full production build

```bash
cd Frontend && npm run build
cd ../Backend && npm run build:frontend && npm run build && npm start
```

### Docker

`docker compose --env-file Backend/.env up -d` starts the app, MongoDB, and Meilisearch. `docker-compose.nginx.yml` targets an existing external nginx reverse-proxy network.

## Backend architecture

- `Backend/src/index.ts`: process bootstrap, database connection, Socket.IO setup, and background schedulers. Await the database connection before starting schedulers or listening.
- `Backend/src/app.ts`: Express middleware, routes, static/SPA serving, and error handlers.
- Standard layering: `routes/*.routes.ts` -> `controllers/*.controller.ts` -> `services/*` and `models/*.model.ts`.
- Shared interfaces and event types live in `Backend/src/types.ts`.
- Mongoose files use `*.model.ts`; route files use `*.routes.ts`; controller files use `*.controller.ts`.

### Authentication and errors

`middlewares/authMiddleware.ts` supports an `x-api-key` first, then a JWT in an httpOnly cookie. `protect` requires identity; `optionalProtect` attaches `res.locals.user` when available. Authentication also rejects banned users and checks Patreon tier expiry.

Throw `customError(message, statusCode, kind?)` from controllers/services and pass failures to the global handler. `errorMiddleware.ts` normalizes Mongoose and JWT errors. Keep unmatched API handling before the SPA catch-all.

Password reset tokens are random 256-bit values. Store only their SHA-256 hashes and consume them atomically with the password update. Use `libs/password.ts` for password hashing. Configure `TRUST_PROXY` with actual proxy IPs or CIDRs before relying on client IP limits behind a proxy.

File replacements use `FileUploadBatch`. Commit cleanup after the database stores the new URLs. Roll back new uploads when persistence fails.

### Logs and XP

Daily, weekly, and custom period goals can optionally filter progress by a log's media type. A missing or null media type counts all logs. Keep the goal media type options aligned with the log schema, and calculate recurring progress per goal so goals with the same metric can track different media.
Username-based goal reads use optional authentication and `services/goalVisibility.ts` to enforce profile and statistics privacy. Forecasts remain private authenticated records.
Custom period goal dates include both their start and target days in the owner's timezone. Presets use Sunday through Saturday for This Week, calendar boundaries for This Month, and count today as the first of Next X days. Keep creation, editing, validation, and progress aligned on these date rules.

`models/log.model.ts` is the central immersion model. Valid log types are `light-novel|reading|anime|vn|video|manga|audio|movie|tv show|other|game`.

- `light-novel` can match AniList media.
- `reading` is a free-form, non-matchable reading bucket.
- Both count toward the reading immersion category.
- Required `episodes`, `pages`, `time`, and `chars` fields depend on the log type through schema functions. Check the model before changing validation.
- Production indexes are managed explicitly with `npm run migrate:indexes:prod`; schema indexes are automatically applied only in development.

XP formula v3 uses 135 base XP per credited hour. Difficulty is normalized from Jiten's 0-5 scale. Effective comfort is the category-level estimate corrected by at most ±0.25 Jiten using the hours-weighted median from the last 90 days after 10 tagged hours. The challenge bonus grows from 0% at comfort to 30% at comfort +0.5 Jiten, capped at Jiten 5. Treat this as relative challenge, not measured comprehension. Keep log creation, imports, AniList sync, preview, migration, and calculator on `services/xp.ts`.

Club goals and opt-in challenges share the unified objective model in `models/clubChallenge.model.ts` and `services/clubObjectives.service.ts`. Use `mode: collective` for club-wide progress and `mode: individual` for participant-based progress. Legacy embedded `clubGoals` are mirrored lazily by `syncLegacyClubObjectives` so existing clubs remain compatible.

### Achievements

`services/achievements/achievementEngine.ts` dispatches by `condition.type`; implementations live in `services/achievements/conditions/*.condition.ts`. When adding a condition type, add its evaluator, its engine switch case, and a test under `Backend/src/__tests__/achievements/conditions/`.

### Profile customization

`services/customization.ts` owns unlock and downgrade rules. When adding a capability, update `CustomizationCapabilities`, `getCustomizationCapabilities`, `getDisplayCapabilities`, and `FULL_PAID_ACCESS` together.

The frontend mirrors customization enums in `Frontend/src/types.d.ts` and maps them in `Frontend/src/utils/customization.ts` plus `Frontend/src/customization.css`. Do not spread Mongoose customization subdocuments; copy fields explicitly because values are exposed through prototype getters. Respect `prefers-reduced-motion` for animated cosmetics.

Use `UserAvatar` for portraits in headers and settings previews. Legacy frames center a child of fixed size with symmetric padding. Rainbow animates only its background pseudo-element.

Decorative avatar frames (`hearts`, `starlight`, `sigil`, and `fireflies`) use SVG assets in `Frontend/src/assets/avatar-frames/`. Render frames through `components/AvatarFrame.tsx`, including profile and settings previews. `utils/avatarFrameLayers.ts` prepares static SVG images with baked glow and mirrors their animations onto HTML layers with Web Animations. These layers animate only transform and opacity so the browser can composite them with hardware acceleration. Pause layers outside the viewport and while the document is hidden. Keep the original SVG background for fallback and reduced motion. Reference fallback assets from `customization.css` with relative URLs and `?no-inline` so Vite tracks updates and emits content-hashed files. Do not place them at fixed public URLs because Express caches SVGs as immutable for one year. Each SVG remains the source of its layer animations and reduced-motion rule. Keep the 240-unit SVG viewport proportional to the 160-unit avatar, with the overlay extending 25% on each side. Do not rotate or resize the entire overlay to animate its individual ornaments.

Frames adapted from `E:/Coding/pacote-bordas` use CSS for `rainbow`, `segmented`, `gradient`, `sweep`, and `crystal`. Crystal uses a bright solid ring and a broad moving white highlight over the portrait. `text` uses a circular SVG text path. `electric` and `petals` use `utils/proceduralAvatarFrames.ts`, with canvas sizes proportional to the portrait. Pause canvas animation outside the viewport, in hidden documents, and for reduced motion. Save custom palettes for Gradient, Segmented, and Sweep in `frameColor1`, `frameColor2`, and `frameColor3`; Rainbow keeps its fixed spectrum. Save circular text in `frameText` and its SVG fill color in `frameColor1`. Consumer frames include Aura, Starlight, Crimson Sigil, Fireflies, Electroshock, Crystal, and Petals. Rainbow, Segmented, Gradient, Sweep, Text, Neon, Sakura, and Hearts require Enthusiast or Consumer access. Retired frame values fall back to `none`; the schema accepts them so unrelated profile saves remain valid.

The animated username effect `aura` uses the selected name colors and a continuously cycling color band. Keep the linear color cycle separate from the glow pulse. Glow uses `nameColor1` for the letters and `nameColor2` for the halo. It requires Enthusiast or Consumer access. `namePulseIntensity` accepts integers from 0 to 100, and `namePulseSpeed` accepts durations from 0.5 to 6 seconds. Keep its settings controls, validation, defaults, and reduced-motion behavior aligned across the backend and frontend.

The `constellations` frame reads SVG paths and star positions into vector canvas drawing in `utils/canvasAvatarFrames.ts`. It renders ambient stars around the avatar and Orion, Capricornus, and Lyra over it. SVG `data-stars` routes define each figure's connections through star IDs. Keep those connections explicit. Ambient stars orbit slowly and fade independently at different speeds and phases. Named figures form one at a time in this order: Orion, Capricornus, Lyra. Reveal stars along their routes at 0.28-second intervals, with a 0.18-second fade. Fade each connection in over 0.75 seconds, starting when its second endpoint appears. Draw connections only when both endpoint stars are visible. Hold the complete figure for 1.3 seconds after the final line finishes its fade, fade it over 0.65 seconds, then wait 0.25 seconds before the next figure. Keep radial drift small for named figures to preserve their shapes. Keep star cores sharp and draw glow separately. `frameColor1` sets the star, connection, and glow color. Pulse the glow separately from the star and connection reveal. Preserve the selected color in the static SVG fallback for reduced motion and canvas failures. Do not rasterize stars into fixed-resolution sprites. `utils/avatarCanvas.ts` sizes canvas buffers from displayed bounds, device pixel ratio, and visual viewport scale. `AvatarFrame` observes resolution, window, and visual viewport changes so zoom redraws Constelaciones and the other active canvas frames. Canvas effects pause outside the viewport or while the document is hidden. Reduced motion and canvas failures use the static SVG fallback. Removed frame values fall back to `none` when reading or updating customization. The schema accepts retired stored values so unrelated profile saves remain valid.

Banner effects use `BannerEffectOverlay` and vector canvas drawing in `utils/bannerEffects.ts`. Stars read the Constellations SVG shape; fireflies match the green avatar light and petals match its Sakura silhouette. Snow combines distant dots and six-arm flakes. Each particle has independent motion, size, and phase. SVG particles remain visible for reduced motion or canvas failure. Use the shared canvas resolution observers for zoom, and pause animation outside the viewport or in hidden documents.

### Immersion forecasts

`ImmersionForecast` stores private, media-linked finish plans. Target totals are snapshotted at creation; progress and daily pacing are derived from matching logs by `services/immersionForecast.service.ts`. Creation and deadline edits require active Enthusiast/Consumer access, while owners retain read/delete access after downgrade. Keep these records out of username-based public goal responses.

### Notifications

Stored notifications use `models/notification.model.ts` and `services/notifications.service.ts`. For a new notification kind:

1. Add it to `NOTIFICATION_TYPES` in `Backend/src/types.ts`.
2. Mirror it in `Frontend/src/types.d.ts`.
3. Add its visual mapping in `Frontend/src/utils/notifications.ts`.
4. Emit it with `createNotification(...)` at the event source.

Use `groupKey` for collapsible repeat events and the provided decrement/removal helpers when an underlying event is undone.

### AniList sync

AniList OAuth and automatic logging live in `services/anilistSync.service.ts` and `controllers/anilist.controller.ts`. The scheduler polls linked accounts every 30 minutes. Each watched-episode activity uses `anilistActivityId` as its idempotency key. Keep its unique partial index synchronized with `scripts/migrate-indexes.js`.

Manga activity is intentionally skipped because AniList chapter progress cannot map honestly to the page/character/time units required by manga logs. Parsing belongs in dependency-free `services/anilistActivity.ts`. Sync-created logs apply XP, streak, and achievement updates inside the service because they bypass normal request middleware.

### Search, external data, and realtime

- Meilisearch integration is under `services/meilisearch/`. Keep document/index shape changes aligned with Mongoose models.
- VNDB and IGDB metadata use scheduled dump synchronization; AniList and YouTube also have live lookup paths.
- Socket.IO texthooker authentication is in `Backend/src/index.ts`. Room handlers are in `services/textSessionSocket.ts` and the client is in `Frontend/src/screens/HookerScreen.tsx`. Treat event names and payloads as a shared wire contract. Require authenticated hosts and check room membership plus its host token for each mutation. Keep shared rooms until their 24-hour expiry.
- Desktop LunaHook input reaches the browser through `NativeHookBridge` and a loopback WebSocket URL in the `ntdc` fragment. Validate it with `nativeBridgeUrl`, match every line to the reader's content ID, and preserve line IDs for server deduplication. This mode disables the external hooker WebSocket. Hook selection is saved by the desktop bridge. Keep the bridge token out of API requests and persisted settings.
- The browser bridge accepts `set-source` with `lunahook` or `websocket` and an optional `requestId`. The `source-changed` reply returns the request ID and confirmed hook status. Native status includes `websocket_selected` and can complete a pending source change. A compact daisyUI join selects one input for the session. Hook options appear only for LunaHook. WebSocket mode keeps the saved native hook and suppresses native lines until LunaHook is selected again. Failed or timed out requests release the controls.
- Texthooker room state is stored in `TextSession` with a 24-hour TTL. Socket authentication parses the JWT cookie separately from Express middleware.
- Swagger UI is mounted at `/api/docs`.

## Frontend architecture

- `Frontend/src/main.tsx` defines a `createBrowserRouter` tree with route-level lazy imports.
- Protected routes use `contexts/protectedRoute.tsx`. Texthooker and normal app pages occupy separate protected route blocks.
- Nested layouts render children through `<Outlet>`.
- TanStack Query owns server state; API calls belong in `src/api/*.ts`.
- Media matching shares selection in `hooks/useMatchingSelection.ts`, mutations in `hooks/useMediaAssignment.ts`, and automatic matching in `hooks/useAutoMatch.ts`. `utils/mediaMatching.ts` owns exact title matching and batches of 50 assignments. Compare selected logs by ID.
- `axiosConfig.ts` enables credentials and sends 401 handling to the Zustand user store.
- `store/userData.ts` owns persisted user/auth state under the `userData` localStorage key. Clear the query cache on logout, expiry, and account changes. Merge partial user updates only within the same account. Theme values are intentionally preserved separately and premium themes fall back safely on logout.
- Active Enthusiast/Consumer patrons and admins can save and use up to 10 named palettes in `settings.customThemes` through `PUT /api/users/me/custom-themes`. Only active Consumer patrons and admins can select `settings.profileThemeId` to expose one palette on public profile responses. `ProfileHeader` temporarily applies it to the document so the header, profile, and footer share it, then restores the visitor's theme on exit. The local `theme` selection is `custom` with a separate `customThemeId`; `utils/appTheme.ts` applies the selected colors and clears overrides when switching themes or logging out. The legacy `settings.customTheme` palette is read as a named theme until the next save.
- `App.tsx` maps paths to document titles and implements scroll restoration. Add titles there for new top-level routes.

## Frontend UI conventions

The project uses Tailwind CSS v4 and daisyUI v5. `npm run lint` runs ESLint and `scripts/lint-ui.mjs`; follow the repository rules instead of relying on visually plausible classes.

### Shared primitives

Prefer components from `Frontend/src/components/ui/`: `Button`, `buttonClass`, `BTN`, `Modal`, `Field`, `PageContainer`, `Spinner`, `PageLoader`, `Skeleton`, and `RowButton`.

Button class order is `btn` -> color -> style -> behavior -> size -> shape. Canonical patterns include:

- Primary form/page action: `btn btn-primary`; full-width commit: `btn btn-primary btn-lg w-full`.
- Destructive confirmation: `btn btn-error`; cancellation: `btn btn-ghost` at the same size.
- Toolbar action: `btn btn-sm`, optionally with `btn-primary`, `btn-outline`, or `btn-error`.
- Icon-only: `btn btn-ghost btn-sm btn-square`; modal close: `btn btn-ghost btn-sm btn-circle`.
- Pagination: `join-item btn btn-sm`, with `btn-active` when selected.
- Segmented control: `join-item btn btn-outline btn-sm`, with `join-item btn btn-primary btn-sm` when selected.

### daisyUI v5 constraints

Do not use removed v4 classes: `input-bordered`, `select-bordered`, `textarea-bordered`, `file-input-bordered`, `form-control`, `label-text`, `label-text-alt`, `tabs-boxed`, `card-compact`, or `tab-lg`. Use `tabs-box`, `card-sm`, and a size class on the tabs container where applicable.

`loading` is not a button modifier in v5. Disable the button and render a child `<Spinner>`.

### Surfaces, forms, layout, and color

- Use `surface`, `surface-muted`, and `surface-raised` utilities from `index.css`; they own background, border, radius, and elevation.
- Only `shadow-sm` and `shadow-lg` are allowed app-wide.
- Surface radius comes from `rounded-box`, not `rounded-lg`.
- Do not move radius token definitions into individual daisyUI theme blocks; `:root, [data-theme]` pins consistent geometry across themes.
- Modals use `<dialog className="modal modal-bottom sm:modal-middle">`. Do not tint `modal-backdrop`.
- New form controls use `<Field>`. Use `focus:input-primary`; set textarea height with `rows`.
- For choice menus, prefer the shared `DropdownSelect` component, which uses the daisyUI dropdown pattern. Do not replace a requested dropdown with a native `<select>`.
- Render dropdown menus in a portal with fixed viewport positioning. Menus inside cards must overflow beyond the card without clipping or making the card scrollable.
- The navbar is absolute and 80 px high. Use `pt-20`/`HEADER_OFFSET` when a child container supplies normal vertical padding, and `pt-28`/`HEADER_OFFSET_CONTENT` when content begins directly below the offset.
- Use daisyUI semantic colors. Media colors live only in `constants/mediaColors.ts`; chart colors come from `useThemeColors()`.
- Use `lucide-react` icons sized by Tailwind classes, not the numeric `size` prop.
- Date fields accept direct `YYYY-MM-DD` text entry and retain the `react-day-picker` calendar with the `rdp-themed` Create Log appearance. Reuse `components/ui/DatePickerInput.tsx` for all date inputs; do not add native `<input type="date">` controls or calendar-only replacements.
- Never interpolate Tailwind class fragments. Map variants to complete literal class strings so Tailwind v4 can detect them.

## Maintaining this guidance

This is the repository's source of truth for coding-agent guidance. If architectural behavior changes, update this file alongside the relevant code and documentation.
