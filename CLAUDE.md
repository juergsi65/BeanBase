# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

BeanBase: mobile-first dial-in & brew-log PWA for home baristas. UI text, code comments and docs are **German** — keep new user-facing strings and comments in German.

## Commands

```bash
npm run dev         # Vite dev server (http://localhost:5173); .claude/launch.json uses port 5180
npm run typecheck   # tsc for src/ AND worker/ (separate tsconfig in worker/)
npm run lint        # oxlint (config .oxlintrc.json); lint:fix for autofixes
npm run build       # typecheck + lint + vite build → dist/
npx wrangler deploy # deploy to Cloudflare Workers (wrangler.jsonc builds first)
```

No test runner. Checks: `npm run typecheck` + `npm run lint` (oxlint, not ESLint — typescript-eslint does not support TS 7).

## Architecture

**Stack:** React 19 + Vite 8 + TypeScript (strict), Tailwind CSS 4 + daisyUI 5 (themes `light`/`dark` defined in `src/styles.css`), TanStack Query, Supabase (Postgres + Auth + Storage + RPC). Hosted as Cloudflare Worker serving `dist/` as SPA assets.
**Styling:** Tailwind utilities first. CSS that utilities can't express and that belongs to one component goes in a co-located `X.module.css` (wrap rules in `@layer components`, reference daisyUI/global classes via `:global(.x)`). `src/styles.css` holds only themes/tokens, base, app shell and shared building blocks. `main.tsx` must import `styles.css` before `App`, otherwise module CSS declares `@layer components` first and `base` ends up overriding it. Inline `style` only for computed values.
**Two runtime modes** (`src/lib/supabase.ts`): if `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are unset, `supabase` is `null` and the app runs in **demo mode** with all data in `localStorage` (`beanbase:v1`), no login. Anything account-only (social, admin, media upload) must call `requireSupabase()`. `.env.production` holds the real (public) Supabase URL + publishable key.

**Data layer:**
- `src/lib/db.ts` — one `Db` interface with `local` (localStorage) and `remote` (Supabase) implementations for the owned tables `machines`, `grinders`, `beans`, `brews`, `bean_stock` (`TABLES`). The local impl emulates FK behavior (`on delete set null` for brew refs, cascade for `bean_stock`); keep it in sync with `schema.sql`.
- `src/lib/useData.ts` — loads all owned tables in one TanStack Query (`['data', userId]`) and exposes `add/update/remove` which write through `db` and patch the cache manually (same FK emulation repeated here).
- `src/lib/query.ts` — single shared `QueryClient`, also used outside React.
- Social/community/admin data (`social.ts`, `community.ts`, `admin.ts`, `barcode.ts`) talk to Supabase directly (tables + `security definer` RPCs like `get_community_recipes`, `lookup_bean_by_barcode`), not through `db.ts`.
- Row types live in `src/types.ts` (`TableMap`, `Data`).

**Navigation:** no router. `src/App.tsx` holds a `tab` state and a `go(tab, params)` helper; pages in `src/pages/` receive shared props. Initial tab can come from `?tab=` (PWA shortcuts); `?invite=CODE` and `?recovery=1` drive registration / password reset.

**Domain logic** is kept out of components: `lib/coffee.ts` (ratio, roast age, recipe selection), `lib/dialin.ts` (dial-in targets & grind corrections), `lib/cost.ts` (stock/cost per cup), `lib/barcode.ts` (cascade: own bean → community RPC → Open Food Facts → `/api/upc` → coffee filter).

**Presets:** `src/data/presets.ts` — curated machines/grinders. `preset_id` values are stored in the DB and used for community matching — **never change existing ids**.

**Database:** `supabase/schema.sql` is the single source of truth, idempotent (`if not exists`, migration section), re-run whole file in Supabase SQL editor to apply. RLS: read own + accepted friends + public profiles; write owner only. Community RPCs return only aggregates with k-anonymity (`min_users`) — preserve that when editing them. Storage buckets: `bean-images`, `brew-media`, `avatars` (path `<user_id>/…`).

**Worker** (`worker/index.ts`, own tsconfig with `@cloudflare/workers-types`): runs first only for `/api/*`:
- `GET /api/upc/<code>` — UPCitemdb proxy (no CORS there), cached 7 days.
- `POST /api/feedback-notify` — emails admin via Cloudflare Email Routing (`FEEDBACK_EMAIL` binding, recipient secret `FEEDBACK_TO`).

**Edge Function:** `supabase/functions/analyze-bean-label` (Gemini vision). Feature is gated off by `AI_LABEL_ENABLED` in `src/lib/images.ts` (shown as "TBA" in UI).

**Beta/admin:** invite-code-only signup, admin/tester roles, feedback, moderation — see `docs/BETA-TEST.md`.
