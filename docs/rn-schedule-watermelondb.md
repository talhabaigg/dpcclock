# RN Schedule App — WatermelonDB Integration

Companion to [`rn-schedule-app.md`](rn-schedule-app.md). That doc deferred WatermelonDB to v2; this one supersedes it. The Laravel backend is now Watermelon-compatible, so the RN client should move local-only state into a Watermelon database and sync via the new `/sync/pull` and `/sync/push` endpoints.

---

## What changed on the backend

- Both `project_tasks` and `project_task_links` now have a `uuid` column (char(36), unique, auto-generated). All existing rows have been backfilled.
- `project_task_links` has soft deletes (`deleted_at`) so deletions become tombstones the sync protocol can transmit.
- Two new endpoints under `auth:sanctum`:
  - `GET  /api/schedule/projects/{project}/sync/pull?last_pulled_at={ms}&include_calendar=1`
  - `POST /api/schedule/projects/{project}/sync/push`

The bigint primary keys are unchanged — the web portal still uses them. The sync controller translates `parent_id` / `source_id` / `target_id` between bigint (server) and uuid (client) at the boundary, so the RN app talks **only in UUIDs**.

---

## Endpoints the RN app uses

Once Watermelon is wired up, the RN app only needs these:

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/login` | Sanctum login → bearer token |
| GET | `/api/schedule/projects` | Project picker (lightweight list) |
| GET | `/api/schedule/projects/{project}/sync/pull` | Watermelon pull |
| POST | `/api/schedule/projects/{project}/sync/push` | Watermelon push |

All other `/api/schedule/*` endpoints (snapshot, bulk-update, tasks/links CRUD) are now fallback-only. The RN app should not call them after the Watermelon migration.

---

## Wire shape

### Pull request

```
GET /api/schedule/projects/123/sync/pull?last_pulled_at=1745740800000&include_calendar=1
Authorization: Bearer <token>
```

`last_pulled_at` is milliseconds since epoch. Use `0` (or omit) for the first sync to get everything. `include_calendar=1` is opt-in — pass it on the **first** pull (or whenever you need to refresh holidays/RDOs/non-work-days), since the calendar is not part of the changes set.

### Pull response

```jsonc
{
  "changes": {
    "project_tasks": {
      "created": [
        {
          "id": "5b1a...uuid",            // task uuid (Watermelon `id`)
          "location_id": 123,
          "parent_id": "9a3c...uuid"|null,// parent's uuid
          "name": "Foundations",
          "start_date": "2026-04-01"|null,
          "end_date": "2026-04-30"|null,
          "baseline_start": "...|null",
          "baseline_finish": "...|null",
          "sort_order": 0,
          "progress": 0.0,
          "color": "#22c55e"|null,
          "is_critical": false,
          "is_owned": true,
          "headcount": 5|null,
          "responsible": "John Smith"|null,
          "status": "in_progress"|null,   // not_started | in_progress | blocked | done | null
          "notes": "..."|null,
          "created_at": 1745000000000,    // ms
          "updated_at": 1745740800000     // ms
        }
      ],
      "updated": [ ...same shape... ],
      "deleted": ["uuid", "uuid"]
    },
    "project_task_links": {
      "created": [
        {
          "id": "ab12...uuid",
          "location_id": 123,
          "source_id": "task-uuid",
          "target_id": "task-uuid",
          "type": "FS",                   // FS | SS | FF | SF
          "lag_days": 2,
          "created_at": 1745000000000,
          "updated_at": 1745000000000
        }
      ],
      "updated": [ ... ],
      "deleted": ["uuid"]
    }
  },
  "timestamp": 1745740800123,             // server's "now" (ms) — store as next last_pulled_at
  "calendar": {                           // only when include_calendar=1
    "project": {
      "id": 123,
      "name": "Tower 1",
      "state": "QLD",
      "working_days": [1,2,3,4,5]         // 0=Sun..6=Sat
    },
    "global_non_work_days":  [{ "start":"2026-04-25", "end":"2026-04-25", "type":"public_holiday", "title":"Anzac Day" }],
    "project_non_work_days": [{ "start":"2026-05-10", "end":"2026-05-12", "type":"weather",         "title":"Cyclone delay" }]
  }
}
```

Behavior notes:
- First pull (`last_pulled_at=0`): all live rows go to `created`, no `deleted` array.
- Subsequent pulls: rows where `created_at > last_pulled_at` go to `created`, rows where `created_at <= last_pulled_at` go to `updated`, rows where `deleted_at > last_pulled_at` go to `deleted` (uuid only).
- Soft-deleted task `id`s appear in `deleted`. The server runs a soft-delete cascade through children, so deleting a parent will surface every descendant uuid.

### Push request

```
POST /api/schedule/projects/123/sync/push
Authorization: Bearer <token>
Content-Type: application/json
```

```jsonc
{
  "changes": {
    "project_tasks": {
      "created": [
        { "id":"new-uuid", "parent_id":"existing-or-new-uuid"|null, "name":"...", "start_date":"2026-04-02", "end_date":"2026-05-01", "sort_order":3, "progress":0, "is_owned":true, "is_critical":false, "color":"#22c55e" }
      ],
      "updated": [
        { "id":"existing-uuid", "start_date":"2026-04-02", "end_date":"2026-05-01" }   // any subset of fields
      ],
      "deleted": ["uuid", "uuid"]
    },
    "project_task_links": {
      "created": [
        { "id":"new-uuid", "source_id":"task-uuid", "target_id":"task-uuid", "type":"FS", "lag_days":0 }
      ],
      "updated": [
        { "id":"existing-uuid", "lag_days":2 }
      ],
      "deleted": ["uuid"]
    }
  }
}
```

Server behavior:
- Wraps everything in a single transaction.
- For task creates: two-pass insert so a batch can include a new parent and its new children together. Pass 1 inserts every new task with `parent_id=null`; pass 2 sets `parent_id` by uuid lookup.
- For task updates: any subset of fields is fine. `parent_id` accepts a uuid or `null`.
- **Snaps dates server-side** — `start_date` / `baseline_start` forward to next workday, `end_date` / `baseline_finish` backward to previous workday, using the project's `working_days` + state holidays/RDOs + project non-work-days. Your client preview must do the same so the displayed bar matches what the server returns on the next pull.
- Deletes are soft. Tombstones come back via the next pull's `deleted` arrays.
- Restores tombstoned twins on link upsert (defends the `(source_id, target_id)` unique index).
- "Last write wins" — no conflict response in v1.

### Push response

```jsonc
{ "ok": true, "timestamp": 1745740800456 }
```

You don't need the timestamp (Watermelon advances `last_pulled_at` only on pulls), but it's there if useful.

---

## Watermelon schema (RN side)

Match the wire shape exactly. WatermelonDB requires every model to have an `id` column (string) — that's the server uuid. `created_at` / `updated_at` are integers (ms).

```ts
// src/db/schema.ts
import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'project_tasks',
      columns: [
        { name: 'location_id', type: 'number' },
        { name: 'parent_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'start_date', type: 'string', isOptional: true },
        { name: 'end_date', type: 'string', isOptional: true },
        { name: 'baseline_start', type: 'string', isOptional: true },
        { name: 'baseline_finish', type: 'string', isOptional: true },
        { name: 'sort_order', type: 'number' },
        { name: 'progress', type: 'number' },
        { name: 'color', type: 'string', isOptional: true },
        { name: 'is_critical', type: 'boolean' },
        { name: 'is_owned', type: 'boolean' },
        { name: 'headcount', type: 'number', isOptional: true },
        { name: 'responsible', type: 'string', isOptional: true },
        { name: 'status', type: 'string', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'project_task_links',
      columns: [
        { name: 'location_id', type: 'number' },
        { name: 'source_id', type: 'string', isIndexed: true },
        { name: 'target_id', type: 'string', isIndexed: true },
        { name: 'type', type: 'string' },
        { name: 'lag_days', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
```

Two important rules:

1. **Column names must match the wire shape exactly** — Watermelon's sync engine writes `changes.project_tasks.created[i].name` straight into the `name` column. Any rename and sync silently breaks.
2. **`parent_id` / `source_id` / `target_id` are strings (UUIDs), not numbers.** Watermelon's `@relation` decorator works against string keys. The server has translated bigints away.

---

## Models

```ts
// src/db/models/ProjectTask.ts
import { Model } from '@nozbe/watermelondb';
import { field, date, relation, children } from '@nozbe/watermelondb/decorators';

export class ProjectTaskModel extends Model {
  static table = 'project_tasks';
  static associations = {
    project_task_links: { type: 'has_many' as const, foreignKey: 'source_id' },
  };

  @field('location_id')   locationId!: number;
  @field('parent_id')     parentId!: string | null;
  @field('name')          name!: string;
  @field('start_date')    startDate!: string | null;
  @field('end_date')      endDate!: string | null;
  @field('baseline_start')   baselineStart!: string | null;
  @field('baseline_finish')  baselineFinish!: string | null;
  @field('sort_order')    sortOrder!: number;
  @field('progress')      progress!: number;
  @field('color')         color!: string | null;
  @field('is_critical')   isCritical!: boolean;
  @field('is_owned')      isOwned!: boolean;
  @field('headcount')     headcount!: number | null;
  @field('responsible')   responsible!: string | null;
  @field('status')        status!: string | null;
  @field('notes')         notes!: string | null;

  @relation('project_tasks', 'parent_id') parent!: any;
}
```

```ts
// src/db/models/ProjectTaskLink.ts
import { Model } from '@nozbe/watermelondb';
import { field, relation } from '@nozbe/watermelondb/decorators';

export class ProjectTaskLinkModel extends Model {
  static table = 'project_task_links';

  @field('location_id') locationId!: number;
  @field('source_id')   sourceId!: string;
  @field('target_id')   targetId!: string;
  @field('type')        type!: 'FS' | 'SS' | 'FF' | 'SF';
  @field('lag_days')    lagDays!: number;

  @relation('project_tasks', 'source_id') source!: any;
  @relation('project_tasks', 'target_id') target!: any;
}
```

---

## Database setup

```ts
// src/db/index.ts
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import { ProjectTaskModel } from './models/ProjectTask';
import { ProjectTaskLinkModel } from './models/ProjectTaskLink';

const adapter = new SQLiteAdapter({
  schema,
  jsi: true, // big perf win on RN — uses JSI bridge
  // dbName: 'dpcclock-schedule',
});

export const database = new Database({
  adapter,
  modelClasses: [ProjectTaskModel, ProjectTaskLinkModel],
});
```

Wrap your app in a `DatabaseProvider`:

```tsx
// App.tsx
import { DatabaseProvider } from '@nozbe/watermelondb/DatabaseProvider';
import { database } from './src/db';

export default function App() {
  return (
    <DatabaseProvider database={database}>
      {/* ... */}
    </DatabaseProvider>
  );
}
```

---

## Sync wiring

```ts
// src/sync/scheduleSync.ts
import { synchronize } from '@nozbe/watermelondb/sync';
import { database } from '../db';
import { api } from '../api/client'; // your fetch/axios wrapper that injects Bearer token

export async function syncProject(projectId: number, opts?: { withCalendar?: boolean }) {
  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt }) => {
      const params = new URLSearchParams();
      params.set('last_pulled_at', String(lastPulledAt ?? 0));
      if (opts?.withCalendar || !lastPulledAt) params.set('include_calendar', '1');

      const res = await api.get(
        `/api/schedule/projects/${projectId}/sync/pull?${params.toString()}`
      );

      // Cache calendar separately if returned (Watermelon doesn't store it)
      if (res.calendar) {
        await saveCalendarToCache(projectId, res.calendar);
      }

      return { changes: res.changes, timestamp: res.timestamp };
    },
    pushChanges: async ({ changes, lastPulledAt }) => {
      await api.post(`/api/schedule/projects/${projectId}/sync/push`, { changes });
    },
    sendCreatedAsUpdated: false,
    migrationsEnabledAtVersion: 1,
  });
}
```

**`sendCreatedAsUpdated: false`** is intentional — the server distinguishes create vs update via the `created_at` watermark in pull, so on push we want Watermelon to send creates and updates separately.

### When to call `syncProject`

- On project open, before rendering the schedule (await it; show a loader if local DB is empty)
- On a debounced trigger after each batch of edits (drag-end, task add, etc.) — Watermelon's local writes are instant; the sync flushes them in one push
- On app foreground / network reconnect
- Manually via a "sync now" button if you want explicit control

### Calendar cache

Calendar (working_days, holidays, non-work-days) is **not** stored in Watermelon — it's small, slow-changing, and only needed for client-side workday math. Store it in MMKV or AsyncStorage keyed by project id, and refresh by calling pull with `include_calendar=1` periodically (e.g. on project open if cache > 24h old).

```ts
// src/sync/calendarCache.ts
import { MMKV } from 'react-native-mmkv';
const storage = new MMKV();

export function saveCalendarToCache(projectId: number, calendar: any) {
  storage.set(`calendar:${projectId}`, JSON.stringify({ calendar, fetchedAt: Date.now() }));
}

export function loadCalendarFromCache(projectId: number) {
  const raw = storage.getString(`calendar:${projectId}`);
  if (!raw) return null;
  return JSON.parse(raw);
}
```

---

## Migrating from your current local-only state

You already have the read-only interface + drag/sort working with local state. To move to Watermelon:

1. **Build the schema + models + database** (above).
2. **Replace your snapshot fetch** with `syncProject(projectId, { withCalendar: true })`. The first call with no local data behaves identically to the old snapshot — pulls everything, populates the local DB.
3. **Read tasks/links from Watermelon collections instead of local arrays.** Use `withObservables` to make components reactive:
   ```tsx
   import { withObservables } from '@nozbe/watermelondb/react';
   const enhance = withObservables(['projectId'], ({ projectId }) => ({
     tasks: database
       .get<ProjectTaskModel>('project_tasks')
       .query(Q.where('location_id', projectId))
       .observe(),
   }));
   ```
   Components re-render automatically when any task changes.
4. **Drag-end / edit handlers write to Watermelon, not to your Zustand store:**
   ```ts
   await database.write(async () => {
     await task.update((t) => {
       t.startDate = newStart;
       t.endDate = newEnd;
     });
   });
   ```
   This is instant (local write). Then debounce a `syncProject` call to flush to server.
5. **Cascade resolver writes affected tasks in the same `database.write()` block** — Watermelon coalesces them into one push payload.

### Hot path during a drag

```
finger drag           → Reanimated shared values (UI thread)
drag end              → database.write({ task.update(...); cascadeUpdates(...); })
                        ↳ FlashList re-renders affected rows reactively
                        ↳ schedule debounced sync (500ms) → push
push response (200)   → no UI change needed; local DB is already authoritative
next pull (on focus)  → server's snapped dates overwrite local in case of drift
```

---

## UUID handling

The RN app generates UUIDs for new rows; the server accepts them as-is. Watermelon's collection `create()` already does this via `Math.random` UUID, but if you want explicit UUID v4:

```ts
import 'react-native-get-random-values'; // polyfill BEFORE importing uuid
import { v4 as uuidv4 } from 'uuid';

await database.write(async () => {
  await tasks.create((t) => {
    t._raw.id = uuidv4();           // explicit, optional
    t.locationId = projectId;
    t.parentId = parent?.id ?? null;
    t.name = 'New task';
    t.sortOrder = nextSort;
    t.progress = 0;
    t.isCritical = false;
    t.isOwned = true;
  });
});
```

Don't worry about server bigints — you'll never see them. The server returns uuids in pull responses, accepts uuids in push payloads.

---

## Working-day math (still needed client-side)

Sync doesn't replace WDM. The server snaps dates on push, but your **drag preview** has to land on workdays in real time, not after a round-trip. The math is exactly the same as in [`rn-schedule-app.md`](rn-schedule-app.md#working-day-math-client-side):

```ts
// src/features/schedule/workdays.ts
export function buildNonWorkSet(calendar: CalendarPayload): Set<string> {
  const set = new Set<string>();
  for (const r of [...calendar.global_non_work_days, ...calendar.project_non_work_days]) {
    const start = new Date(r.start + 'T00:00:00');
    const end = new Date(r.end + 'T00:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      set.add(d.toISOString().slice(0, 10));
    }
  }
  return set;
}

export function isNonWorkDay(date: string, workingDays: number[], nonWorkSet: Set<string>) {
  const d = new Date(date + 'T00:00:00');
  if (!workingDays.includes(d.getDay())) return true;
  return nonWorkSet.has(date);
}

export function snapToWorkday(date: string, dir: 'forward' | 'backward', workingDays: number[], nonWorkSet: Set<string>) {
  const d = new Date(date + 'T00:00:00');
  const step = dir === 'forward' ? 1 : -1;
  while (isNonWorkDay(d.toISOString().slice(0, 10), workingDays, nonWorkSet)) {
    d.setDate(d.getDate() + step);
  }
  return d.toISOString().slice(0, 10);
}

export function addWorkdays(date: string, n: number, workingDays: number[], nonWorkSet: Set<string>) {
  let d = new Date(date + 'T00:00:00');
  let remaining = n;
  const step = n >= 0 ? 1 : -1;
  while (remaining !== 0) {
    d.setDate(d.getDate() + step);
    if (!isNonWorkDay(d.toISOString().slice(0, 10), workingDays, nonWorkSet)) {
      remaining -= step;
    }
  }
  return d.toISOString().slice(0, 10);
}
```

Mirrors the server's `ScheduleController::snapDate` exactly. Add golden tests against snapshots from a real project.

Cascade resolver lives next to it, walks outgoing links, applies `lag_days` via `addWorkdays`, recurses, returns a list of `{ id, start_date, end_date }` to write in one `database.write()` block.

---

## Conflict semantics (v1)

- **Last write wins.** If two clients edit the same task between syncs, whoever pushes second overwrites.
- **No `experimentalRejectedIds`** — server doesn't reject pushes; it accepts everything.
- **Pull always returns the server's view of truth.** If your local copy diverged, the next pull will overwrite the affected rows. Watermelon handles this transparently.

This is fine for v1 (single-user-per-project workflows). If multi-writer conflicts become real, the controller is the right place to add rejection logic.

---

## Edge cases & known limitations

- **`updated_at` is second-precision.** Two writes within the same wall-clock second around `last_pulled_at` could be missed by an incremental pull. Workaround: always pull on focus, not just on debounce. Long-term fix: bump server columns to `DATETIME(3)` and millisecond watermarks.
- **Calendar (holidays/RDOs/non-work-days) is not in Watermelon.** Re-fetch with `include_calendar=1` periodically; cache in MMKV.
- **Deletes cascade through children server-side.** If you delete a parent task locally, also delete its children locally before push (or just push the parent and let the next pull surface the cascaded deletions). Easier: do the cascade locally for instant UI, the server agrees on push.
- **Soft-deleted-then-recreated link with same `source_id`+`target_id`** is handled — server restores the tombstoned twin to keep the unique index happy.
- **First pull on a large project** can be a few hundred KB. That's fine; subsequent pulls are tiny.
- **Watermelon doesn't store the calendar.** If you go offline and need calendar for cascade math, you must have called `include_calendar=1` at least once and cached it in MMKV.

---

## Testing checklist

Before declaring the migration done:

- [ ] First open of a project pulls all tasks + links + calendar; data appears in the schedule.
- [ ] Edit a task locally → push fires within debounce → next pull confirms server has the change.
- [ ] Drag a task across a holiday/RDO. Verify the bar lands on a workday immediately (client WDM) and that the server-snapped date matches on next pull.
- [ ] Add a new task offline → reconnect → push succeeds → task is visible on the web portal.
- [ ] Delete a task offline → reconnect → push succeeds → task no longer appears in pull.
- [ ] Two clients (e.g. RN + web portal) edit the same project → both see each other's changes after a sync round-trip.
- [ ] Airplane mode after first load: read works, edits queue locally, flush on reconnect.
- [ ] Cascade through 50 dependent tasks via drag → exactly one push request, all 50 tasks updated.
- [ ] Soft-delete a parent task → server's cascade deletes children → next pull surfaces all of them in `deleted`.

---

## File layout suggestion (RN side)

```
src/
  db/
    index.ts            # database instance
    schema.ts           # Watermelon schema
    models/
      ProjectTask.ts
      ProjectTaskLink.ts
  sync/
    scheduleSync.ts     # synchronize() wrapper
    calendarCache.ts    # MMKV cache for non-Watermelon data
  api/
    client.ts           # fetch wrapper + Sanctum bearer injection
    auth.ts             # POST /api/login
    projects.ts         # GET /api/schedule/projects
  features/
    schedule/
      workdays.ts       # snapToWorkday, addWorkdays, isNonWorkDay
      cascade.ts        # walk links, apply lag_days
      WbsTree.tsx
      GanttCanvas.tsx
      TaskBar.tsx
      ...
```

---

## Deferred / not in this doc

- Real-time updates (server push to RN). Pull-on-focus is enough for v1.
- Conflict UI (resolution dialogs). v1 is last-write-wins.
- Multi-project sync in one Watermelon DB. Today, sync one project at a time per `syncProject(projectId)` call. If you need multiple projects loaded simultaneously, every pull will write all those projects' rows into the same tables — it works, but be aware all reads must filter by `location_id`.
