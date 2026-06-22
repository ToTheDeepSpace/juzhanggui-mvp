# Schedule Media And Commission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add room/actor photos, external NPCs, LingQi master commissions, per-script car sequence numbers, and per-car plus total rating display.

**Architecture:** Use additive PostgreSQL schema changes so existing production data remains valid. Reuse the existing base64 image upload pattern and `/uploads` static serving. Store schedule-attached external participants in dedicated tables, and expose compact summaries through existing schedule/public/evaluation APIs.

**Tech Stack:** Express API, Tencent PostgreSQL via Supabase-compatible adapter and Drizzle, React/Vite UI, local `/uploads` static files.

---

### Task 1: Schema And Smoke Test

**Files:**
- Create: `supabase/migrations/202606230125_schedule_media_external_participants.sql`
- Create: `scripts/schedule-media-commission-smoke.ts`
- Modify: `api/db/schema.ts`
- Modify: `client/src/types/index.ts`
- Modify: `client/src/types/schedule.ts`

- [ ] Add nullable room/actor photo columns, schedule car sequence override, external NPC table, LingQi commission table.
- [ ] Add a smoke test that verifies new columns/tables exist.
- [ ] Run smoke test after applying migration.

### Task 2: Upload And API

**Files:**
- Modify: `api/index.ts`

- [ ] Add generic protected image upload endpoint for room/actor/external NPC photos.
- [ ] Include `photo_url` in rooms and actors CRUD.
- [ ] Include `store_car_sequence` in schedule create/update, auto-computed `computed_car_sequence` in schedule reads.
- [ ] Add external NPC and LingQi commission CRUD endpoints scoped to current tenant schedule.
- [ ] Add available LingQi master list endpoint without banned/non-visible profiles.
- [ ] Extend public schedule and evaluation data with room photo, actor photos, external NPCs, confirmed LingQi masters, car sequence, per-car rating, total script rating.

### Task 3: Admin UI

**Files:**
- Modify: `client/src/components/RoomManager.tsx`
- Modify: `client/src/components/ActorManager.tsx`
- Modify: `client/src/components/ScheduleCalendar.tsx`
- Modify: `client/src/components/ScheduleCalendarModal.tsx`

- [ ] Add image upload/preview to room and actor forms/cards.
- [ ] Add car sequence override to schedule form.
- [ ] Add external NPC editor with optional photo.
- [ ] Add LingQi master commission selector and status controls.

### Task 4: Player And Evaluation UI

**Files:**
- Modify: `client/src/pages/PlayerJoinSchedulePage.tsx`
- Modify: `client/src/pages/EvaluationPage.tsx`
- Modify: `client/src/components/EvaluationManager.tsx`

- [ ] Show room photo, assigned actor photos, external NPCs, and confirmed LingQi masters on player-facing schedule pages.
- [ ] Show car sequence and per-car/total ratings on evaluation page.
- [ ] Show per-car and total rating breakdown in store evaluation dashboard.

### Task 5: Verify, Commit, Deploy

**Files:**
- All touched files.

- [ ] Run `npx tsx scripts/schedule-media-commission-smoke.ts` against local/current DB when migration is applied.
- [ ] Run existing smoke tests that do not require destructive production writes.
- [ ] Run `git diff --check`.
- [ ] Run `npm run build:tencent`.
- [ ] Commit and deploy with `npm run deploy:tencent`.
