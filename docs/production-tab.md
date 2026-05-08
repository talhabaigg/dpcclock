# Production Tab — Complete Feature Documentation

Reference document for rebuilding the production tab in React Native (portal-mobile) for offline iPad use.

---

## 1. Concept Overview

The production tab lets site workers track construction progress on drawings. An estimator draws measurements (walls, floors, areas) during takeoff. A site worker then marks what percentage of each measurement is complete for a given work date.

**Key terms:**
- **Measurement**: A drawn shape on a drawing (polyline, polygon, or count markers)
- **Labour Cost Code (LCC)**: A budget category (e.g., "01-100-A Framing"). Each measurement's condition can have multiple LCCs.
- **Condition**: A takeoff template that groups measurements and assigns LCCs with production rates.
- **Segment**: A single line between two consecutive vertices of a polyline. A wall drawn as 4 connected lines = 1 measurement with 4 segments.
- **Work Date**: Status is tracked per-date with carry-forward (yesterday's status persists into today until changed).

**User workflow:**
1. Open production tab for a drawing
2. Select a Labour Cost Code from the right panel
3. All measurements with that LCC become visible (colored by status)
4. Click a measurement/segment → percent dropdown appears → set 0–100%
5. Or use box-select to drag-select multiple items → floating action bar → bulk set percent
6. Toggle "Hide Done" to hide 100% items
7. Change work date to track daily progress

---

## 2. Database Schema

### 2.1 `measurement_statuses`

Stores percent complete for a whole measurement on a given date.

```sql
CREATE TABLE measurement_statuses (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    drawing_measurement_id  BIGINT UNSIGNED NOT NULL,  -- FK → drawing_measurements
    labour_cost_code_id     BIGINT UNSIGNED NOT NULL,  -- FK → labour_cost_codes
    percent_complete        TINYINT UNSIGNED DEFAULT 0, -- 0-100
    work_date               DATE NULL,                  -- NULL for legacy undated records
    updated_by              BIGINT UNSIGNED NULL,       -- FK → users
    created_at              TIMESTAMP NULL,
    updated_at              TIMESTAMP NULL,

    UNIQUE (drawing_measurement_id, labour_cost_code_id, work_date),
    FOREIGN KEY (drawing_measurement_id) REFERENCES drawing_measurements(id) ON DELETE CASCADE,
    FOREIGN KEY (labour_cost_code_id) REFERENCES labour_cost_codes(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);
```

### 2.2 `measurement_segment_statuses`

Stores percent complete per-segment per-LCC for linear measurements (2+ points).
Unique key is `seg_status_unique_v3` on `(drawing_measurement_id, labour_cost_code_id,
segment_index, work_date)` — each labour cost code keeps independent progress.

```sql
CREATE TABLE measurement_segment_statuses (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    drawing_measurement_id  BIGINT UNSIGNED NOT NULL,
    labour_cost_code_id     BIGINT UNSIGNED NOT NULL,
    segment_index           SMALLINT UNSIGNED NOT NULL,  -- 0-indexed
    percent_complete        TINYINT UNSIGNED DEFAULT 0,
    work_date               DATE NULL,
    updated_by              BIGINT UNSIGNED NULL,
    created_at              TIMESTAMP NULL,
    updated_at              TIMESTAMP NULL,

    UNIQUE (drawing_measurement_id, labour_cost_code_id, segment_index, work_date),
    FOREIGN KEY (drawing_measurement_id) REFERENCES drawing_measurements(id) ON DELETE CASCADE,
    FOREIGN KEY (labour_cost_code_id) REFERENCES labour_cost_codes(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);
```

### 2.3 `budget_hours_entries`

Downstream table that receives aggregated production percentages for budget tracking.

```sql
-- Key columns (simplified)
budget_hours_entries:
    id, location_id, bid_area_id (nullable), labour_cost_code_id,
    work_date, used_hours (float), percent_complete (float), updated_by

    UNIQUE (location_id, bid_area_id, labour_cost_code_id, work_date)
```

### 2.4 Key relationships on `drawing_measurements`

```
drawing_measurements
  ├── condition → takeoff_conditions (via takeoff_condition_id)
  │     └── conditionLabourCodes → condition_labour_codes (hasMany)
  │           └── labourCostCode → labour_cost_codes (belongsTo)
  ├── statuses → measurement_statuses (hasMany, FK: drawing_measurement_id)
  └── segmentStatuses → measurement_segment_statuses (hasMany, FK: drawing_measurement_id)
```

---

## 3. Segmentation Rules

Backend segment statusing applies to any linear measurement with at least 1 segment:
- `type === 'linear'`
- `points.length >= 2` (1+ segments — single 2-point walls are statusable per-segment)

The frontend (`production.tsx`) currently exposes the segment-level UI only when
`points.length >= 3` (multi-segment polylines, e.g. curved walls split into
multiple Bezier sub-segments). Whole 2-point linears get the measurement-level
% control. The backend permits both, so future UI flows can address either.

**Segment geometry:**
- N points → N-1 segments (0-indexed)
- Segment `i` connects `points[i]` to `points[i+1]`
- Segment length = Euclidean distance between normalized points: `sqrt(dx² + dy²)`
- Points are stored as normalized coordinates (0–1 range relative to drawing dimensions)

**Non-segmented measurements** (areas, counts):
- Use whole-measurement statusing via `measurement_statuses`

**Per-LCC progress:** both `measurement_statuses` and `measurement_segment_statuses`
are unique on `(measurement, labour_cost_code_id, [segment_index,] work_date)`.
Each labour cost code tracks its own % independently; switching the selected LCC
on the production page shows that trade's specific progress (a wall framed 100%
under `INT_FRM` shows 0% under `SHEET` until separately statused).

---

## 4. Carry-Forward Logic

Status values persist across dates. When displaying statuses for a given `work_date`:

1. Query all records where `work_date <= selectedDate` OR `work_date IS NULL`
2. For each unique key `(measurement_id, lcc_id)` or `(measurement_id, segment_index)`:
   - Prefer dated records over NULL-dated records
   - Among dated records, use the most recent one
3. Return the winning `percent_complete`

**Example:**
```
Records for measurement 42, LCC 5:
  work_date=2026-02-10, percent=30
  work_date=2026-02-12, percent=60
  work_date=NULL,        percent=10  (legacy)

Query for date 2026-02-11 → returns 30 (carry-forward from 2/10)
Query for date 2026-02-12 → returns 60 (exact match)
Query for date 2026-02-09 → returns 10 (only NULL record qualifies)
```

**PHP implementation** (same pattern for both tables):
```php
$allRecords = MeasurementStatus::whereIn('drawing_measurement_id', $measurementIds)
    ->where(function ($q) use ($workDate) {
        $q->whereNull('work_date')
          ->orWhere('work_date', '<=', $workDate);
    })
    ->get();

$statuses = [];
foreach ($allRecords as $record) {
    $key = $record->drawing_measurement_id . '-' . $record->labour_cost_code_id;
    $recordDate = $record->work_date?->toDateString();

    if (!isset($statuses[$key])) {
        $statuses[$key] = ['percent' => $record->percent_complete, 'date' => $recordDate];
    } else {
        $existingDate = $statuses[$key]['date'];
        if ($existingDate === null && $recordDate !== null) {
            $statuses[$key] = ['percent' => $record->percent_complete, 'date' => $recordDate];
        } elseif ($recordDate !== null && $existingDate !== null && $recordDate > $existingDate) {
            $statuses[$key] = ['percent' => $record->percent_complete, 'date' => $recordDate];
        }
    }
}
return array_map(fn ($s) => $s['percent'], $statuses);
```

---

## 5. Segment-to-Measurement Sync

When a segment status is updated, the measurement-level status is auto-computed as a **length-weighted average**.

**Formula:**
```
avgPercent = round(Σ(percent_i × length_i) / Σ(length_i))
```

**Steps:**
1. Compute each segment's length from normalized points: `sqrt((x2-x1)² + (y2-y1)²)`
2. Get all segment statuses for that measurement + LCC (with carry-forward)
3. Weighted sum: `Σ(segment_percent × segment_length)`
4. Divide by total length
5. Write result to `measurement_statuses` table

**PHP:**
```php
private function syncSegmentToMeasurementStatus(DrawingMeasurement $measurement, int $lccId, string $workDate): void
{
    $points = $measurement->points ?? [];
    $numSegments = count($points) - 1;
    if ($numSegments < 2) return;

    // Compute segment lengths from normalized points
    $segmentLengths = [];
    $totalLength = 0;
    for ($i = 0; $i < $numSegments; $i++) {
        $dx = ($points[$i + 1]['x'] ?? 0) - ($points[$i]['x'] ?? 0);
        $dy = ($points[$i + 1]['y'] ?? 0) - ($points[$i]['y'] ?? 0);
        $len = sqrt($dx * $dx + $dy * $dy);
        $segmentLengths[$i] = $len;
        $totalLength += $len;
    }
    if ($totalLength <= 0) return;

    // Get segment statuses with carry-forward
    $segRecords = MeasurementSegmentStatus::where('drawing_measurement_id', $measurement->id)
        ->where('labour_cost_code_id', $lccId)
        ->where(fn ($q) => $q->whereNull('work_date')->orWhere('work_date', '<=', $workDate))
        ->get();

    // Apply same carry-forward logic as buildStatusesForDate...
    $segStatuses = []; // segment_index => {percent, date}
    // (carry-forward dedup loop)

    // Compute weighted average
    $weightedSum = 0;
    for ($i = 0; $i < $numSegments; $i++) {
        $percent = $segStatuses[$i]['percent'] ?? 0;
        $weightedSum += $percent * $segmentLengths[$i];
    }
    $avgPercent = (int) round($weightedSum / $totalLength);

    // Write to measurement_statuses
    MeasurementStatus::updateOrCreate(
        ['drawing_measurement_id' => $measurement->id, 'labour_cost_code_id' => $lccId, 'work_date' => $workDate],
        ['percent_complete' => $avgPercent, 'updated_by' => auth()->id()]
    );
}
```

---

## 6. Budget Sync (Production → Budget)

After every status update, the controller syncs to `budget_hours_entries` for the budget tab.

**Scope:** Project-wide (all drawings in the project), not per-drawing.

**Aggregation key:** `(bid_area_id, labour_cost_code_id)`

**Formula:**
```
percent_complete = Σ(qty × percent) / Σ(qty)
```
where `qty = measurement.computed_value` and `percent = measurement status for that LCC`.

**Writes to:** `budget_hours_entries` with `updateOrCreate` on `(location_id, bid_area_id, labour_cost_code_id, work_date)`.

---

## 7. LCC Summary Computation

The right-side panel shows aggregated stats per LCC. Computed server-side.

**Per LCC:**
```
total_qty         = Σ(measurement.computed_value)         for all measurements with this LCC
weighted_percent  = Σ(qty × percent) / Σ(qty)            quantity-weighted average
budget_hours      = Σ(qty / production_rate)              for each measurement
earned_hours      = budget_hours × (weighted_percent / 100)
measurement_count = number of measurements with this LCC
```

**Production rate precedence:**
1. `condition_labour_codes.production_rate` (condition-level override)
2. `labour_cost_codes.default_production_rate` (LCC default)
3. 0 (no rate → 0 budget hours)

---

## 8. API Endpoints

All require `drawings.view` permission.

### 8.1 `GET /drawings/{drawing}/production`

**Purpose:** Initial page load (Inertia render)

**Response props:**
| Prop | Type | Description |
|------|------|-------------|
| `measurements` | `ProductionMeasurement[]` | Takeoff measurements with conditions & LCCs |
| `calibration` | `CalibrationData \| null` | Scale calibration for the drawing |
| `statuses` | `Record<"measId-lccId", number>` | Measurement-level percent_complete |
| `segmentStatuses` | `Record<"measId-segIdx", number>` | Segment-level percent_complete |
| `lccSummary` | `LccSummary[]` | Aggregated stats per LCC |
| `workDate` | `string` | ISO date string |

### 8.2 `GET /drawings/{drawing}/production-statuses?work_date=YYYY-MM-DD&lcc_id={int}`

**Purpose:** Reload statuses without a full page navigation. Called when the user
changes the work date OR switches the selected labour cost code on the page.

**Query params:**
- `work_date` (required) — ISO date for carry-forward
- `lcc_id` (optional) — when supplied, `segmentStatuses` in the response is
  filtered to only that LCC's progress (per-LCC semantics; same key shape
  `measId-segIdx`, but the values are scoped to the LCC). Omit for the
  cross-LCC view used by aggregate consumers.

**Response:** `{ statuses, segmentStatuses, lccSummary }`

### 8.3 `POST /drawings/{drawing}/measurement-status`

**Purpose:** Set percent for a single non-segmented measurement.

**Payload:**
```json
{
    "measurement_id": 42,
    "labour_cost_code_id": 5,
    "percent_complete": 70,
    "work_date": "2026-02-14"
}
```

**Response:** `{ success, status, lccSummary }`

### 8.4 `POST /drawings/{drawing}/measurement-status-bulk`

**Purpose:** Set same percent for multiple non-segmented measurements.

**Payload:**
```json
{
    "measurement_ids": [42, 43, 44],
    "labour_cost_code_id": 5,
    "percent_complete": 100,
    "work_date": "2026-02-14"
}
```

**Response:** `{ success, updated_count, lccSummary }`

### 8.5 `POST /drawings/{drawing}/segment-status`

**Purpose:** Set percent for a single segment.

**Payload:**
```json
{
    "measurement_id": 42,
    "labour_cost_code_id": 5,
    "segment_index": 2,
    "percent_complete": 50,
    "work_date": "2026-02-14"
}
```

**Response:** `{ success, statuses, segmentStatuses, lccSummary }`

Note: Segment statuses automatically sync to measurement-level via weighted average.

### 8.6 `POST /drawings/{drawing}/segment-status-bulk`

**Purpose:** Set percent for multiple segments/measurements at once. Used by both multi-select and box-select.

**Payload:**
```json
{
    "items": [
        { "measurement_id": 42, "segment_index": 0 },
        { "measurement_id": 42, "segment_index": 1 },
        { "measurement_id": 43 }
    ],
    "labour_cost_code_id": 5,
    "percent_complete": 100,
    "work_date": "2026-02-14"
}
```

Note: Items without `segment_index` are treated as whole-measurement updates.

**Response:** `{ success, statuses, segmentStatuses, lccSummary }`

---

## 9. Frontend State

### 9.1 Key state variables (production.tsx)

```typescript
selectedLccId: number | null          // Which LCC is active in the panel
selectedMeasurementId: number | null  // For dropdown positioning
statuses: Record<string, number>      // "measId-lccId" → percent (0-100)
segmentStatuses: Record<string, number> // "measId-segIdx" → percent (0-100)
lccSummary: LccSummary[]              // Panel data, updated after every save
percentDropdown: {                     // Floating dropdown state
    measurementId: number;
    segmentIndex?: number;
    x: number;                         // clientX from click event
    y: number;                         // clientY from click event
} | null
workDate: string                       // "YYYY-MM-DD"
selectedItems: Set<string>             // Multi-select: "m-{id}" or "s-{measId}-{segIdx}"
hideComplete: boolean                  // Toggle to hide 100% items
selectorMode: boolean                  // Box-select mode on/off
```

### 9.2 LccSummary type

```typescript
type LccSummary = {
    labour_cost_code_id: number;
    code: string;          // e.g., "01-100-A"
    name: string;          // e.g., "Framing"
    unit: string;          // e.g., "m²"
    total_qty: number;
    budget_hours: number;
    earned_hours: number;
    weighted_percent: number;  // 0-100
    measurement_count: number;
};
```

### 9.3 State resets

When `selectedLccId` changes:
- Clear `selectedItems`
- Reset `hideComplete` to false
- Reset `selectorMode` to false
- Close `percentDropdown`

---

## 10. Measurement Rendering Logic

### 10.1 Color rules

```typescript
function getSegmentColor(percent: number): string {
    if (percent >= 100) return '#22c55e';  // green-500
    return '#3b82f6';                       // blue-500
}

// Box-select mode overrides:
const BOX_SELECT_BASE = '#93c5fd';     // blue-300 (unselected in box mode)
const BOX_SELECT_ACTIVE = '#1d4ed8';   // blue-700 (selected in box mode)
```

### 10.2 Display color logic

For every measurement/segment, compute `displayColor`:
```typescript
const displayColor = boxSelectMode
    ? (isSelected ? BOX_SELECT_ACTIVE : BOX_SELECT_BASE)
    : statusBasedColor;
```

### 10.3 Segmented linear rendering (type='linear', points >= 3)

When `segmentStatuses` prop is present:
1. For each segment (pair of consecutive points):
   - Look up `segmentStatuses["${measId}-${segIdx}"]` → percent
   - Compute segment color from percent
   - Render as individual `L.polyline` with 2 points
   - Render selection glow underneath if selected (blue, +6 weight, 0.7 opacity)
   - Render percent badge (`divIcon`) at segment midpoint: `"{percent}%"`
2. Render vertex dots at all points (radius 1, white fill)

### 10.4 Non-segmented linear rendering (type='linear', points < 3)

- Render as single `L.polyline`
- Color overridden based on measurement-level status
- Selection glow if in `selectedMeasurementIds`

### 10.5 Area rendering (type='area')

- Render as `L.polygon`
- Fill color = display color, fill opacity = 0.7 (0.75 if focused)
- Selection glow if selected
- Percent badge at centroid (from `productionLabels`)

### 10.6 Count rendering (type='count')

- Render individual `L.circleMarker` at each point
- Summary label at first point

---

## 11. Selection & Multi-Select

### 11.1 Selection keys

```
"m-{measurementId}"                  → whole measurement
"s-{measurementId}-{segmentIndex}"   → individual segment
```

### 11.2 Click behavior

- **No items selected + click**: Opens percent dropdown at click position
- **Items already selected + click**: Toggles item in/out of selection (no dropdown)
- **Escape**: Clears selection (or closes dropdown)

### 11.3 Box-select mode

When `selectorMode = true`:
1. Leaflet map dragging is disabled
2. Cursor changes to crosshair
3. User drags rectangle → blue dashed rectangle visual
4. On mouseup: convert to normalized bounds → check intersection
5. All intersecting items added to selection set

**Intersection detection for segments:**
- Check if either endpoint is inside the rectangle
- Check if the segment crosses any of the 4 rectangle edges (using cross-product line-segment intersection)

**Intersection detection for areas:**
- Check if any vertex is inside the rectangle
- Check if any polygon edge intersects the rectangle edges

### 11.4 Floating action bar

When `selectedItems.size > 0`:
- Fixed bar at bottom center of screen
- Shows: count + percent buttons (0%, 10%, 20%, ... 100%) + clear button
- Clicking a percent calls `bulkSetPercent()` → POST to `/segment-status-bulk`

### 11.5 Select All

- Button in production panel (visible when LCC selected)
- Selects all visible measurements/segments (respects `hideComplete` filter)

---

## 12. Hide 100% Complete

When `hideComplete = true`:

**For segmented measurements:**
- Hidden only if ALL segments have `segmentStatuses["${measId}-${segIdx}"] >= 100`

**For non-segmented measurements:**
- Hidden if `statuses["${measId}-${selectedLccId}"] >= 100`

---

## 13. Percent Dropdown

Compact floating UI positioned near the click point.

**Positioning:**
- `left = click.clientX + 20` (offset right so it doesn't cover the measurement)
- `top = click.clientY - dropdownHeight/3`
- Clamped to viewport bounds

**Options:**
- Pre-defined: 0%, 10%, 20%, 30%, 40%, 50%, 60%, 70%, 80%, 90%, 100%
- Custom input: number field (0–100), submit on Enter

**Current value highlighted** with accent background.

---

## 14. Production Panel (Right Side)

320px wide sidebar showing LCC list and budget summary.

### 14.1 Header

"LABOUR COST CODES" + count

### 14.2 Controls (visible when LCC selected)

- **Select All**: Selects all visible measurements for the active LCC
- **Hide Done / Show Done**: Toggles `hideComplete`

### 14.3 LCC List

Each row:
- Status dot (blue)
- Code (monospace, bold) + name (truncated)
- Progress bar (fill = `weighted_percent`)
- Percent badge

Click to select/deselect. Selected row gets accent background + ring.

### 14.4 Budget Summary (footer)

- Overall progress bar (quantity-weighted average of all LCCs)
- 3-column grid:
  - **Budget**: Total budget hours (sum of all LCCs)
  - **Earned**: Total earned hours
  - **Items**: Total measurement count

---

## 15. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    USER INTERACTION                       │
│  Click measurement/segment  │  Box-select  │  Bulk bar   │
└────────────────┬────────────┴──────┬───────┴──────┬──────┘
                 │                   │              │
                 ▼                   ▼              ▼
┌─────────────────────────────────────────────────────────┐
│              FRONTEND (production.tsx)                    │
│                                                          │
│  Optimistic update: statuses / segmentStatuses maps      │
│  POST to API endpoint                                    │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│              BACKEND (DrawingController)                  │
│                                                          │
│  1. Validate + write to measurement_segment_statuses     │
│     or measurement_statuses                              │
│                                                          │
│  2. If segment: syncSegmentToMeasurementStatus()         │
│     → weighted avg → write to measurement_statuses       │
│                                                          │
│  3. buildStatusesForDate() (carry-forward)               │
│  4. buildAllSegmentStatusesForDate() (carry-forward)     │
│  5. buildLccSummary() (qty-weighted aggregation)         │
│  6. syncProductionToBudget() (project-wide → budget)     │
│                                                          │
│  Return: { statuses, segmentStatuses, lccSummary }       │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│              FRONTEND (production.tsx)                    │
│                                                          │
│  Replace optimistic values with server response          │
│  Update lccSummary → panel re-renders                    │
│  Measurement colors update on map                        │
└─────────────────────────────────────────────────────────┘
```

---

## 16. Offline Considerations for React Native

When building this for offline iPad use, the key challenges are:

### 16.1 Data to sync down (server → device)

Before going to site, download:
- All drawings for the project (images/tiles)
- All `drawing_measurements` with conditions & LCCs
- All `measurement_statuses` and `measurement_segment_statuses` for the project
- All `labour_cost_codes` used in the project
- Calibration data per drawing

### 16.2 Data to sync up (device → server)

When back online, push:
- New/updated `measurement_statuses` rows
- New/updated `measurement_segment_statuses` rows — **must include `labour_cost_code_id`**
- Server then runs `syncSegmentToMeasurementStatus()` + `syncProductionToBudget()` for each affected measurement

**WatermelonDB sync contract** (`Api/SyncController`):

- Pull: `formatSegmentStatus()` returns `{ id, server_id, drawing_server_id,
  measurement_server_id, labour_cost_code_id, segment_index, percent_complete,
  work_date, created_at, updated_at }` — `labour_cost_code_id` **must** be
  persisted on the device side.
- Push: `pushSegmentStatuses()` upserts using
  `(drawing_measurement_id, labour_cost_code_id, segment_index, work_date)` as the
  natural key. Records that arrive without `labour_cost_code_id` are skipped
  with a server log warning to avoid violating the per-LCC invariant.

Mobile schema must add a `labour_cost_code_id` column (with a FK or just a
plain int reference) on `measurement_segment_statuses`. Existing rows from the
v2 (LCC-agnostic) era should be migrated either by:
- Backfilling from the user-active LCC at the time the segment was statused
  (if you've kept that audit), or
- Marking them as needing re-statusing (set to `null` and exclude from carry-forward).

### 16.3 Computations to run on-device

These must work without server:
- **Carry-forward logic**: Query local SQLite with same `work_date <= selected` logic
- **Segment-to-measurement sync**: Weighted average from segment statuses → measurement status
- **LCC summary**: Qty-weighted aggregation for the panel display
- **Color computation**: `getSegmentColor(percent)` — trivial
- **Segment intersection for box-select**: `lineSegmentsIntersect()` — pure math

### 16.4 Conflict resolution

If two users status the same measurement on the same date:
- Current web behavior: last-write-wins (updateOrCreate)
- For offline: timestamp each write, sync with last-write-wins, or prompt user to resolve

### 16.5 Local storage schema (suggested SQLite)

Mirror the server tables:
```sql
-- Local status queue (pending sync)
CREATE TABLE local_status_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drawing_measurement_id INTEGER NOT NULL,
    labour_cost_code_id INTEGER NOT NULL,
    segment_index INTEGER NULL,      -- NULL = measurement-level
    percent_complete INTEGER NOT NULL,
    work_date TEXT NOT NULL,
    updated_by INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    synced INTEGER DEFAULT 0          -- 0=pending, 1=synced
);
```

---

## 17. Key Helper Functions (for React Native reimplementation)

### 17.1 Segment color

```typescript
function getSegmentColor(percent: number): string {
    if (percent >= 100) return '#22c55e'; // green
    return '#3b82f6';                      // blue
}
```

### 17.2 Is segmentable

```typescript
function isSegmentable(m: Measurement): boolean {
    return m.type === 'linear' && Array.isArray(m.points) && m.points.length >= 3;
}
```

### 17.3 Segment length (normalized coords)

```typescript
function segmentLength(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
}
```

### 17.4 Weighted average for segment→measurement sync

```typescript
function computeWeightedPercent(
    points: Point[],
    segStatuses: Record<string, number>,
    measId: number,
): number {
    const numSeg = points.length - 1;
    let totalLen = 0;
    let weightedSum = 0;
    for (let i = 0; i < numSeg; i++) {
        const len = segmentLength(points[i], points[i + 1]);
        const pct = segStatuses[`${measId}-${i}`] ?? 0;
        weightedSum += pct * len;
        totalLen += len;
    }
    return totalLen > 0 ? Math.round(weightedSum / totalLen) : 0;
}
```

### 17.5 Line segment intersection (for box-select)

```typescript
function lineSegmentsIntersect(
    ax: number, ay: number, bx: number, by: number,
    cx: number, cy: number, dx: number, dy: number,
): boolean {
    const cross = (ux: number, uy: number, vx: number, vy: number) => ux * vy - uy * vx;
    const abx = bx - ax, aby = by - ay;
    const d1 = cross(abx, aby, cx - ax, cy - ay);
    const d2 = cross(abx, aby, dx - ax, dy - ay);
    if (d1 * d2 > 0) return false;
    const cdx = dx - cx, cdy = dy - cy;
    const d3 = cross(cdx, cdy, ax - cx, ay - cy);
    const d4 = cross(cdx, cdy, bx - cx, by - cy);
    if (d3 * d4 > 0) return false;
    return true;
}
```

### 17.6 LCC summary computation

```typescript
function buildLccSummary(
    measurements: Measurement[],
    statuses: Record<string, number>,
): LccSummary[] {
    const summary: Record<number, LccSummary & { weightedQtyPercent: number }> = {};

    for (const m of measurements) {
        const qty = m.computed_value ?? 0;
        if (qty <= 0 || !m.condition?.condition_labour_codes) continue;

        for (const clc of m.condition.condition_labour_codes) {
            const lcc = clc.labour_cost_code;
            const lccId = lcc.id;
            if (!summary[lccId]) {
                summary[lccId] = {
                    labour_cost_code_id: lccId,
                    code: lcc.code,
                    name: lcc.name,
                    unit: lcc.unit,
                    total_qty: 0,
                    budget_hours: 0,
                    earned_hours: 0,
                    weighted_percent: 0,
                    measurement_count: 0,
                    weightedQtyPercent: 0,
                };
            }

            const percent = statuses[`${m.id}-${lccId}`] ?? 0;
            const prodRate = clc.production_rate ?? lcc.default_production_rate ?? 0;
            const budgetHours = prodRate > 0 ? qty / prodRate : 0;

            summary[lccId].total_qty += qty;
            summary[lccId].budget_hours += budgetHours;
            summary[lccId].weightedQtyPercent += qty * percent;
            summary[lccId].measurement_count++;
        }
    }

    return Object.values(summary).map(item => ({
        ...item,
        weighted_percent: item.total_qty > 0
            ? Math.round((item.weightedQtyPercent / item.total_qty) * 10) / 10
            : 0,
        earned_hours: Math.round(
            item.budget_hours * (
                (item.total_qty > 0 ? item.weightedQtyPercent / item.total_qty : 0) / 100
            ) * 100
        ) / 100,
        budget_hours: Math.round(item.budget_hours * 100) / 100,
    }));
}
```

---

## 18. UI Layout Summary

```
┌─────────────────────────────────────────────────────────────────┐
│ TOOLBAR                                                         │
│ [Pan] [Select] │ [📅 2026-02-14] │ ● LCC-01 Framing │ [Panel] │
├─────────────────────────────────────────────┬───────────────────┤
│                                             │ PRODUCTION PANEL  │
│                                             │ ─────────────────│
│                                             │ LABOUR COST CODES │
│           DRAWING / MAP                     │ [Select All][Hide]│
│                                             │                   │
│      Measurements rendered on map           │ ● 01-100 Framing  │
│      with percent badges                    │ ▓▓▓▓░░░░░░ 45%   │
│                                             │ ● 01-200 Drywall  │
│    ┌──────┐ ← Percent Dropdown              │ ▓▓▓▓▓▓▓░░░ 72%   │
│    │  0%  │   (at click position)           │                   │
│    │ 10%  │                                 │─────────────────  │
│    │ ...  │                                 │ Budget Summary    │
│    │100%  │                                 │ ▓▓▓▓▓▓░░░░ 58%   │
│    │[___] │ ← Custom input                  │ Budget  Earned    │
│    └──────┘                                 │ 120.5h  69.9h     │
│                                             │ Items: 24         │
├─────────────────────────────────────────────┴───────────────────┤
│          ┌─ FLOATING ACTION BAR (when items selected) ──┐       │
│          │ 5 selected │ 0% 10% 20% ... 100% │ ✕ Clear  │       │
│          └──────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```
