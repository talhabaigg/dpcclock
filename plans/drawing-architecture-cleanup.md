# Drawing Feature — Architecture Cleanup RFC

## Why

The Drawing feature is the largest single domain in the codebase:

- **Backend:** ~6,200 lines across 2 controllers, 2 models, 5 services
- **Frontend:** ~7,100 lines across 7 page components, with `show.tsx` (2,109 LOC) and `takeoff.tsx` (1,419 LOC) as the top two
- **Tests:** zero — both because the surface is too coupled to HTTP and because model `booted()` hooks call `auth()->id()` directly, which is unmockable without a logged-in user.

The feature works. This RFC is about making it cheaper to change, test, and extend going forward.

## Scope

Five deepening opportunities, ranked by leverage. Each can ship independently.

| # | Target | Est. effort | Risk | Outcome |
|---|--------|-------------|------|---------|
| 1 | Extract `DrawingFileServer` | Half day | Low | −160 LOC duplication; testable file serving |
| 2 | Extract `DrawingSummaryService` | 2-3 days | Medium | ~500 LOC of inline aggregation becomes testable module |
| 3 | Extract `RevisionService` | 1-2 days | Low-Medium | Revision lifecycle stops leaking across model + controller |
| 4 | Extract `ObservationService` + remove `auth()` seam | 1 day | Low | Observer logic becomes unit-testable |
| 5 | Split `show.tsx` / `takeoff.tsx` by tab | 3-5 days | Medium | Each tab becomes independently navigable; cognitive load drops |

Items 1-4 are backend refactors with strong deep-module shape. Item 5 is a separate frontend RFC track — listed for visibility but not designed in detail here.

---

## 1. `DrawingFileServer`

### Problem
[DrawingController.php:1597-1763](app/Http/Controllers/DrawingController.php#L1597-L1763) has three methods — `serveFile`, `serveThumbnail`, `serveDiff` — each doing the same "try public disk, fall back to S3, stream with headers" dance. ~160 lines of nearly identical code. One method (`serveDiff`) reads disk from config; the other two hardcode `'public'` then `'s3'`. Inconsistency is the smell.

### Proposed Interface

```php
namespace App\Services\Drawings;

final class DrawingFileServer
{
    /**
     * Stream a drawing-related file from whichever disk holds it.
     * Returns 404 if absent on every candidate disk.
     *
     * @param  list<string>  $disks  Disks to try, in order
     */
    public function stream(
        string $path,
        string $mimeType,
        string $disposition = 'inline',
        int $cacheSeconds = 3600,
        array $disks = ['public', 's3'],
    ): StreamedResponse;
}
```

### Usage

```php
// Controller
return $this->fileServer->stream(
    path: $drawing->storage_path ?? $drawing->file_path,
    mimeType: $drawing->mime_type ?? 'application/pdf',
    disposition: 'inline; filename="' . $drawing->original_name . '"',
);
```

### Hides
- Disk resolution order
- Stream lifecycle (`fpassthru` + `fclose`)
- Header construction
- MIME type fallbacks for thumbnails (`image/png` vs `image/jpeg` by extension)

### Tests enabled
- Fake `public` disk missing, `s3` hit → correct stream
- Both disks miss → 404
- Header correctness (content-disposition, cache-control)

---

## 2. `DrawingSummaryService` (the big one)

### Problem
Five controller methods ([conditions:233](app/Http/Controllers/DrawingController.php#L233), [labour:348](app/Http/Controllers/DrawingController.php#L348), [material:516](app/Http/Controllers/DrawingController.php#L516), [estimate:687](app/Http/Controllers/DrawingController.php#L687), [budget:1138](app/Http/Controllers/DrawingController.php#L1138)) each load a drawing + revisions, query all `DrawingMeasurement` rows in the project, and aggregate into a different roll-up DTO. ~500 LOC of pure business logic living in controller actions means:

- No reuse between web and API controllers (`Api\DrawingController` has to re-implement or skip these views)
- No unit tests — the aggregation math is only reachable via HTTP
- Changes to quantity-multiplier rules or deduction handling must be mirrored across five spots

### Recommended Design (hybrid of parallel design proposals A + C)

Injectable service, five explicit methods returning typed readonly DTOs:

```php
namespace App\Services\Drawings;

use App\Models\Location;
use App\Services\Drawings\DTO\{
    ConditionSummary, LabourSummary, MaterialSummary, EstimateSummary, BudgetSummary
};

final class DrawingSummaryService
{
    public function __construct(
        private readonly DrawingMeasurementRepository $measurements,
        private readonly TakeoffConditionRepository $conditions,
    ) {}

    public function conditions(Location $project): ConditionSummary;
    public function labour(Location $project): LabourSummary;
    public function material(Location $project): MaterialSummary;
    public function estimate(Location $project): EstimateSummary;
    public function budget(Location $project): BudgetSummary;
}
```

Each DTO is a `final readonly class` with typed row lists and totals — no loose `array<string, mixed>`:

```php
final readonly class ConditionSummary
{
    /** @param list<ConditionRow> $rows */
    public function __construct(
        public int $projectId,
        public array $rows,
        public SummaryTotals $totals,
    ) {}
}
```

### Usage

```php
public function labour(Drawing $drawing, DrawingSummaryService $summary): Response
{
    [$drawing, $revisions, $projectDrawings] = $this->loadDrawingWithRevisions($drawing);

    return Inertia::render('drawings/labour', [
        'drawing' => $drawing,
        'revisions' => $revisions,
        'projectDrawings' => $projectDrawings,
        'summary' => $summary->labour($drawing->project),
    ]);
}
```

Controller actions shrink from ~150 lines to ~10.

### Why not enum dispatch (design A) or fluent macro (design C)

- **Enum dispatch** (`summarize($project, SummaryView::LABOUR)`) collapses five methods into one but forces one class to know all five output shapes — it's the same fat-controller smell at the service layer. Five small, focused methods are easier to read and extend.
- **Macro on `Location`** (`$project->summary()->labour()`) reads beautifully but couples the service to a model and hides it from the container, making implementation swaps (e.g. cached variants) awkward. Keep the explicit DI.

### Deferred (do not build yet)

Design B's filter/shape/cache machinery (revision scopes, bid-area filters, cache keys, queued regeneration). Add these one at a time when a real caller needs them, not speculatively.

### Hides
- `loadDrawingWithRevisions` coordination
- The eager-load set (`takeoffCondition`, `bidArea`, `deductions`, `lineItems`, `drawing:id,quantity_multiplier`)
- Quantity-multiplier math and deduction subtraction
- Condition × LCC pairing rules
- Currency rounding

### Tests enabled
- Unit tests for every aggregation branch — multipliers, deductions, empty projects, single-condition projects
- Both web and API controllers can reuse the same service

---

## 3. `RevisionService`

### Problem
Revision lifecycle is split three ways:

- `Drawing::addRevision()` — static method on the model ([Drawing.php](app/Models/Drawing.php))
- `Drawing::makeActive()` — instance method on the model
- `DrawingController::store()` — decides when to call which

Revision chain management (`previous_revision_id`, status transitions, A→B→C or 1→2→3 numbering, diff generation trigger) is leaky. The model has knowledge it shouldn't; the controller decides policy that belongs to the domain.

### Proposed Interface

```php
namespace App\Services\Drawings;

final class RevisionService
{
    public function __construct(
        private readonly DrawingProcessingService $processing,
    ) {}

    /**
     * Upload a new revision of an existing sheet, superseding the current active.
     * Dispatches processing (thumbnail, dimensions, diff vs previous).
     */
    public function addRevision(Drawing $newDrawing, int $userId): Drawing;

    /**
     * Promote this drawing to active, superseding any current active sibling.
     */
    public function activate(Drawing $drawing, int $userId): void;

    /**
     * All sibling revisions of this sheet, ordered newest first.
     *
     * @return Collection<int, Drawing>
     */
    public function siblings(Drawing $drawing): Collection;
}
```

### Hides
- `(project_id, sheet_number)` grouping
- Next-revision-number math (A, B, C vs 1, 2, 3)
- `previous_revision_id` chain wiring
- Status transitions (DRAFT → ACTIVE, ACTIVE → SUPERSEDED)
- `ProcessDrawingJob` dispatch for diff generation

### Tests enabled
- Adding first revision (no previous) vs Nth revision (chain extends)
- Activating out-of-order drawing supersedes correctly
- Mixed-numbering schemes don't collide

Remove `Drawing::addRevision()` static and `Drawing::makeActive()` after migration.

---

## 4. `ObservationService` + remove `auth()` seam

### Problem
- `DrawingObservation::booted()` and `Drawing::booted()` both call `auth()->id()` directly to populate `created_by`. Any queued job or console command creating these models blows up with a null `Auth` facade.
- `DrawingObservationController::describe()` at line 285 does `new DrawingComparisonService;` inline, bypassing the container.
- Observation lifecycle (create, update, confirm, describe-with-AI, bulk-delete) is 325 lines of controller.

### Proposed Interface

```php
namespace App\Services\Drawings;

final class ObservationService
{
    public function __construct(
        private readonly DrawingComparisonService $comparison,
        private readonly ObservationPhotoStorage $photos,
    ) {}

    public function create(Drawing $drawing, CreateObservationData $data, int $userId): DrawingObservation;
    public function update(DrawingObservation $observation, UpdateObservationData $data, int $userId): DrawingObservation;
    public function confirm(DrawingObservation $observation, int $userId): DrawingObservation;
    public function describe(DrawingObservation $observation): DrawingObservation;
    public function delete(DrawingObservation $observation): void;
    public function bulkDelete(array $ids, Drawing $drawing): int;
}
```

### Changes
- `userId` flows in explicitly — no more `auth()->id()` inside model hooks
- Drop the `booted()` hooks; service sets `created_by` / `updated_by` on write
- Inject `DrawingComparisonService` instead of `new`ing it
- Photo upload encapsulated in `ObservationPhotoStorage` (S3 key strategy + temporary URL generation)

### Tests enabled
- Creating observations in queue context (no logged-in user)
- AI describe flow without mocking controllers
- Photo upload failures

---

## 5. Frontend page splitting (separate RFC)

`show.tsx` (2,109 LOC) and `takeoff.tsx` (1,419 LOC) each handle 7 distinct workflows (takeoff, conditions, labour, material, production, budget, qa). Each tab deserves its own module with a shared shell for the viewer + sidebar.

**Proposed structure:**

```
pages/drawings/
  _shell.tsx               # Viewer + tab nav + shared chrome
  takeoff/
    index.tsx              # Entry — composes viewer + takeoff panel
    measurement-layer.tsx  # Split from 1,412-line monolith: line/area/count/calibration tools
    takeoff-panel.tsx      # Split from 967-line monolith: list / grouping / cost summary
  conditions/index.tsx
  labour/index.tsx
  material/index.tsx
  production/index.tsx
  budget/index.tsx
  qa/index.tsx
```

Defer to a separate RFC — this one is large enough.

---

## Migration Plan

Ship in this order, each as its own PR:

1. **PR 1:** `DrawingFileServer` — mechanical extraction, no behaviour change. Golden path: open a drawing, confirm file + thumbnail + diff all load.
2. **PR 2:** `RevisionService` — extract, keep model methods as thin delegators for one release, then remove.
3. **PR 3:** `ObservationService` — extract, remove `auth()->id()` from both model `booted()` hooks. Verify queue jobs that create drawings still work.
4. **PR 4:** `DrawingSummaryService` — the big one. Build with full unit-test coverage for aggregation math. Migrate one view at a time (start with `budget` — smallest — then `estimate`, `conditions`, `labour`, `material`).
5. **PR 5+:** Frontend split (separate RFC).

Each PR should include feature tests hitting the relevant HTTP endpoints to confirm no regression.

## What this RFC explicitly does NOT propose

- Rewriting `DrawingComparisonService` (1,507 LOC). Noted as future work but its surface area is AI-dependent and the cost/value of splitting it is unclear until the summary + observation work settles.
- Moving to repositories for every query. Only the two repositories needed by `DrawingSummaryService` are justified by this RFC.
- Changing the public URLs or API contract. All refactors preserve existing routes and response shapes.
