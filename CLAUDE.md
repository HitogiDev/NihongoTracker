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

**Realtime/Texthooker**: `HookerScreen.tsx` is the socket.io-client counterpart to the backend's texthooker rooms — treat the wire protocol (event names like `join_room`, `send_line`, `delete_lines`, `restore_lines`, `room_users_update`) as shared contract between `Backend/src/index.ts` and this screen.

## Cross-Cutting Conventions

- Both packages use ESM (`"type": "module"` in both `package.json`s). Backend imports use explicit `.js` extensions even for `.ts` source files (required by `moduleResolution: node16`) — follow this pattern when adding new backend imports.
- Backend `tsconfig.json` is strict (`strict`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`) — new code must satisfy these.
- Shared backend types (interfaces like `ILog`, `IAchievement`, Socket.IO event types `IServerToClientEvents`/`IClientToServerEvents`) live in `Backend/src/types.ts`.
- Environment variables are documented in the README's table and mirrored in `Backend/.env.example`; update both when adding a new required/optional var.
- Data model naming: Mongoose models are `*.model.ts` exporting a default `model<Interface>(...)`; routes are `*.routes.ts`; controllers are `*.controller.ts` — keep new features consistent with this triad.
