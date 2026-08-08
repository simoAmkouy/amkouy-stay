# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm start` — start the Expo dev server (Metro). `npm run android` / `npm run ios` / `npm run web` start it targeting a specific platform.
- `npm run lint` — `expo lint` (flat ESLint config in `eslint.config.js`, based on `eslint-config-expo`).
- `npm run build` — `expo export --platform web`, static web build to `dist/` (see Web deploy below).
- No test suite is configured in this repo (no Jest config, no `test` script).
- Requires `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` (copy from `.env.example`) — `src/lib/supabase.ts` throws immediately at import time if either is missing.

## Architecture

**Amkouy Stay** is a role-based back-office app for managing a short-term-rental property portfolio (properties, reservations, owners, cleaning, maintenance, contracts, finance, commercial leads/leads pipeline, concierge, reporting), built on Expo Router + Supabase.

- **Routing root is `src/app`, not `app/`.** Expo Router auto-detects `src/app` when a `src/` directory exists — there is no top-level `app/` directory in this project. The `@/*` path alias (`tsconfig.json`) maps to `./src/*`.
- **Root layout (`src/app/_layout.tsx`)** wires every app-wide provider once: `QueryClientProvider` (React Query), `AuthProvider`, `LocaleProvider`, `ThemeProvider`, then an `AuthGate` that redirects based on session + pathname (unauthenticated → `/login`; authenticated on `/login` → the role's home route from `HOME_ROUTE_BY_ROLE`).
- **Auth** is real Supabase Auth, not mocked: `src/lib/supabase.ts` creates the client (custom `supabaseStorage` wrapper that guards `window` access so it's safe during Expo Router's static web render); `src/hooks/use-auth.tsx` owns session/profile state and sign-in/out/reset/update-password.
- **Authorization is two independent, layered systems — don't conflate them:**
  - `src/constants/permissions.ts` — `ROLE_PERMISSIONS` is the actual permission matrix (`user_role` → allowed `Resource[]`); `canAccess(role, resource)` is what `AccessGuard` (`src/components/amkouy/access-guard.tsx`) checks before rendering a screen. This is a UX gate only — the real, unbypassable boundary is Postgres RLS (documented per-table in `DATABASE_SCHEMA_V2.md`).
  - `src/constants/role-navigation.ts` — which tabs/More-menu items each role *sees*. Purely cosmetic curation on top of `canAccess`; it only ever narrows visibility, never grants access a role doesn't already hold.
- **Data access lives in `src/lib/queries/*.ts`**, one file per domain entity (`properties.ts`, `reservations.ts`, `owners.ts`, etc.), calling `supabase.from(...)` directly against types generated in `src/types/supabase.ts` (`Database`) — there is no repository/ORM abstraction layer. Conventions used throughout:
  - Soft delete only: every table has `deleted_at`/`deleted_by`; queries always filter `.is('deleted_at', null)` and updates rather than issuing real `DELETE`s.
  - Every mutation calls `logActivity()` (`src/lib/queries/activity-log.ts`) to write an `activity_logs` row for the audit trail.
- **Forms pair a Zod schema in `src/lib/validation/*.ts` with a component in `src/components/forms/*.tsx`** (one schema file per entity/form, matching the queries split). Validation messages are French — the app's primary operator-facing language.
- **i18n (`src/i18n/`)**: `fr.ts` is the source of truth for dictionary shape; `ar.ts` (RTL) must structurally match it. `TranslationKey` in `src/i18n/index.ts` is derived from `fr.ts`'s shape via a mapped type, so a typo'd translation key is a compile error, not a runtime miss.
- **Financial/KPI formulas: check `KPI_REGISTRY.md` before adding or re-deriving one.** It's the single source of truth for revenue/profit/occupancy/owner-payment calculations (e.g. the stay-overlap, prorated-to-window revenue attribution standard) — screens must call the same query/RPC rather than re-implement a formula.
- **Database schema**: `DATABASE_SCHEMA_V2.md` is current (superseding `DATABASE_SCHEMA.md`); each section is labeled `[LIVE]` (generated from `src/types/supabase.ts`/live catalog queries) or `[RECONSTRUCTED]` (inferred, lower confidence) — check the label before trusting a schema detail. Conventions: UUID PKs (except the insert-only `activity_logs`, a `BIGINT IDENTITY`), money as `NUMERIC(14,2)`, timestamps as `TIMESTAMPTZ` UTC, native Postgres enums.
- **`EXECUTIVE_COMMAND_CENTER_SPEC.md`** is a design-only spec (not implemented) for a rollup dashboard; it deliberately reuses `KPI_REGISTRY.md` formulas rather than introducing new ones.
- **Web deploy**: `app.json` sets `web.output: "static"` (static export, no server routes/API routes). `vercel.json` rewrites all paths to `/index.html` for client-side routing. `npm run build` (`expo export --platform web`) outputs to `dist/`.
- **Platform-specific files**: a few components have `.web.tsx`/`.web.ts` overrides (e.g. `app-tabs.web.tsx`, `use-color-scheme.web.ts`) for native-vs-web divergence; Metro/Expo resolves these automatically by platform.
