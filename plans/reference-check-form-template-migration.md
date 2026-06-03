# Reference Check → Form Template Migration

## Goal

Replace the hard-coded `EmploymentApplicationReferenceCheck` form with a configurable Form Template. HR fills the form in-app while phoning the referee; each reference on an application gets its own form, and HR chooses on-demand which references they actually want to check.

## Final architecture

| Decision | Value |
|---|---|
| `formable` | `EmploymentApplication` — owns comments, triggers, activity feed |
| `subject` (new) | `EmploymentApplicationReference` — the referee the form is about |
| `is_sendable` | `false` — in-app only, no email ever sent |
| `assignee_strategy` | `permission` — anyone with the HR permission can fill it |
| `dispatch_mode` (new) | `on_demand` — no auto fan-out; HR clicks "Start" per reference |
| `min_submissions` (new) | configurable (default 2) — gates application status transition |

Why this shape: `formable=Application` gives us the existing system-comment + trigger plumbing for free. `subject=Reference` is the clear, queryable link to the specific referee without overloading `formable`'s semantics. `on_demand` matches the reality that HR only calls 2-of-4 references and the other 2 shouldn't sit pending forever.

---

## Schema changes

### Migration 1 — `subject` morph on `form_requests`

```php
Schema::table('form_requests', function (Blueprint $table) {
    $table->nullableMorphs('subject');  // subject_type + subject_id + composite index
});
```

### Migration 2 — dispatch policy on `model_trigger_forms`

```php
Schema::table('model_trigger_forms', function (Blueprint $table) {
    $table->string('subject_source')->nullable()->after('form_template_id');
    $table->enum('dispatch_mode', ['auto', 'on_demand'])->default('auto')->after('subject_source');
    $table->unsignedInteger('min_submissions')->default(1)->after('dispatch_mode');
});
```

No other schema changes anywhere. The existing `employment_application_reference_checks` table is left in place during transition (backfill source, then archived).

---

## Code changes by file

### Models

**`app/Models/FormRequest.php`**
- Add `'subject_type'`, `'subject_id'` to `$fillable`.
- Add `subject(): MorphTo` returning `$this->morphTo()`.

**`app/Models/ModelTriggerForm.php`**
- Add `'subject_source'`, `'dispatch_mode'`, `'min_submissions'` to `$fillable`.
- Cast `min_submissions` to int.

**`app/Models/EmploymentApplicationReference.php`**
- Add a `displayLabel(): string` method returning `contact_person ?? company_name` — used by `FormService` to build a human-readable comment / recipient_name suffix.
- No `HasFormRequests` or `HasComments` trait. Reference stays a pure sub-entity; the form belongs to the application.

### Services

**`app/Services/FormService.php`**

`createAndSend()` gains an optional `?Model $subject = null` parameter. Pass through to the `FormRequest::create()` call:

```php
'subject_type' => $subject ? get_class($subject) : null,
'subject_id'   => $subject?->getKey(),
```

Extend the cancel-existing-pending query at line 42-51 to scope by subject so resending for reference 42 doesn't cancel reference 43's pending form:

```php
->when($subject,
    fn ($q) => $q->where('subject_id', $subject->getKey())
                 ->where('subject_type', get_class($subject)),
    fn ($q) => $q->whereNull('subject_id'),
)
```

Extend the system-comment body to include the subject label:

```php
$subjectSuffix = $subject?->displayLabel() ? " for {$subject->displayLabel()}" : '';
// "Form 'Reference Check' available in-app for completion by anyone with permission 'recruitment' for John Doe"
```

**`app/Services/ModelTriggerFormService.php`**

`dispatchFormsFor()` now only handles `dispatch_mode = auto` mappings:

```php
$mappings = $this->activeMappingsFor($formable, $triggerKey)
    ->where('dispatch_mode', 'auto');

foreach ($mappings as $mapping) {
    $subjects = $mapping->subject_source
        ? $formable->{$mapping->subject_source}
        : collect([null]);

    foreach ($subjects as $subject) {
        if ($this->formExists($formable, $mapping->form_template_id, $subject)) {
            continue;
        }
        $this->createForMapping($mapping, $formable, $subject, $admin);
    }
}
```

New `availableOnDemandForms()` for the application show page to query:

```php
public function availableOnDemandForms(Model $formable, string $triggerKey): Collection
{
    return ModelTriggerForm::query()
        ->active()
        ->forModelTrigger(get_class($formable), $triggerKey)
        ->where('dispatch_mode', 'on_demand')
        ->with('formTemplate')
        ->get();
}
```

New `startOnDemand()` called when HR clicks "Start reference check":

```php
public function startOnDemand(ModelTriggerForm $mapping, Model $formable, Model $subject, User $admin): FormRequest
{
    // Reuse existing createAndSend with the subject passed through.
    return $this->formService->createAndSend(
        template: $mapping->formTemplate,
        deliveryMethod: 'in_app',
        admin: $admin,
        recipientName: $mapping->assignee_strategy === 'permission'
            ? "Anyone with permission: {$mapping->assignee_value}"
            : $admin->name,
        recipientEmail: null,
        formable: $formable,
        subject: $subject,
        assigneeStrategy: $mapping->assignee_strategy,
        assigneePermission: $mapping->assignee_strategy === 'permission' ? $mapping->assignee_value : null,
    );
}
```

`blockersForLeaving()` switches from "any submission exists" to "submission count meets minimum":

```php
foreach ($mappings as $mapping) {
    $submitted = FormRequest::query()
        ->where('formable_type', get_class($formable))
        ->where('formable_id', $formable->getKey())
        ->where('form_template_id', $mapping->form_template_id)
        ->where('status', 'submitted')
        ->count();

    if ($submitted < $mapping->min_submissions) {
        $blockers[] = "{$mapping->formTemplate->name}: {$submitted} of {$mapping->min_submissions} completed";
    }
}
```

New `cancelPendingForTrigger()` called when application leaves the reference-check stage — sweeps stranded forms:

```php
public function cancelPendingForTrigger(Model $formable, string $leftTriggerKey, User $admin): void
{
    $templateIds = ModelTriggerForm::query()
        ->forModelTrigger(get_class($formable), $leftTriggerKey)
        ->pluck('form_template_id');

    FormRequest::query()
        ->where('formable_type', get_class($formable))
        ->where('formable_id', $formable->getKey())
        ->whereIn('form_template_id', $templateIds)
        ->whereIn('status', ['pending', 'sent', 'opened'])
        ->each(fn ($fr) => $this->formService->cancel($fr, $admin));
}
```

**`app/Services/FormPlaceholderResolver.php`**

Register reference-scoped tokens. For the Reference Check template (model_type = `EmploymentApplication`), HR needs access to both applicant and referee data at form-render time. Add tokens resolved from `$formRequest->subject` (the reference) in addition to `$formRequest->formable` (the application):

- `{{reference.contact_person}}`
- `{{reference.company_name}}`
- `{{reference.position}}`
- `{{reference.phone_number}}`
- `{{reference.employment_period}}`

These let the seeded template have `default_value = "{{reference.phone_number}}"` on the phone field etc, so HR opens the form and the referee's info is pre-populated.

### Controllers

**`app/Http/Controllers/ModelTriggerFormController.php`**

- Add `subjectSourcesByModel()` registry (mirrors `triggerKeysByModel()`):
  ```php
  return [
      EmploymentApplication::class => [
          'references' => 'One form per reference',
      ],
  ];
  ```
- Pass `subjectSourcesByModel` to the Inertia view.
- `store()` / `update()` validate `subject_source`, `dispatch_mode`, `min_submissions`. `subject_source` must be a key in the registry for the chosen model_type, or null.

**`app/Http/Controllers/EmploymentApplicationController.php`**

`show()` extends to render the per-reference form UI:

- Eager-load `references.formRequests` (uses the `subject` morph indirectly — query is `where subject_type = Reference and subject_id IN (refs)`).
- Pass `availableOnDemandForms` for the application's current status.
- Build a `referencesWithForms` array per reference: `{ reference, formRequest | null }`.

New routes (and controller methods):

- `POST /employment-applications/{app}/references/{reference}/start-form/{mapping}` — calls `ModelTriggerFormService::startOnDemand()`, redirects to the form fill page.
- `POST /employment-applications/{app}/references/{reference}/skip-form/{formRequest}` — calls `FormService::cancel()` with a "skipped" comment.

Status-change handler (around lines 543-560 where existing permission gates live): when application moves out of the reference-check status, call `cancelPendingForTrigger($app, 'checking_references', $admin)`.

### Frontend

**`resources/js/pages/model-trigger-forms/index.tsx`**

Add three fields to the create/edit row:
- **Subject** select — options come from `subjectSourcesByModel[selectedModelType]`. Hidden when empty. Default "None (single form)".
- **Dispatch mode** select — `Auto (fire on trigger)` / `On demand (HR starts manually)`.
- **Min submissions** number input — visible when `subject_source` is set, default 1.

Listing table gets one new column showing subject source + dispatch mode in a compact badge (e.g. "References · On demand").

**`resources/js/pages/employment-applications/show.tsx`** (or wherever the references list is rendered)

For each reference row, render a status pill + action based on `formRequest`:

| State | Pill | Action |
|---|---|---|
| No FormRequest | — | "Start reference check" button |
| Pending / sent / opened | "In progress" | "Continue" + "Skip" |
| Submitted | "Completed" | "View" |
| Cancelled | "Skipped" | "Restart" |

The "Continue" link opens the existing in-app form renderer; the "View" link opens the existing show page for a submitted FormRequest.

### Seed

**`database/seeders/ReferenceCheckFormTemplateSeeder.php`** (new)

Programmatically build the FormTemplate + FormFields to match the existing React form. Field-by-field mapping from [resources/js/pages/employment-applications/reference-check.tsx](resources/js/pages/employment-applications/reference-check.tsx):

| Section / Field | Template field type | Notes |
|---|---|---|
| Part A heading | `heading` | "Introduction" |
| Consent script | `paragraph` | Call script text |
| `prepared_to_provide_reference` | `radio` (Yes/No) | |
| `referee_current_job_title` | `text` | |
| `referee_current_employer` | `text` | |
| `telephone` | `phone` | `default_value = {{reference.phone_number}}` |
| `email` | `email` | |
| Part B heading | `heading` | |
| `employment_from` / `employment_to` | `date` × 2 | |
| `dates_align` | `radio` (Yes/No) | |
| `relationship` | `text` | |
| `relationship_duration` | `text` | |
| `company_at_time` | `text` | `default_value = {{reference.company_name}}` |
| `applicant_job_title` | `radio` (predefined list + "Other") | |
| `applicant_job_title_other` | `text` | `visible_if applicant_job_title = "other"` |
| `duties` | `checkbox` | 8 options from current hard-coded list |
| `performance_rating` | `button_group` | excellent / very_good / good / average / poor |
| `honest_work_ethic` | `button_group` | same scale |
| `punctual` | `button_group` | yes / no / sometimes |
| `sick_days` | `button_group` | yes / no / sometimes |
| Part C heading | `heading` | |
| `reason_for_leaving` | `textarea` | |
| `greatest_strengths` | `textarea` | |
| `would_rehire` | `radio` (Yes/No) | |
| Part D heading | `heading` | "Completed by" |
| `completed_by_name` | `text` | `default_value = {{current_user.name}}` |
| `completed_by_position` | `text` | |
| `completed_date` | `date` | `default_value = {{today}}` |

Template attributes: `name = "Reference Check"`, `model_type = EmploymentApplication::class`, `is_sendable = false`, `category = "Recruitment"` (or existing equivalent).

**`database/seeders/ModelTriggerFormSeeder.php`** (or wherever trigger mappings are seeded)

Add the Reference Check mapping:
- `model_type` = `EmploymentApplication::class`
- `trigger_key` = the reference-check status (TBD — confirm exact `STATUSES` constant; likely `checking_references` or similar)
- `form_template_id` = Reference Check template id
- `subject_source` = `references`
- `dispatch_mode` = `on_demand`
- `min_submissions` = `2`
- `assignee_strategy` = `permission`
- `assignee_value` = HR permission name (placeholder — confirm with team; existing pattern is kebab-case e.g. `whs-review`)

---

## Data migration: existing reference checks

A one-shot artisan command or migration that copies historical `employment_application_reference_checks` rows into `form_requests`:

```
for each existing reference check row:
    create FormRequest:
        form_template_id = Reference Check template
        formable = the EmploymentApplication
        subject = the EmploymentApplicationReference
        status = 'submitted'
        submitted_at = original completed_at (or completed_date)
        responses = JSON keyed by new template field IDs
        response_snapshot = built fresh using FormService::buildResponseSnapshot logic
        sent_by = original completed_by user
```

Mapping the 46 columns to template field IDs requires a fixed lookup table written alongside the seeder. Run the backfill after the seeder so template field IDs are known.

The old table is retained (not dropped) for audit until the migration is verified in production. A follow-up migration drops it once stable.

---

## Route cleanup

- Old `ReferenceCheckController` routes at [routes/web.php:350-352](routes/web.php#L350-L352) are kept temporarily as 301-redirect routes that resolve to the new FormRequest view (find the FormRequest by application + reference + Reference Check template).
- React page [resources/js/pages/employment-applications/reference-check.tsx](resources/js/pages/employment-applications/reference-check.tsx) is deleted once the new flow is verified.
- `ReferenceCheckController` deleted after the redirect period.

---

## Phased delivery

Six small, independently mergeable steps.

### Phase 1 — Schema + model plumbing (~1 day)
- Migrations: `subject` morph on `form_requests`, `subject_source` / `dispatch_mode` / `min_submissions` on `model_trigger_forms`
- Model updates: `FormRequest::subject()`, `ModelTriggerForm` fillable + cast
- `FormService::createAndSend()` accepts `$subject`; cancel-pending query scoped by subject
- Tests: existing test suite still passes (no behavior change for null subject)

### Phase 2 — Trigger dispatcher updates (~1 day)
- `ModelTriggerFormService::dispatchFormsFor()` filters by `dispatch_mode = auto`
- New `availableOnDemandForms()` + `startOnDemand()` + `cancelPendingForTrigger()`
- `blockersForLeaving()` uses `min_submissions`
- Unit tests for fan-out, idempotency-by-subject, skip-and-restart

### Phase 3 — Admin UI for trigger config (~1 day)
- `ModelTriggerFormController` accepts and validates the three new fields
- `subjectSourcesByModel()` registry
- React UI: subject / dispatch mode / min submissions fields and listing column

### Phase 4 — Template + placeholders + seed (~1 day)
- Reference-scoped tokens in `FormPlaceholderResolver`
- `ReferenceCheckFormTemplateSeeder` builds the template
- `ModelTriggerFormSeeder` registers the mapping
- Manual smoke test in admin UI: edit template, see placeholders resolve

### Phase 5 — Application page UI (~1 day)
- `EmploymentApplicationController::show()` builds `referencesWithForms`
- New routes for start / skip
- React UI: per-reference status pill + action button on the application show page
- Status-change handler calls `cancelPendingForTrigger`

### Phase 6 — Backfill + cleanup (~1 day)
- Backfill command for historical reference checks
- Redirect routes for old URLs
- Delete the old React page and controller (after a quiet period — recommend 1 release cycle)
- Drop the `employment_application_reference_checks` table in a follow-up migration

**Total: 5-7 days for one engineer.**

---

## Open questions to confirm before starting

1. **Trigger status name** — exact key in `EmploymentApplication::STATUSES` that represents the reference-check stage. Need this for the trigger mapping seed.
2. **HR permission name** — which existing permission (or new one) gates "can fill reference checks." Existing examples in the codebase: `whs-review`, `whs`, `approve`.
3. **Minimum reference checks required** — confirm `2` is the right default for `min_submissions`, or if it should be configurable per application type.
4. **Historical data fate** — once backfilled, are admins okay seeing past reference checks rendered via the generic form renderer, or do they expect the legacy layout? (Generic renderer matches the new submitted-form view, so consistency is a plus.)
5. **Audit / immutability** — the existing form snapshot pattern freezes the form at submission time. Confirm that's acceptable for compliance — past reference checks should not change appearance when the template is later edited.

---

## What we explicitly chose NOT to do

- **`formable = Reference`** with traits proxied to Application. Rejected because the polymorphic relation `$reference->formRequests` reads as "forms the reference fills out" — a semantic tripwire for future readers.
- **Auto fan-out at trigger time.** Rejected because HR typically calls 2 of 4 references; the other 2 forms would rot in `pending` forever.
- **`reference_id` stored in `responses` JSON.** Rejected because JSON-path queries are less efficient and the link is brittle (depends on which template field holds the value).
- **Email-the-referee flow.** Out of scope per product decision — reference checks are always filled by office staff during a phone call.
