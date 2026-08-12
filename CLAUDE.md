# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NihongoTracker is a Japanese immersion tracker (gamified: XP, levels, streaks, leaderboards, achievements, clubs). It's a monorepo with two independently-versioned npm packages:

- `Backend/` — Express + TypeScript + MongoDB (Mongoose) API, served from `Backend/src`, compiled to `Backend/build`. In production it also serves the built frontend as static files and handles the SPA fallback (see `Backend/src/app.ts`).
- `Frontend/` — React 19 + TypeScript + Vite SPA, built to `Frontend/dist` and copied into `Backend/dist` for production serving.

There is no root `package.json` — always `cd Backend` or `cd Frontend` before running npm scripts.

## Common Commands

### Backend (`cd Backend`)

```bash
npm run dev              # tsx watch — dev server with hot reload (port from .env, default 3000)
npm run build             # tsc compile to build/
npm start                 # run compiled server (node build/index.js)
npm test                  # vitest run (single run)
npm run test:watch        # vitest watch mode
npm run test:coverage     # vitest with coverage (scoped to services/achievements/**)
npx vitest run path/to/file.test.ts   # run a single test file
npx tsc --noEmit          # typecheck only
npm run migrate:indexes   # run MongoDB index migration script (dev)
npm run migrate:indexes:prod  # same, with NODE_ENV=production
npm run seed:achievements     # seed achievement definitions
npm run backfill:achievements # backfill achievement unlocks for existing users
npm run backfill:ranks        # replay past weeks to award weekly leaderboard achievements
```

Tests live in `Backend/src/__tests__/**/*.test.ts` (configured in `vitest.config.ts`). Coverage is currently scoped to the achievement engine (`src/services/achievements/**`). There is no backend lint script configured despite eslint being a devDependency — use `npx eslint <path>` directly if needed, and `npx tsc --noEmit` for type checking.

### Frontend (`cd Frontend`)

```bash
npm run dev       # Vite dev server, http://localhost:5173, HMR enabled
npm run build      # tsc build + vite build -> dist/
npm run lint       # eslint . --ext ts,tsx --max-warnings 0
npm run preview    # preview a production build locally
```

There is no frontend test runner configured — verify UI changes manually via `npm run dev`.

### Full production build

```bash
cd Frontend && npm run build
cd ../Backend && npm run build:frontend && npm run build && npm start
```

`build:frontend` copies `Frontend/dist` into `Backend/dist`; Express then serves both the API and the SPA from one process/port in production.

### Docker

`docker compose up -d` runs app + MongoDB + Meilisearch together (see README for env setup). `docker-compose.nginx.yml` is the variant for an existing external nginx reverse-proxy network.

## Backend Architecture

Entry points: `Backend/src/index.ts` (process bootstrap: connects DB, starts Socket.IO, kicks off background schedulers) wraps `Backend/src/app.ts` (the Express app: middleware, routes, static/SPA serving, error handlers).

**Layering convention**: `routes/*.routes.ts` → `controllers/*.controller.ts` → `services/*` / `models/*.model.ts`. Routes wire middleware (`protect`/`optionalProtect`, `checkPermission`) to controller handlers; controllers hold request/response logic; services hold reusable business logic (XP/level math, achievement evaluation, external API integration, search indexing).

**Auth** (`middlewares/authMiddleware.ts`): dual authentication — requests are checked first for an `x-api-key` header (hashed and looked up in `ApiKey` model), then fall back to a `jwt` httpOnly cookie. `protect` requires a valid identity; `optionalProtect` attaches `res.locals.user` if present but never rejects. Banned users are rejected with a `customError`; Patreon tier auto-expiry is checked on every authenticated request.

**Error handling** (`middlewares/errorMiddleware.ts`): throw `customError(message, statusCode, kind?)` anywhere in controllers/services and let it bubble to `next()`; the global `errorHandler` normalizes Mongoose `CastError`/`ValidationError` and JWT errors into consistent HTTP responses. `notFoundHandler` catches unmatched API routes before the SPA catch-all.

**Achievements** (`services/achievements/`): `achievementEngine.ts` is a dispatcher keyed on `condition.type` (streak, totalXp, logCount, mediaType, level, totalHours, mediaTypeHours, achievementCount, logTimeRange, logOnDate, singleDayHours, weeklyHours, sessionsInDay, platformAge). Each condition type has its own evaluator module in `services/achievements/conditions/*.condition.ts` returning `{ met, progress }`. `cronAchievements.service.ts` runs periodic re-evaluation. When adding a new achievement condition type, add both the evaluator module and a case in the engine's switch, plus a test under `__tests__/achievements/conditions/`.

**Profile customization** (`services/customization.ts` + `user.customization`): cosmetics users equip — name effect (+ custom colors), avatar frame, profile accent (a preset or the user's own hex in `accentColor`), signature stat, equipped title (an unlocked achievement `key`), and ambient banner effect. The service owns *all* unlock rules: merit (level/achievements) or an active Patreon tier (`isPremium` = any tier, `isPremiumPlus` = enthusiast/consumer). `GET /api/users/me/customization` returns every option with `unlocked` + `lockReason` so the settings UI never re-implements the rules; `PATCH` merges a partial patch through `resolveCustomizationUpdate`, which rejects anything not unlocked. Read paths (`getUser`, the ranking aggregations) pass the stored value through `sanitizeCustomizationForDisplay` so an expired supporter stops rendering paid cosmetics without a migration; the loss is also *persisted* by a `pre('save')` hook on the user model (`applyPatreonCustomizationDowngrade` → `getCustomizationDowngrade`), which runs on every save because the tier is cleared from half a dozen places (webhook, OAuth sync, unlink, admin panel, manual-expiry in `authMiddleware`) and nested writes like `user.patreon.isActive = false` do not show up in `isModified('patreon')`. Never spread a Mongoose subdocument to copy these values — build the object field by field (the values sit behind prototype getters). The frontend mirrors the enums in `Frontend/src/types.d.ts`, maps them to CSS in `Frontend/src/utils/customization.ts` + `Frontend/src/customization.css` (hand-written classes, since the class names are assembled at runtime and Tailwind would purge utilities), and renders them in `ProfileHeader`, `UserAvatar` (`frame` prop), `ImmersionHeatmap` (`accent` prop) and `RankingScreen`. The accent works by overriding DaisyUI's `--color-primary`/`--color-accent` on the profile wrapper in `ProfileHeader` (`getProfileAccentStyle`), so every component inside the profile inherits it while the visitor's own theme is untouched. Animated cosmetics are disabled under `prefers-reduced-motion`; the settings tab detects it with `useReducedMotion` and says so, otherwise users read frozen animations as a bug.

**Notifications** (`models/notification.model.ts` + `services/notifications.service.ts`): generic, stored per-recipient. To emit a new kind of notification, add the string to `NOTIFICATION_TYPES` in `Backend/src/types.ts` (mirror it in `Frontend/src/types.d.ts`), give it an icon/accent in `Frontend/src/utils/notifications.ts`, and call `createNotification({ recipient, actor, type, title, link, ... })` at the event source — the controller, the bell and the notifications page are type-agnostic. Repeat events collapse via `groupKey` (count increments); use `decrementNotification`/`removeNotifications` when the underlying event is undone (unlike, deleted review). Club join requests and changelog entries are still *derived* on read in `notifications.controller.ts` and merged with the stored ones.

**AniList automatic logging** (`services/anilistSync.service.ts` + `controllers/anilist.controller.ts`): users link an AniList account via OAuth (`ANILIST_CLIENT_ID`/`ANILIST_CLIENT_SECRET`; tokens last a year and there is *no* refresh grant, so expiry means re-linking). `anilistSyncScheduler.ts` polls every linked account every 30 minutes, and `/api/anilist/sync` (incremental) / `/api/anilist/backfill` (whole feed) do it on demand. Each "watched episode" ListActivity becomes one anime log carrying `anilistActivityId` — the dedupe key that makes every path idempotent (unique partial index, mirrored in `scripts/migrate-indexes.js` for production). Manga is deliberately skipped: AniList counts chapters, which has no honest mapping onto the pages/chars/time a manga log needs. Sync-created logs bypass the `calculateXp` middleware, so XP, streaks and achievements are applied by the service itself (`computeXp` → `recalculateUserXpFromLogs` → `recalculateStreaksForUser` → `checkAchievements`); parsing rules live in the dependency-free `services/anilistActivity.ts` so they stay testable.

**External data sync**: VNDB and IGDB (game) metadata are synced via scheduled dump downloads/parsers (`vndbDump*.ts`, `igdbDump*.ts` in `services/`) rather than per-request live calls, with sync state tracked in `vndbDumpSyncState.model.ts` / `igdbDumpSyncState.model.ts`. Live/on-demand lookups exist separately for AniList (GraphQL, `searchAnilist.ts`) and YouTube (`searchYoutube.ts`).

**Search** (`services/meilisearch/`): Meilisearch indexes for users and media are (re)initialized and fully synced on server startup (`index.ts` waits up to 90s for Meilisearch to become reachable before syncing). Keep index/document shape changes in sync between `mediaIndex.ts`/`userIndex.ts` and the corresponding Mongoose models.

**Realtime / Texthooker** (`index.ts` Socket.IO section): a room-based collaborative text-capture feature. One socket is the `host` (creates the room, gets a `hostToken`, can delete/restore lines), others join as `guest`. Room state persists in `TextSession` documents with a TTL (`expireAt`, 24h); the room's Mongo doc is deleted when the last socket disconnects. Socket auth reads the `jwt` cookie from the handshake headers manually (Socket.IO doesn't share Express middleware).

**Logs** (`models/log.model.ts`): the central data model — one log per immersion session, `type` is one of `reading|anime|vn|video|manga|audio|movie|tv show|other|game`. Required fields (`episodes`/`pages`/`time`/`chars`) are conditionally required based on `type` via schema-level `required()`/`default()` functions — check this file before changing validation for any media type. Indexes are defined in-schema but only applied in `development`; production indexes are managed explicitly via `npm run migrate:indexes:prod` (see comment in the model).

**API docs**: Swagger UI is mounted at `/api/docs` (`swagger.ts`).

## Frontend Architecture

**Routing** (`main.tsx`): a single `createBrowserRouter` tree with route-level code splitting (every screen/heavy component is `lazy()`-imported). Auth-gated routes are wrapped in `<Route element={<ProtectedRoutes />}>` (from `contexts/protectedRoute.tsx`) — there are two separate protected blocks (texthooker routes outside the main `<App>` layout, and app routes like `/log`, `/settings` inside it). Nested layouts use an outer route with a header component (e.g. `ProfileHeader`, `MediaHeader`, `ClubMediaHeader`) and child `<Route index>`/named routes rendering into it via `<Outlet>`.

**State**:

- Server state — TanStack Query (`queryClient.ts`), API calls centralized in `src/api/*.ts` (`trackerApi.ts` for the main backend, `anilistApi.ts`, `clubApi.ts`, `notificationsApi.ts`). `axiosConfig.ts` sets `withCredentials: true` (cookie-based auth) and globally intercepts 401s to call `useUserDataStore.getState().handleTokenExpiration()`.
- Client/auth state — Zustand store (`store/userData.ts`), persisted to localStorage under key `userData`. Note the theme-preservation dance in `setUser`/`logout`: theme and texthooker-theme are deliberately kept in `localStorage` independent of the persisted user blob, and reset to safe defaults (`FREE_THEMES`/`FREE_TEXTHOOKER_THEMES`) on logout since premium themes are Patreon-gated.

**Page titles**: `App.tsx` derives `document.title` from the current pathname in a large manual `getTitle()` switch — add a branch there when adding a new top-level route. It also has custom scroll-restoration logic (`ScrollToTop`) that intentionally skips resetting scroll when navigating between tabs of the same media page (overview/reviews/social).

**Styling**: Tailwind CSS v4 + DaisyUI v5, theme controlled via `data-theme` attribute on `<html>`, driven by `theme-change` + the localStorage-based logic described above (supports `light`/`dark`/`system`).

## UI Conventions (Frontend)

daisyUI is **v5**. These classes were removed in v5 and are no-ops — `npm run lint` fails on them: `input-bordered`, `select-bordered`, `textarea-bordered`, `file-input-bordered`, `form-control`, `label-text`, `label-text-alt`, `tabs-boxed` (now `tabs-box`), `card-compact` (now `card-sm`), `tab-lg` (size lives on the container: `tabs-lg`). `loading` is **not** a `btn` modifier in v5 — it masks the button down to 1.5rem; use `disabled` plus a child `<Spinner>`.

**Shared primitives** live in `Frontend/src/components/ui/`: `Button` (+ `buttonClass()` for `<a>`/`Link`/`<label>`), `BTN` recipes in `buttons.ts`, `Modal`, `Field`, `PageContainer`, `Spinner`/`PageLoader`, `Skeleton`, `RowButton`. Prefer them over hand-written classes.

One canonical value per role:

| Role | Class |
|---|---|
| Page/form primary | `btn btn-primary` (full-page commit: `btn btn-primary btn-lg w-full`) |
| Destructive confirm | `btn btn-error` · Cancel: `btn btn-ghost` (same size as its sibling) |
| Toolbar action | `btn btn-sm` (+ `btn-primary` / `btn-outline` / `btn-error`) |
| Icon-only | `btn btn-ghost btn-sm btn-square` · dense row `btn-xs` · page header `btn btn-ghost btn-square` |
| Modal close X | `btn btn-ghost btn-sm btn-circle` · chip/input clear `btn btn-ghost btn-xs btn-circle` |
| Hero CTA | `btn btn-primary btn-lg px-8` / `btn btn-ghost btn-lg px-8` |
| Pagination | `join-item btn btn-sm`, selected adds `btn-active` |
| Segmented control | `join-item btn btn-outline btn-sm`, selected `join-item btn btn-primary btn-sm` |

Class order is always `btn` → colour → style → behavior → size → shape.

**Surfaces** use the `@utility` classes in `index.css`, which own background, radius, border and elevation: `surface` (resting panel — also `card surface`), `surface-muted` (inset), `surface-raised` (dropdown/popover/floating). Only two elevations exist app-wide: `shadow-sm` and `shadow-lg`; `shadow`, `shadow-md`, `shadow-xl`, `shadow-2xl` are lint errors. Radius on a surface comes from `rounded-box`, never `rounded-lg`.

**Geometry** (`--radius-*`, `--size-*`) is pinned for all 19 themes by one unlayered `:root, [data-theme]` rule in `index.css` — daisyUI ships a different radius scale per theme, so without it the same markup has different corners depending on the theme. Do not set radius tokens inside a `@plugin "daisyui/theme"` block.

**Modals** are `<dialog className="modal modal-bottom sm:modal-middle">`. Never tint `modal-backdrop` — `.modal` already dims to 0.4 and a tint stacks a second layer. `modal-box` is already `max-width: 32rem`, so `max-w-lg` on it is a no-op.

**Forms**: new fields use `<Field>` (`fieldset` / `fieldset-legend`). `focus:input-primary` is the only focus colour; textarea height comes from `rows`, not `h-*`. Captions still written as `<label className="label">` are covered by a compatibility rule in `index.css` — see the comment there before touching it.

**Pages**: the navbar is `absolute` and 80px tall (measured, not the bare 4rem daisyUI `navbar` min-height), so every page reserves it at the top. Which constant depends on where the page's own padding lives: `pt-20` (`HEADER_OFFSET` / `<PageContainer>`) when a child container supplies the gap (`container mx-auto px-4 py-8`), `pt-28` (`HEADER_OFFSET_CONTENT`) when content sits directly under the offset — navbar height plus the same 2rem the page is otherwise spaced by. `pt-20` with content directly under it leaves the title flush against the header. `pt-16`/`pt-24`/`pt-32` on a `min-h-screen` root are lint errors.

**Colour**: use daisyUI semantic tokens. Media-type colours live only in `constants/mediaColors.ts` (`MEDIA_TYPE_COLORS` for charts, `MEDIA_TYPE_CLASSES` for chrome); chart series read `useThemeColors()`. Raw Tailwind palette classes are a lint error outside the allowlist in `scripts/lint-ui.mjs` (medals, media-type identity colours, and text over user-uploaded images).

**Icons** are `lucide-react`, sized with className — `w-4 h-4` inline, `w-5 h-5` standalone, `w-6 h-6` section header, `w-12 h-12` empty state. The numeric `size` prop is a lint error.

**Never interpolate a class fragment** (`btn-${color}`, `loading-${size}`): Tailwind v4 scans source text and will not generate it. Use a map of complete literal class names.

`npm run lint` runs ESLint plus `scripts/lint-ui.mjs`, which enforces the rules ESLint selectors cannot see.

**Realtime/Texthooker**: `HookerScreen.tsx` is the socket.io-client counterpart to the backend's texthooker rooms — treat the wire protocol (event names like `join_room`, `send_line`, `delete_lines`, `restore_lines`, `room_users_update`) as shared contract between `Backend/src/index.ts` and this screen.

## Cross-Cutting Conventions

- Both packages use ESM (`"type": "module"` in both `package.json`s). Backend imports use explicit `.js` extensions even for `.ts` source files (required by `moduleResolution: node16`) — follow this pattern when adding new backend imports.
- Backend `tsconfig.json` is strict (`strict`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`) — new code must satisfy these.
- Shared backend types (interfaces like `ILog`, `IAchievement`, Socket.IO event types `IServerToClientEvents`/`IClientToServerEvents`) live in `Backend/src/types.ts`.
- Environment variables are documented in the README's table and mirrored in `Backend/.env.example`; update both when adding a new required/optional var.
- Data model naming: Mongoose models are `*.model.ts` exporting a default `model<Interface>(...)`; routes are `*.routes.ts`; controllers are `*.controller.ts` — keep new features consistent with this triad.
