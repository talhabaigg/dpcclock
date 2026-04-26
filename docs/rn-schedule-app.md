# React Native Schedule App — Build Brief

You are building a **React Native (Expo) mobile app** that consumes the
project-schedule API of an existing Laravel 12 portal (`dpcclock`). The web
version of this schedule already exists but suffers from poor performance with
1000+ tasks during drag-and-drop. The whole point of going native is to fix
that.

## Goal

Render and edit large project schedules (Gantt + WBS tree) on iOS/Android with
**60fps drag-and-drop** even at 1000+ tasks, and full offline editing.

## Non-goals (for v1)

- Recreating every feature of the web app (MS Project export, baseline mgmt,
  CSV import, bulk-ownership, etc.). Stick to **view + drag/edit dates +
  add/remove tasks + add/remove dependencies**.
- Auth UX polish — a single email/password screen is fine.
- Push notifications, geofencing — not in v1.

## Required Tech Stack

This list is mandatory because each item is what makes the perf thesis hold.
Do not substitute without explicit reason.

- **Expo SDK 52+** (managed workflow is fine)
- **TypeScript** — strict mode
- **React Native Reanimated 3** — drag/resize must run on UI thread (worklets)
- **react-native-gesture-handler** — pair with Reanimated for native gesture
  recognition
- **@shopify/flash-list** — list virtualization for the WBS tree
- **@shopify/react-native-skia** — for the Gantt timeline canvas (drawing
  1000+ task bars as DOM-equivalent `<View>`s will tank perf; draw on Skia
  canvas instead)
- **Zustand** — local state store (lighter than Redux, good with Reanimated)
- **TanStack Query (React Query) v5** — server state / cache / mutation queue
- **expo-secure-store** — Sanctum token storage
- **WatermelonDB** — DEFER to v2. Build v1 against React Query cache only,
  prove perf, then layer offline-first sync.

## API

Base URL: configurable via env, default `https://<your-portal>/api`.

Auth is **Laravel Sanctum** personal access tokens. Login flow:

```
POST /api/login
Body: { email, password, device_name }
→ { token: "...", user: {...} }
```

Send `Authorization: Bearer <token>` on every subsequent request.

### Schedule endpoints (all under `auth:sanctum`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/schedule/projects` | List schedulable projects (id, name, state, working_days, updated_at) |
| GET | `/api/schedule/projects/{project}/snapshot` | **Single-shot full project**: tasks + links + non-work-days + working_days. Use this on screen mount. |
| POST | `/api/schedule/projects/{project}/tasks/bulk-update` | **Critical perf path** — send all tasks changed by a single drag in one request |
| POST | `/api/schedule/projects/{project}/tasks` | Create task |
| PATCH | `/api/schedule/tasks/{task}` | Update task (any subset of fields) |
| DELETE | `/api/schedule/tasks/{task}` | Soft-delete task + descendants |
| POST | `/api/schedule/projects/{project}/links` | Create dependency (upserts on source+target) |
| PATCH | `/api/schedule/links/{link}` | Update dependency (type/lag) |
| DELETE | `/api/schedule/links/{link}` | Delete dependency |

### Snapshot response shape

```jsonc
{
  "project": {
    "id": 123,
    "name": "Tower 1",
    "state": "QLD",
    "working_days": [1, 2, 3, 4, 5]   // 0=Sun..6=Sat
  },
  "tasks": [
    {
      "id": 1,
      "location_id": 123,
      "parent_id": null,
      "name": "Foundations",
      "start_date": "2026-04-01",
      "end_date": "2026-04-30",
      "baseline_start": "2026-04-01",
      "baseline_finish": "2026-04-25",
      "sort_order": 0,
      "progress": 0,
      "color": "#22c55e",
      "is_critical": false,
      "is_owned": true,
      "headcount": 5,
      "responsible": "John Smith",
      "status": "in_progress",   // not_started | in_progress | blocked | done | null
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "links": [
    {
      "id": 1,
      "location_id": 123,
      "source_id": 1,
      "target_id": 2,
      "type": "FS",              // FS | SS | FF | SF
      "lag_days": 2              // negative = lead
    }
  ],
  "global_non_work_days": [{ "start": "2026-04-25", "end": "2026-04-25", "type": "public_holiday", "title": "Anzac Day" }],
  "project_non_work_days": [{ "start": "2026-05-10", "end": "2026-05-12", "type": "weather", "title": "Cyclone delay" }],
  "server_time": "2026-04-25T10:00:00+10:00"
}
```

### Bulk update body shape

```jsonc
POST /api/schedule/projects/{project}/tasks/bulk-update
{
  "tasks": [
    { "id": 1, "start_date": "2026-04-02", "end_date": "2026-05-01" },
    { "id": 2, "start_date": "2026-05-02", "end_date": "2026-05-15" },
    { "id": 7, "sort_order": 3, "parent_id": 5 }
  ]
}
→ { "success": true, "tasks": [ ...full task list ordered by sort_order... ] }
```

Server **snaps dates to working days** (forward for start, backward for end)
using the project's working_days + global holidays/RDOs + project non-work
days. So your client-side preview math should do the same to match — see
"Working day math" below.

## Data model rules (must respect)

1. **Tasks form a tree** via `parent_id`. Roots have `parent_id: null`. No
   depth limit. Order within siblings via `sort_order` (0-based).
2. **Cycles forbidden** — a task cannot be moved under its own descendant.
   Server enforces; client should disable invalid drop targets.
3. **Dependencies are between any two tasks** (not just siblings). Types:
   - `FS` (finish-to-start) — most common
   - `SS` (start-to-start)
   - `FF` (finish-to-finish)
   - `SF` (start-to-finish) — rare
   `lag_days` is added to the predecessor edge: positive = delay, negative =
   overlap. Lag is in **calendar days** in the data model — but the visual
   schedule treats them as working days, see below.
4. **Dates are strings `YYYY-MM-DD`** — no timezones, no times.
5. **Soft-deleted tasks** never appear in API responses; you don't need to
   handle the `deleted_at` field.

## Working day math (client-side)

To make drag previews instant (without server round-trip), replicate this:

```ts
function isNonWorkDay(date: string, workingDays: number[], nonWorkSet: Set<string>) {
  const d = new Date(date + 'T00:00:00');
  if (!workingDays.includes(d.getDay())) return true;
  return nonWorkSet.has(date);
}

function snapToWorkday(date: string, dir: 'forward' | 'backward', ...) {
  let d = new Date(date + 'T00:00:00');
  while (isNonWorkDay(...)) d.setDate(d.getDate() + (dir === 'forward' ? 1 : -1));
  return ymd(d);
}
```

Build the `nonWorkSet` once on snapshot load by expanding each
`global_non_work_days` and `project_non_work_days` range into a `Set<string>`
of `YYYY-MM-DD` keys.

## Architecture

### Screens

1. **Login** — email/password → store token in SecureStore.
2. **Project list** — fetch `/schedule/projects`, FlashList of cards.
3. **Project schedule** — the meat:
   - Top: zoom controls + filters (delayed, critical, owned, status)
   - Left pane: **WBS tree** (FlashList) — collapsible, inline name edit
   - Right pane: **Gantt canvas** (Skia) — task bars, dependency arrows,
     today-line, non-work-day shading
   - Drag a bar to move it; drag edges to resize; long-press a row to drag
     in tree; tap a bar to open task editor sheet.

### State

- **Server cache** (TanStack Query): the snapshot. Refetch on focus /
  network reconnect.
- **Optimistic UI store** (Zustand): pending edits not yet flushed to server.
  Drag operations write here immediately, then a debounced flush calls
  `bulk-update`.
- **Reanimated shared values**: per-task `translateX`/`width` for the bars
  while dragging, so the UI thread does the visual work.

### Critical perf rules

1. **Drag bars on the UI thread.** Use Reanimated's `useAnimatedStyle` +
   `useSharedValue`. Do NOT setState during drag — only on drag-end.
2. **Render the timeline in Skia**, not as 1000 `<View>`s. One `<Canvas>`
   draws all bars in one frame.
3. **Use FlashList for the WBS tree**, not FlatList. Set `estimatedItemSize`.
4. **Memoize task derivations.** Computing critical path, depth, etc. across
   1000 tasks every render will kill you. Memoize per task and only
   invalidate touched IDs.
5. **Batch network writes.** A drag that cascades dates through 50 tasks via
   dependencies → ONE `bulk-update` call, not 50.

## Suggested file layout

```
src/
  api/
    client.ts          # axios/fetch wrapper, token injection
    schedule.ts        # endpoint functions, types
  hooks/
    useSnapshot.ts     # React Query wrapper for snapshot
    useBulkUpdate.ts   # mutation + optimistic update
  store/
    schedule.ts        # Zustand store: pending edits, selection, zoom
  features/
    schedule/
      WbsTree.tsx              # FlashList of tasks
      GanttCanvas.tsx          # Skia canvas
      TaskBar.tsx              # individual bar (Reanimated)
      DependencyArrows.tsx     # Skia path drawing
      TaskEditorSheet.tsx      # bottom-sheet edit form
      workdays.ts              # snapToWorkday, isNonWorkDay
      criticalPath.ts          # client-side CP calc
  screens/
    LoginScreen.tsx
    ProjectListScreen.tsx
    ScheduleScreen.tsx
  navigation/
    index.tsx          # React Navigation stack
```

## Acceptance criteria for v1 spike

The point of v1 is to prove the perf thesis. Done = all of:

1. Loads a project with 1000 real tasks in < 2s on a mid-range Android.
2. Dragging a task bar runs at 60fps (no dropped frames in Reanimated
   profiler) while the JS thread is held busy.
3. Cascading 50 dependent tasks via drag results in **one** bulk-update
   network call, applied optimistically.
4. Tree expand/collapse is instant.
5. Works in airplane mode after first load (read-only is fine for v1; queued
   writes flush on reconnect is a stretch goal).

## Things to NOT build in v1

- WatermelonDB / offline writes (do this in v2 once perf is proven).
- AI features (rescheduling, NLP commands) — these come after.
- Baseline / set-baseline / revert — web app handles this fine.
- MS Project import/export.
- Push notifications.

## Questions to ask the human if blocked

- What's the portal's base URL? (production + staging)
- Test account email/password?
- A specific large project ID to load for perf testing?

## When you're done

Hand back:
1. A repo (or branch) with the Expo app.
2. A short video/GIF showing 1000-task drag at 60fps.
3. Honest perf numbers from the Android profiler.
4. List of API gaps you hit (the Laravel API can be extended).
