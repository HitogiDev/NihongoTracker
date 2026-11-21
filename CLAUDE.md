# AGENTS.md

This file gives Codex and other coding agents repository-specific guidance. It applies to the entire repository.

## Project overview

NihongoTracker is a gamified Japanese immersion tracker with XP, levels, streaks, leaderboards, achievements, clubs, media tracking, and realtime texthooker sessions.

The repository is a monorepo with three independently versioned npm packages and no root `package.json`:

- `Backend/`: Express, TypeScript, MongoDB/Mongoose, Socket.IO, and Vitest. Source is in `Backend/src`; TypeScript compiles to `Backend/build`.
- `Frontend/`: React 19, TypeScript, Vite, TanStack Query, Zustand, Tailwind CSS v4, and daisyUI v5. Production output is `Frontend/dist`.
- `Mobile/`: the Capacitor Android container. It packages the `Frontend/` build and holds the native `android/` project.

In production, the frontend build is copied to `Backend/dist`; Express serves the API, static frontend files, and the SPA fallback from one process.

## Working rules

- Run npm commands from `Backend/`, `Frontend/`, or `Mobile/`, never from the repository root.
- Use npm 11. The lock files come from npm 11, and npm 10 rejects them during `npm ci` (for example, "Missing: esbuild@... from lock file").
- Work directly on `main`. Do not create or switch to other branches.
- Commit only when asked. Do not add a Co-Authored-By trailer. Do not push.
- Author and commit every commit as `HitogiDev <31047609+HitogiDev@users.noreply.github.com>`. Check `git config user.name` and `user.email` before you commit, and set them in the repository when they differ. Do not add `Claude-Session` or other agent trailers to commits, and do not add "Generated with" lines to pull requests.
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

Capacitor Android builds share the frontend in `Frontend/`. The native container is the `Mobile/` package. Its `scripts/build.mjs` builds `Frontend/` and requires matching Capacitor versions in both packages.
Mobile login and refresh use `/api/auth/mobile/*`. Access JWTs require an active `MobileSession` through Bearer authentication. Refresh tokens rotate atomically and are stored as hashes. Password changes revoke mobile sessions.
Native credentials use secure storage. Page and image caches plus the outbox use account-scoped IndexedDB. Logs use a stable `Idempotency-Key` from their first attempt. Keep the log unique index aligned with the migration script.
The outbox, API cache, and image cache each use their own IndexedDB store from `offline/idbStores.ts`. `offlineStore.ts` skips search and utility responses and prunes old responses. Images are cached only from responses shown offline. A change that the server rejects blocks only later changes to the same target. Logs have no target.
Push notifications use FCM. `createNotification` sends them through `services/pushNotifications.service.ts` when `FIREBASE_SERVICE_ACCOUNT_JSON` is set. `insertNotificationBatches` also sends them for broadcasts. `services/pushText.ts` translates each message into the recipient's `settings.language` from the frontend `notifications` and `achievements` catalogs, so keep `Frontend/` next to `Backend/` in deployments. The token is stored on the `MobileSession`, so logout and session revocation stop delivery. The app registers only when the build sets `VITE_PUSH_ENABLED`. `useNativePush` does not ask for permission at sign-in. `NativePushPrompt` on Home explains the benefit first, and the system dialog opens only when the user taps it.
Android App Links use `/.well-known/assetlinks.json` from `routes/appLinks.routes.ts`. Keep the manifest path prefixes aligned with the routes that `NativeNavigation` opens.
The Android back button first closes the keyboard, then overlays that use `useNativeDismiss`, then open daisyUI dropdowns (`<details>` or focus based), then open dialogs, then navigates. Use `useNativeDismiss` for new portaled menus and popovers. `ModalBackdrop` registers it for `div.modal-open` modals.
Android home screen widgets (streak and level, today's goals) live in `Mobile/android/.../widgets/`. They do not call the API. `native/NativeWidgetSync.tsx` sends a JSON summary through the local `NihongoWidgets` plugin, with labels in the user's language. Keep its fields aligned with `WidgetSnapshot.java`. The widgets reset daily and weekly progress natively when the user's day or week changes, using `dayStartHour` and `weekStartsOn`. Logout clears the summary. Widget buttons open routes with `ACTION_VIEW` links that `NativeNavigation` reads.
The immersion session timer lives in `Mobile/android/.../timer/` (local plugin `NihongoSessionTimer`). Its SharedPreferences state is the source of truth. Time comes from the wall clock, so it survives when the system stops the app. The ongoing notification uses the system chronometer, so no foreground service runs. Pause and Resume go through `SessionTimerReceiver`. Log opens `/session?log=1`, which pauses the timer and opens `QuickLog` with the media and time. Keep the JSON fields and labels aligned between `native/sessionTimer.ts` and `SessionTimerState.java`. `store/sessionTimer.ts` mirrors the state, `NativeSessionTimerSync` refreshes it, and `NativeSessionBar` shows it on other screens. Sessions start from Home, the media header, and `QuickLog` through `useStartSession`. Logout stops the session. A session of another account is stopped on sync. Outside the native app, `?mobilePreview=1` keeps the timer in localStorage without a notification.

`middlewares/authMiddleware.ts` supports an `x-api-key` first, then a JWT in an httpOnly cookie. `protect` requires identity; `optionalProtect` attaches `res.locals.user` when available. Authentication also rejects banned users and checks Patreon tier expiry.

Throw `customError(message, statusCode, kind?)` from controllers/services and pass failures to the global handler. `errorMiddleware.ts` normalizes Mongoose and JWT errors. Keep unmatched API handling before the SPA catch-all.

Password reset tokens are random 256-bit values. Store only their SHA-256 hashes and consume them atomically with the password update. Use `libs/password.ts` for password hashing. Configure `TRUST_PROXY` with actual proxy IPs or CIDRs before relying on client IP limits behind a proxy.

File replacements use `FileUploadBatch`. Commit cleanup after the database stores the new URLs. Roll back new uploads when persistence fails.

### Logs and XP

Daily, weekly, and custom period goals can optionally filter progress by a log's media type. A missing or null media type counts all logs. Keep the goal media type options aligned with the log schema, and calculate recurring progress per goal so goals with the same metric can track different media.
Username-based goal reads use optional authentication and `services/goalVisibility.ts` to enforce profile and statistics privacy. Forecasts remain private authenticated records.
Custom period goal dates include both their start and target days in the owner's timezone. Presets use Sunday through Saturday for This Week, calendar boundaries for This Month, and count today as the first of Next X days. Keep creation, editing, validation, and progress aligned on these date rules.
Weekly cadence goals and the long-term "this week" progress start on the owner's `settings.weekStartsOn` (0 for Sunday, 1 for Monday, default 1). Both calculations are in `dailyGoals.controller.ts` and `longTermGoals.controller.ts`. Keep them aligned with this setting.
`settings.dayStartHour` (0 to 12, default 0) sets the local hour when a user's day starts. Activity before that hour counts toward the previous day. Streaks (`services/streaks.ts`), daily and weekly goal windows (`dailyGoals.controller.ts`), long-term goal progress, statistics periods and `localDate` days in `logs.controller.ts`, and Wrapped apply it. Use `shiftByDayStart` before you read the local day, but keep the real time for hour-of-day charts. Pass it to every `getUserDayKey` and `getLiveCurrentStreak` call for streaks. In the frontend, `useTimezone()` returns `dayStartHour`, and the heatmap and charts shift log dates with `shiftByDayStart` from `utils/timezone.ts`. `GET /users/:username/stats` accepts the viewer's `dayStartHour` with the viewer's `timezone`. A change to the timezone or the day start hour recalculates the stored streak.

`models/log.model.ts` is the central immersion model. Valid log types are `light-novel|reading|anime|vn|video|manga|audio|movie|tv show|other|game`.

- `light-novel` can match AniList media.
- `reading` is a free-form, non-matchable reading bucket.
- Both count toward the reading immersion category.
- Required `episodes`, `pages`, `time`, and `chars` fields depend on the log type through schema functions. Check the model before changing validation.
- Production indexes are managed explicitly with `npm run migrate:indexes:prod`; schema indexes are automatically applied only in development.

XP formula v3 uses 135 base XP per credited hour. Difficulty is normalized from Jiten's 0-5 scale. Effective comfort is the category-level estimate corrected by at most ±0.25 Jiten using the hours-weighted median from the last 90 days after 10 tagged hours. The challenge bonus grows from 0% at comfort to 30% at comfort +0.5 Jiten, capped at Jiten 5. Treat this as relative challenge, not measured comprehension. Keep log creation, imports, AniList sync, preview, migration, and calculator on `services/xp.ts`.

Club goals and opt-in challenges share the unified objective model in `models/clubChallenge.model.ts` and `services/clubObjectives.service.ts`. Use `mode: collective` for club-wide progress and `mode: individual` for participant-based progress. Legacy embedded `clubGoals` are mirrored lazily by `syncLegacyClubObjectives` so existing clubs remain compatible.

Club member leaderboards support `scope: all-media` (default) and `scope: club-media` through `GET /api/clubs/:clubId/rankings`. Club media uses exact `mediaId` and log type pairs from all `currentMedia` entries, including past vote winners and admin additions. Aggregate visible logs through `services/clubLogMetrics.service.ts` for XP, time, and characters. Do not require completion or restrict logs to each selection's consumption period. Time includes anime logs without explicit time at 24 minutes per episode, matching the shared club metric rule.

Club feeds also show global `media_review` activities by active members. A review appears when its media ID and type match a `currentMedia` entry and it was written between that entry's start date and the end of its end date (UTC). `buildClubMediaReviewFilter` in `services/activity.service.ts` applies this rule when the feed is read, so period edits and membership changes apply to existing reviews. Club feeds also show the global `immersion_log` and `notable_immersion_session` activities of active members through `buildClubMemberLogFilter`. The usual activity visibility rules still apply.

### Posts

User posts live in `models/post.model.ts` and `services/posts.service.ts`. Each post has a mirrored `post` activity (`targetType: post`) that carries its content and images in `metadata`, so the feed, comments, likes, and visibility reuse the activity system. Keep the activity metadata aligned when a post changes. The `posts` feature flag controls `/api/posts`, and admins can always use it.

- A post has up to 4 images. Markdown images in the text are removed when rendered (`renderMarkdownWithSpoilers(..., { allowImages: false })`), so all images go through the image list.
- External image links are free. They must use a host in `POST_IMAGE_HOSTS` (`services/remoteImage.ts`), mirrored in `Frontend/src/utils/postAccess.ts`. Viewers load them through the public `GET /api/posts/image` proxy, which re-encodes them as WebP. Viewers never contact the external host.
- Hosted uploads require active Enthusiast, Consumer, or admin access (`services/postImageAccess.ts`). They are re-encoded as WebP (animation kept), stored in Firebase through `FileUploadBatch`, and limited to `HOSTED_POST_IMAGE_QUOTA` images every 30 days. Hosted images that a post already has stay after a downgrade.
- Deleting a post, an account, or its social data removes the hosted files.
- Post decorations (`decoration` on `Post` and in the activity metadata) add a border (solid, dashed, dotted, double, gradient, or glow) and a background (color, CSS pattern, or image) with an opacity from 0 to 100. They require the same tiers as hosted images (`hasPostDecorations`). A downgraded user can keep an unchanged decoration (`assertDecorationAllowed` compares signatures). A background image is an allowlisted link or a hosted upload (`backgroundImage` field) that counts toward the upload quota. `services/postDecoration.ts` parses input, and `Frontend/src/utils/postDecoration.ts` maps decorations to styles. Keep defaults, patterns, and border styles aligned in both.

### Duels

`models/duel.model.ts` stores one user's challenge to another: a metric (`time|chars|pages|episodes`), a target, an optional media type, and a duration in days. A duel starts as `pending` and expires 72 hours after creation. Accepting sets `startDate` to that moment and `endDate` to the duration later, so only logs inside that window count. The first participant to reach the target wins. At the deadline the higher progress wins and equal progress is a draw.
`services/duels.service.ts` owns the rules. Progress comes from `aggregateVisibleLogMetricByUser` with the participant as viewer, so a private log still counts for its owner. `evaluateDuelsForUser` is best-effort and runs after log creation, edit, import, and AniList sync. It finishes duels atomically with `findOneAndUpdate` on `status: 'active'` so one result is notified once. A finished result stays final when logs are deleted later. When both participants already reached the target, the earlier crossing log decides the winner. `services/duelScheduler.ts` finishes overdue duels and expires pending ones every 15 minutes.
Duel results create `duel_*` notifications and a `duel_won` activity, and they trigger the `duelComplete` achievement check for the `duelsWon` condition. `GET /api/duels/h2h/:username` returns the viewer's record against a user. `GET /api/duels/stats/:username` follows the statistics privacy rule through `requireGoalVisibility`. The frontend shows the record chip and challenge button in `ProfileHeader`, the `/duels` screen, and a Duels tab in `StatsScreen`. Keep the `duels` index entry in `scripts/migrate-indexes.js` aligned with the model.

### Achievements

`services/achievements/achievementEngine.ts` dispatches by `condition.type`; implementations live in `services/achievements/conditions/*.condition.ts`. When adding a condition type, add its evaluator, its engine switch case, and a test under `Backend/src/__tests__/achievements/conditions/`.

### Profile customization

`services/customization.ts` owns unlock and downgrade rules. When adding a capability, update `CustomizationCapabilities`, `getCustomizationCapabilities`, `getDisplayCapabilities`, and `FULL_PAID_ACCESS` together.

The frontend mirrors customization enums in `Frontend/src/types.d.ts` and maps them in `Frontend/src/utils/customization.ts` plus `Frontend/src/customization.css`. Do not spread Mongoose customization subdocuments; copy fields explicitly because values are exposed through prototype getters. Respect `prefers-reduced-motion` for animated cosmetics.

Use `UserAvatar` for portraits in headers and settings previews. Legacy frames center a child of fixed size with symmetric padding. Rainbow animates only its background pseudo-element.

Decorative avatar frames (`hearts`, `starlight`, `sigil`, and `fireflies`) use SVG assets in `Frontend/src/assets/avatar-frames/`. Render frames through `components/AvatarFrame.tsx`, including profile and settings previews. `utils/canvasHeartFrame.ts` reads Hearts geometry and pulse timing from its SVG, then draws vectors on a supersampled canvas to prevent shimmer at small sizes and reduced zoom. Reuse the shared resolution observers and animation lifecycle for Hearts. `utils/avatarFrameLayers.ts` prepares static SVG images with baked glow for Starlight, Sigil, and Fireflies, and mirrors their animations onto HTML layers with Web Animations. These layers animate only transform and opacity so the browser can composite them with hardware acceleration. Pause layers outside the viewport and while the document is hidden. Keep the original SVG background for fallback and reduced motion. Reference fallback assets from `customization.css` with relative URLs and `?no-inline` so Vite tracks updates and emits content-hashed files. Do not place them at fixed public URLs because Express caches SVGs as immutable for one year. Each SVG remains the source of its layer animations and reduced-motion rule. Keep the 240-unit SVG viewport proportional to the 160-unit avatar, with the overlay extending 25% on each side. Do not rotate or resize the entire overlay to animate its individual ornaments.

Frames adapted from `E:/Coding/pacote-bordas` use CSS for `rainbow`, `segmented`, `gradient`, `sweep`, and `crystal`. Crystal uses a bright solid ring and a broad moving white highlight over the portrait. `text` uses a circular SVG text path. `electric` and `petals` use `utils/proceduralAvatarFrames.ts`, with canvas sizes proportional to the portrait. Pause canvas animation outside the viewport, in hidden documents, and for reduced motion. Save custom palettes for Gradient, Segmented, and Sweep in `frameColor1`, `frameColor2`, and `frameColor3`; Rainbow keeps its fixed spectrum. Save circular text in `frameText` and its SVG fill color in `frameColor1`. Consumer frames include Aura, Starlight, Crimson Sigil, Fireflies, Electroshock, Crystal, and Petals. Rainbow, Segmented, Gradient, Sweep, Text, Neon, Sakura, and Hearts require Enthusiast or Consumer access. Retired frame values fall back to `none`; the schema accepts them so unrelated profile saves remain valid.

The animated username effect `aura` uses the selected name colors and a continuously cycling color band. Keep the linear color cycle separate from the glow pulse. Glow uses `nameColor1` for the letters and `nameColor2` for the halo. It requires Enthusiast or Consumer access. `namePulseIntensity` accepts integers from 0 to 100, and `namePulseSpeed` accepts durations from 0.5 to 6 seconds. Keep its settings controls, validation, defaults, and reduced-motion behavior aligned across the backend and frontend.

The `constellations` frame reads SVG paths and star positions into vector canvas drawing in `utils/canvasAvatarFrames.ts`. It renders ambient stars around the avatar and Orion, Capricornus, and Lyra over it. SVG `data-stars` routes define each figure's connections through star IDs. Keep those connections explicit. Ambient stars orbit slowly and fade independently at different speeds and phases. Named figures form one at a time in this order: Orion, Capricornus, Lyra. Reveal stars along their routes at 0.28-second intervals, with a 0.18-second fade. Fade each connection in over 0.75 seconds, starting when its second endpoint appears. Draw connections only when both endpoint stars are visible. Hold the complete figure for 1.3 seconds after the final line finishes its fade, fade it over 0.65 seconds, then wait 0.25 seconds before the next figure. Keep radial drift small for named figures to preserve their shapes. Keep star cores sharp and draw glow separately. `frameColor1` sets the star, connection, and glow color. Pulse the glow separately from the star and connection reveal. Preserve the selected color in the static SVG fallback for reduced motion and canvas failures. Do not rasterize stars into fixed-resolution sprites. `utils/avatarCanvas.ts` sizes canvas buffers from displayed bounds, device pixel ratio, and visual viewport scale. `AvatarFrame` observes resolution, window, and visual viewport changes so zoom redraws Constelaciones and the other active canvas frames. Canvas effects pause outside the viewport or while the document is hidden. Reduced motion and canvas failures use the static SVG fallback. Removed frame values fall back to `none` when reading or updating customization. The schema accepts retired stored values so unrelated profile saves remain valid.

Banner effects use `BannerEffectOverlay` and vector canvas drawing in `utils/bannerEffects.ts`. Stars read the Constellations SVG shape; fireflies match the green avatar light and petals match its Sakura silhouette. Snow combines distant dots and six-arm flakes. Each particle has independent motion, size, and phase. SVG particles remain visible for reduced motion or canvas failure. Use the shared canvas resolution observers for zoom, and pause animation outside the viewport or in hidden documents.

### Immersion forecasts

`ImmersionForecast` stores private, media-linked finish plans. Target totals are snapshotted at creation; progress and daily pacing are derived from matching logs by `services/immersionForecast.service.ts`. Creation and deadline edits require active Enthusiast/Consumer access, while owners retain read/delete access after downgrade. Keep these records out of username-based public goal responses.

### Insights

`/api/insights` gives private advanced statistics to the authenticated owner. Access requires active Enthusiast or Consumer access, or the admin role, through `services/premiumAccess.ts`. `services/insights.service.ts` builds 12 local months of reading speed, by type and by Jiten band, from reading logs with both chars and time. Speeds outside 800 to 60000 chars per hour are ignored. The speed comparison uses the last 30 days and a 30-day window centered 3, 6, or 12 months ago. The comfort timeline rebuilds the category level at each month end, then applies `effectiveComfort` from `services/xp.ts`. Keep it aligned with the XP formula. `GET /api/insights/compare` summarizes two inclusive local periods of at most 731 days.
Weekly and monthly digests are opt-in through `settings.insightsDigest` and `PUT /api/insights/digest`. `services/insightsDigestScheduler.ts` runs every hour. A digest is due after 09:00 local time on the first day of the next period, with `weekStartsOn` and `dayStartHour` applied. The scheduler claims each period key atomically before it sends an `insights_digest` notification, so each period sends once. The frontend shows the Insights tab in `StatsScreen` only to the owner, and `?tab=insights` opens it.

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
- VN screenshots come from the `vn_screenshots` and `images` tables of the VNDB database dump. Only URLs to the VNDB CDN (`t.vndb.org/sf` and `/st`) are stored, at most `MAX_VN_SCREENSHOTS` per VN, so the server never downloads the image dump. A screenshot is adult when its sexual average is 100 or more, its violence average is 150 or more, or it has no rating. The banner (`coverImage`) is the first safe screenshot, preferably landscape. `components/VnScreenshotGallery.tsx` blurs adult screenshots unless the user turns off `blurAdultContent`.
- IGDB search and dump imports share `services/igdbFilterPolicy.ts`. Accept Japanese main games, standalone expansions, remakes, remasters, expanded games, and ports. Prefer `game_type` over legacy `category`, including type `0`. Keep dump cleanup aligned so it preserves these titles. A game counts as Japanese when it has Japanese language support, a Japanese title, or a Japan release (`release_region` 5 in the `release_dates` dump). Some games have only the Japan release signal. Keep the live search and the dump sync aligned on these rules. The games dump lists alternative names as IDs. The sync resolves them to text from the `alternative_names` dump and stores them in `synonyms`.
- Socket.IO texthooker authentication is in `Backend/src/index.ts`. Room handlers are in `services/textSessionSocket.ts` and the client is in `Frontend/src/screens/HookerScreen.tsx`. Treat event names and payloads as a shared wire contract. Require authenticated hosts and check room membership plus its host token for each mutation. Keep shared rooms until their 24-hour expiry.
- The NTExtended browser extension (separate repository) connects through `/extension/connect` (`screens/ExtensionConnectScreen.tsx`). The screen creates an API key with `POST /api/api-keys` and posts it to the extension bridge with `window.postMessage`. Keep the `ntextended:*` message types aligned with the extension `connect.ts`. The extension calls the API with `x-api-key` and sends `Idempotency-Key: ntx:<draftId>` on log creation.
- Desktop LunaHook input reaches the browser through `NativeHookBridge` and a loopback WebSocket URL in the `ntdc` fragment. Validate it with `nativeBridgeUrl`, match every line to the reader's content ID, and preserve line IDs for server deduplication. This mode disables the external hooker WebSocket. Hook selection is saved by the desktop bridge. Keep the bridge token out of API requests and persisted settings.
- The browser bridge accepts `set-source` with `lunahook` or `websocket` and an optional `requestId`. The `source-changed` reply returns the request ID and confirmed hook status. Native status includes `websocket_selected` and can complete a pending source change. A compact daisyUI join selects one input for the session. Hook options appear only for LunaHook. WebSocket mode keeps the saved native hook and suppresses native lines until LunaHook is selected again. Failed or timed out requests release the controls.
- External hooker WebSockets use `hooks/useTexthookerSocket.ts`. An optional secondary URL (`texthooker_secondaryWebsocketUrl`) feeds the same line handler as the primary URL. LunaHook input disables both. Pause on disconnect applies only when no configured socket is connected.
- Texthooker room state is stored in `TextSession` with a 24-hour TTL. Socket authentication parses the JWT cookie separately from Express middleware.
- Swagger UI is mounted at `/api/docs`.
- `GET /api/users/:username/current-media` feeds the profile `currentMedia` widget through `services/currentMedia.service.ts`. It returns up to three unfinished works logged in the last 30 days, excluding video, private logs, and inactive statuses. Progress uses episodes, characters (Jiten when the media has no count), or movie runtime. Skip full progress with the MediaDetails auto-complete rule. The immersion activity privacy setting applies.
- Site-wide feature flags live in `models/featureFlag.model.ts` and `services/featureFlags.service.ts`. A flag without a stored document is off. `GET /api/features` is public, and admins change flags with `PATCH /api/features/:key` from the System tab of the admin panel. The frontend reads them with `hooks/useFeatureFlags.ts`. Add a flag to `FEATURE_FLAGS`, the service defaults, `IFeatureFlags`, and `FeatureFlagsCard` together.
- `GET /api/users/:username/wrapped?year=YYYY` returns the Nihongo Wrapped year summary from `services/wrapped.service.ts`. The `wrapped` feature flag controls the endpoint and the profile tab, and admins can always preview them. Years and days use the owner's timezone. The statistics privacy setting applies, and only the owner sees private logs. The XP percentile uses a cached distribution of public logs for 6 hours. Level history subtracts log XP after each boundary from the current `stats.userXp`. Ranking highlights come from weekly `RankSnapshot` records, with the last snapshot of each UTC month as its final monthly position. `screens/WrappedScreen.tsx` renders it on the `/user/:username/wrapped` tab with container queries, so the PNG export lays out at 1200 px on any viewport. The export uses `html-to-image` and loads images through the authenticated card image proxy, so only logged-in users can export.
- `GET /api/media-recommendations/level?category=reading|listening` returns titles for the user's level from `services/levelRecommendations.service.ts`. It is free for all users. The window goes from 0.25 Jiten below to 0.5 Jiten above the effective comfort from `services/xp.ts`. It excludes media the user already logged and adult media when `hideAdultFromSearch` is set. Ranking combines distinct public readers in the last year (cached for 6 hours) with distance from comfort +0.25 Jiten. `components/LevelRecommendations.tsx` shows it on the Dashboard and in the `level` tab of `/recommendations`. Active Enthusiast, Consumer, and admin users also get `types`, `genres`, and `shift` (-1 to 1 Jiten) filters, `availableGenres` in the response, and hidden titles through `POST /api/media-recommendations/level/dismissals` and `DELETE .../dismissals/:mediaType/:mediaId`. `services/levelRecommendationAccess.ts` decides access, and other users get `levelRecommendations.tierRequired` (403) for those parameters. Hidden titles stay excluded after a downgrade. Keep the unique index of `LevelRecommendationDismissal` aligned with `scripts/migrate-indexes.js`.
- `GET /api/users/:username/reviews` returns public reviews written by a user, with `page` and `limit` pagination. `GET /api/users/:username/lists` reuses the media list controller and returns private lists only to their authenticated owner.

## Frontend architecture

- `Frontend/src/main.tsx` defines a `createBrowserRouter` tree with route-level lazy imports.
- Protected routes use `contexts/protectedRoute.tsx`. Texthooker and normal app pages occupy separate protected route blocks.
- Nested layouts render children through `<Outlet>`.
- TanStack Query owns server state; API calls belong in `src/api/*.ts`.
- Media matching shares selection in `hooks/useMatchingSelection.ts`, mutations in `hooks/useMediaAssignment.ts`, and automatic matching in `hooks/useAutoMatch.ts`. `utils/mediaMatching.ts` owns exact title matching and batches of 50 assignments. Compare selected logs by ID.
- `axiosConfig.ts` enables credentials and sends 401 handling to the Zustand user store.
- `store/userData.ts` owns persisted user/auth state under the `userData` localStorage key. Clear the query cache on logout, expiry, and account changes. Merge partial user updates only within the same account. Theme values are intentionally preserved separately and premium themes fall back safely on logout.
- Active Enthusiast/Consumer patrons and admins can save and use up to 10 named palettes in `settings.customThemes` through `PUT /api/users/me/custom-themes`. Only active Consumer patrons and admins can select `settings.profileThemeId` to expose one palette on public profile responses. `ProfileHeader` temporarily applies it to the document so the header, profile, and footer share it, then restores the visitor's theme on exit. The local `theme` selection is `custom` with a separate `customThemeId`; `utils/appTheme.ts` applies the selected colors and clears overrides when switching themes or logging out. The legacy `settings.customTheme` palette is read as a named theme until the next save.
- User markdown supports mentions: `@username` cites a user and `[[type:contentId|title]]` cites a work. `utils/markdown.ts` renders them as placeholders with a plain fallback link. Render user markdown through `components/ui/MarkdownContent.tsx`, which replaces placeholders with live chips, or cards when a mention is alone on its line (between paragraph boundaries or `<br>` line breaks). Insert mentions with `MentionButton` from `components/mentions/MentionPicker.tsx`. With a textarea, it also mounts `MentionAutocomplete`, which suggests users and works at the caret after `@`. Editors without the button mount `MentionAutocomplete` directly. Activity comments and reviews send `mention` notifications through `services/mentions.service.ts`. Edits notify only new mentions. Keep `services/mentionParser.ts` aligned with the frontend user mention rule.
- `App.tsx` maps paths to document titles and implements scroll restoration. Add titles there for new top-level routes. A new navigation starts at the top. Back and Forward restore the position saved for that history entry.
- `utils/toastDefaults.ts` gives error and warning toasts a longer duration and shows one toast for each error text. Build error text with `getApiErrorMessage`, which translates network and server failures. Show a failed query in the page with `components/ui/QueryError.tsx` and its retry action.
- Keep submit buttons enabled when a form is incomplete. Disable them only while a request is pending, and show the field errors on submit.
- Files that use GSAP import `utils/gsapReducedMotion.ts`. With `prefers-reduced-motion`, it moves GSAP animations to their end state at once. Pass `disableForReducedMotion: true` to each `confetti` call.
- Capacitor uses `native/NativeShell.tsx` instead of the web navbar and footer. Keep native presentation behind `isMobileApp()` and native plugins behind `isNativeApp()`.
- Native navigation metadata lives in `native/navigation.ts`. The five main tabs are home, records, ranking, clubs, and the owner's profile.
- Native back actions consume history entries. When no prior app entry exists, replace the current route with its parent. Do not push a parent from a back action.
- The native header shows search and notifications on every primary tab, plus settings on the profile tab. Secondary screens show search too, except forms (auth, log, settings, session). Screens with a name call `useNativeTitle` from `native/nativeTitle.ts` (media, clubs). Foreign profiles show the username. Without history, Back from a foreign profile goes to Home. Support is under Settings and the subscription category. The Settings index groups Duels, Recommendations, Lists, Calculator, and Texthooker under Tools. `NativeFab` shows the create-log button only on Records, which has no create button at the top. Home shows its own. Native CSS hides daisyUI tooltips, because touch screens have no hover. `NativeTooltipPress` shows the `data-tip`, `.tooltip-content`, or `title` hint in a toast when the user holds the element, except inside `.native-selectable-log`.
- `PullToRefresh` in `NativeShell` refetches the active queries when the user pulls a page down from its top. It skips forms, open dialogs, and horizontal scrollers. Lists load more pages with `InfiniteScrollSentinel`, not a button.
- `native/haptics.ts` vibrates through `@capacitor/haptics`. `installTouchHaptics` gives every button a light tap, and an element can opt out with `data-no-haptic`. Keep the `@capacitor/haptics` version equal in `Frontend/` and `Mobile/`.
- The native app persists successful queries per account in IndexedDB (`offline/queryPersistence.ts`) for 24 hours, so screens appear at once and refresh in the background. Searches are excluded, and a query can opt out with `meta: { persist: false }`. Logout and account changes clear it.
- The native app sends no `Referer` (`<meta name="referrer">` in `main.tsx`). Google image hosts such as `yt3.ggpht.com` answer 429 to the WebView origin. Build the debug app for the local backend with `npm run sync:local`, because `npm run sync` targets production.
- Native profile CSS targets `native-profile-avatar`, `native-profile-info`, `native-profile-name-row`, and `native-profile-actions` in `ProfileHeader`, not child positions. Toasts follow the active theme through the `--toastify-*` variables on `.Toastify`.
- Native profile headers put the name on its own line, the title and supporter badges in one row, and the actions in a full-width row. Avatars with decorative frames get extra room so the frame stays on screen and list names stay aligned.
- Native toasts appear below the header. The Android launch screen uses `splash_background` (light and night variants) and the launcher foreground icon.
- Native registration starts `NativeOnboarding`. `onboardingStore` persists its step per account until completion or skip. The web onboarding stays in `GettingStartedModal`. Share plan names, prices, and the Patreon URL through `constants/supportPlans.ts`.
- Native safe areas are centralized in `native/native.css`. Do not add a second system inset to page wrappers. `NativeAppLifecycle` controls keyboard visibility and system bar contrast.
- Native forms use `useNativeUnsavedChanges`. Settings categories use `/settings?tab=...`. Preserve account-scoped filters and scroll restoration when adding native pages.
- Native log selection uses `SelectableLogRow`: hold a log to start selection, then tap logs to toggle them. Keep scrolling and log actions available outside selection.
- Share Stats renders PNGs locally through `utils/statsCard.ts` using the active theme. Supporter styles require an active tier or admin access. The card reads optional top media from `GET /api/users/:username/stats?topMedia=N` (maximum 5). Load remote images through `GET /api/media/utils/card-image`, which uses the `services/remoteImage.ts` host allowlist. Cross-origin images without CORS headers taint the canvas and block the PNG export. Native exports use `native/shareStatsImage.ts`, the Capacitor Share plugin, and files in `Directory.Cache`. Keep shared files available while the receiving app reads them.
- Development previews can use `?mobilePreview=1`. This enables presentation only, without native authentication, storage, or plugins.

## Frontend UI conventions

The project uses Tailwind CSS v4 and daisyUI v5. `npm run lint` runs ESLint and `scripts/lint-ui.mjs`; follow the repository rules instead of relying on visually plausible classes.

### Shared primitives

Prefer components from `Frontend/src/components/ui/`: `Button`, `buttonClass`, `BTN`, `Modal`, `Field`, `PageContainer`, `Spinner`, `PageLoader`, `Skeleton`, `QueryError`, `ModalBackdrop`, `ConfirmDialog`, and `RowButton`.

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
- The navbar is fixed and 80 px high. Use `pt-20`/`HEADER_OFFSET` when a child container supplies normal vertical padding, and `pt-28`/`HEADER_OFFSET_CONTENT` when content begins directly below the offset.
- `hooks/useAutoHideHeader.ts` hides the navbar while the page scrolls down and shows it after a short scroll up, near the top, or when it gets the focus. It sets `data-site-header` on the root element, and `--site-header-offset` is 5rem while the navbar shows and 0 while it hides. The native app sets the offset to its header height. Sticky bars use `top-(--site-header-offset)` (add spacing with `calc`) and `follow-site-header` so they move with the navbar.
- Use `UnsavedChangesGuard` for web forms with a draft and `useNativeUnsavedChanges` for the native app. Use `confirmDialog()` from `utils/confirmDialog.ts`, not `window.confirm`. `ConfirmDialogHost` in `RootLayout` shows it.
- Use `<Spinner>` for loading indicators, not a raw `loading loading-spinner` span. Text uses at least `text-xs` and `text-base-content/70`. Lower opacity falls below the WCAG AA ratio of 4.5:1 in the light theme.
- Do not add helper text under an option, setting, or section title when its label already says what it does. Add a hint only for a consequence, a limit, or a fact that the label does not give.
- Use daisyUI semantic colors. Media colors live only in `constants/mediaColors.ts`; chart colors come from `useThemeColors()`.
- Use `lucide-react` icons sized by Tailwind classes, not the numeric `size` prop.
- Date fields accept direct `YYYY-MM-DD` text entry and retain the `react-day-picker` calendar with the `rdp-themed` Create Log appearance. Reuse `components/ui/DatePickerInput.tsx` for all date inputs; do not add native `<input type="date">` controls or calendar-only replacements.
- Never interpolate Tailwind class fragments. Map variants to complete literal class strings so Tailwind v4 can detect them.

## Maintaining this guidance

This is the repository's source of truth for coding-agent guidance. If architectural behavior changes, update this file alongside the relevant code and documentation.
