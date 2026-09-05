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
- Both packages use ESM. Backend TypeScript imports use explicit `.js` extensions, including imports of `.ts` source modules.
- Keep backend code compatible with the strict settings in `Backend/tsconfig.json`, including unused-symbol and implicit-return checks.
- Prefer focused verification: typecheck/test the backend area changed, and lint/build the frontend area changed.
- There is no configured frontend test runner; verify UI behavior manually when appropriate.
- When adding an environment variable, update both the README environment table and `Backend/.env.example`.

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

Backend tests live under `Backend/src/__tests__/**/*.test.ts`. Coverage is currently scoped to `src/services/achievements/**`. There is no backend lint script even though ESLint is installed.

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

`docker compose up -d` starts the app, MongoDB, and Meilisearch. `docker-compose.nginx.yml` targets an existing external nginx reverse-proxy network.

## Backend architecture

- `Backend/src/index.ts`: process bootstrap, database connection, Socket.IO setup, and background schedulers.
- `Backend/src/app.ts`: Express middleware, routes, static/SPA serving, and error handlers.
- Standard layering: `routes/*.routes.ts` -> `controllers/*.controller.ts` -> `services/*` and `models/*.model.ts`.
- Shared interfaces and event types live in `Backend/src/types.ts`.
- Mongoose files use `*.model.ts`; route files use `*.routes.ts`; controller files use `*.controller.ts`.

### Authentication and errors

`middlewares/authMiddleware.ts` supports an `x-api-key` first, then a JWT in an httpOnly cookie. `protect` requires identity; `optionalProtect` attaches `res.locals.user` when available. Authentication also rejects banned users and checks Patreon tier expiry.

Throw `customError(message, statusCode, kind?)` from controllers/services and pass failures to the global handler. `errorMiddleware.ts` normalizes Mongoose and JWT errors. Keep unmatched API handling before the SPA catch-all.

### Logs and XP

`models/log.model.ts` is the central immersion model. Valid log types are `light-novel|reading|anime|vn|video|manga|audio|movie|tv show|other|game`.

- `light-novel` can match AniList media.
- `reading` is a free-form, non-matchable reading bucket.
- Both count toward the reading immersion category.
- Required `episodes`, `pages`, `time`, and `chars` fields depend on the log type through schema functions. Check the model before changing validation.
- Production indexes are managed explicitly with `npm run migrate:indexes:prod`; schema indexes are automatically applied only in development.

### Achievements

`services/achievements/achievementEngine.ts` dispatches by `condition.type`; implementations live in `services/achievements/conditions/*.condition.ts`. When adding a condition type, add its evaluator, its engine switch case, and a test under `Backend/src/__tests__/achievements/conditions/`.

### Profile customization

`services/customization.ts` owns unlock and downgrade rules. When adding a capability, update `CustomizationCapabilities`, `getCustomizationCapabilities`, `getDisplayCapabilities`, and `FULL_PAID_ACCESS` together.

The frontend mirrors customization enums in `Frontend/src/types.d.ts` and maps them in `Frontend/src/utils/customization.ts` plus `Frontend/src/customization.css`. Do not spread Mongoose customization subdocuments; copy fields explicitly because values are exposed through prototype getters. Respect `prefers-reduced-motion` for animated cosmetics.

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
- Socket.IO texthooker behavior is split between the Socket.IO section of `Backend/src/index.ts` and `Frontend/src/screens/HookerScreen.tsx`. Treat event names and payloads as a shared wire contract.
- Texthooker room state is stored in `TextSession` with a 24-hour TTL. Socket authentication parses the JWT cookie separately from Express middleware.
- Swagger UI is mounted at `/api/docs`.

## Frontend architecture

- `Frontend/src/main.tsx` defines a `createBrowserRouter` tree with route-level lazy imports.
- Protected routes use `contexts/protectedRoute.tsx`. Texthooker and normal app pages occupy separate protected route blocks.
- Nested layouts render children through `<Outlet>`.
- TanStack Query owns server state; API calls belong in `src/api/*.ts`.
- `axiosConfig.ts` enables credentials and sends 401 handling to the Zustand user store.
- `store/userData.ts` owns persisted user/auth state under the `userData` localStorage key. Theme values are intentionally preserved separately and premium themes fall back safely on logout.
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
- The navbar is absolute and 80 px high. Use `pt-20`/`HEADER_OFFSET` when a child container supplies normal vertical padding, and `pt-28`/`HEADER_OFFSET_CONTENT` when content begins directly below the offset.
- Use daisyUI semantic colors. Media colors live only in `constants/mediaColors.ts`; chart colors come from `useThemeColors()`.
- Use `lucide-react` icons sized by Tailwind classes, not the numeric `size` prop.
- Never interpolate Tailwind class fragments. Map variants to complete literal class strings so Tailwind v4 can detect them.

## Maintaining this guidance

This is the repository's source of truth for coding-agent guidance. If architectural behavior changes, update this file alongside the relevant code and documentation.
