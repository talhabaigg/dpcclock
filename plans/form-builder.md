# Form Builder Plan

Forward-looking plan for the form-template system. Captures the audit performed 2026-05-18 and the staged implementation strategy for the next round of features. Conditional logic is the immediate priority.

---

## Current state (audit, 2026-05-18)

### Architecture

- **Models:** `FormTemplate` → hasMany `FormField`; `FormRequest` records each send (recipient, status, JSON `responses` keyed by field id).
- **Builder:** [resources/js/pages/form-templates/form.tsx](../resources/js/pages/form-templates/form.tsx) — React/Inertia, dnd-kit drag-reorder, live preview, placeholder token picker.
- **Filler (end user):** [resources/views/forms/fill.blade.php](../resources/views/forms/fill.blade.php) — **server-rendered Blade** with minimal JS in [resources/js/form-fill.ts](../resources/js/form-fill.ts) (just required-checkbox check + submit-disable).
- **Validation:** server-side only, in `FormRequestController` ~lines 235–273. Client side is HTML5 `required` + one custom check.
- **Placeholder tokens:** `FormPlaceholderResolver` interpolates `{{token}}` in label / default_value / placeholder. 5 globals + per-model tokens via `ProvidesFormPlaceholders` interface.
- **Export/import:** JSON download/upload added 2026-05-18 (see `FormTemplateController::export/import`, routes `form-templates.export` / `form-templates.import`).

### `form_fields` columns today

`id`, `form_template_id`, `label`, `type`, `sort_order`, `is_required`, `options` (JSON array), `placeholder`, `help_text`, `default_value`. Nothing else.

### Field types supported (11)

`text`, `textarea`, `number`, `email`, `phone`, `date`, `select`, `radio`, `checkbox`, `heading` (display), `paragraph` (display).

### What works well

- Drag-reorder, duplicate-field, options for select/radio/checkbox, required toggle, placeholder tokens in label/default/placeholder, live preview, JSON export/import.

### Confirmed gaps (no storage, no UI, no enforcement)

- Conditional show/hide between fields
- Validation rules (min/max length, regex pattern, number min/max)
- File upload field
- Signature field
- Page breaks / multi-step
- Rating / scale
- Repeatable groups
- Computed / readonly fields
- Multi-stage approval workflow (one `FormRequest` = one filler, no chain)
- Draft save / autosave
- Per-field response metadata (timestamp, edit history)
- Real-time client-side validation beyond HTML5 `required`
- Template-level "duplicate template" action

---

## Priority 1 — Conditional logic (next to build)

### Scope (v1)

Keep the first version deliberately small. Cover ~95% of real-world sign-off use cases without exploding into a rules engine.

- **One rule per dependent field.** No AND/OR groups in v1.
- **Source field constrained to `radio`, `select`, `checkbox`.** Their values are bounded and matchable. Text/number sources come later.
- **Operators:** `equals`, `not_equals`, `empty`, `not_empty`. (`contains` later if needed.)
- **Reference earlier fields only.** Sort-order of the dependent must be greater than the source's. Prevents cycles trivially.

### Schema

Add one column to `form_fields`:

```sql
ALTER TABLE form_fields ADD COLUMN visible_if JSON NULL;
```

Shape:

```json
{
  "field_id": 123,
  "operator": "equals",
  "value": "Yes"
}
```

`null` means always visible (the default). Model: add `visible_if` to `$fillable` and cast as `array`.

### Backend changes

**Migration:** `database/migrations/*_add_visible_if_to_form_fields.php` — add nullable JSON column.

**`FormTemplateController` (`store`, `update`, `import`):**
- Add to validation:
  ```php
  'fields.*.visible_if'              => 'nullable|array',
  'fields.*.visible_if.field_id'     => 'required_with:fields.*.visible_if|integer',
  'fields.*.visible_if.operator'     => 'required_with:fields.*.visible_if|in:equals,not_equals,empty,not_empty',
  'fields.*.visible_if.value'        => 'nullable|string|max:255',
  ```
- Persist `visible_if` in the create / update loop alongside other field attributes.
- **Cycle / order check:** after validation, walk each field's `visible_if.field_id` and reject if it points to a field at a later `sort_order` (or to itself, or to a non-existent index). Use a new `validateVisibilityRules()` private method, mirror the existing `validatePlaceholderTokens` pattern.
- Strip `visible_if.field_id` references that point to **client-side** field ids on the initial create path — easier to use the sort-order index as the reference on the wire (`visible_if.source_index`) and resolve to DB id on the server, since new fields don't have ids yet. Pick one approach and document it in the controller.

**`FormTemplateController::export`:**
- Include `visible_if` in the exported field payload — but emit the source as `source_index` (zero-based sort order) instead of a hard DB id, so imports across instances work.

**`FormTemplateController::import`:**
- Read `visible_if.source_index`, resolve to the newly-created field's id after all fields are inserted (two-pass: insert all, then patch `visible_if`).

**`FormRequestController` submission validation (~lines 235–273):**
- Before applying `required`, evaluate visibility for each field against already-collected response values. A hidden field is **not required and its submitted value (if any) is discarded** — do not trust the client to strip it.
- Add a helper `App\Services\FormVisibilityEvaluator` that takes a field, the responses-so-far map, and returns bool. Pure function, easy to unit test.
- Order matters: evaluate fields in `sort_order` so dependencies are resolved before dependents. Since v1 requires source to come before dependent, single pass works.

### Builder UI changes (`form.tsx`)

Add a collapsible "Show this field when…" section inside each field's editor:

- **Source field picker** — `<Select>` listing all earlier fields with type `radio | select | checkbox`. Disabled if there are none. Label format: `Q{n}. {label}`.
- **Operator picker** — `<Select>` with `equals` / `not equals` / `is empty` / `is not empty`.
- **Value picker** — depends on source type:
  - `radio` / `select`: `<Select>` populated from the source's `options`.
  - `checkbox`: same as above (rule means *this option is checked*).
  - Hidden when operator is `empty` / `not_empty`.
- **Clear rule** button that resets `visible_if` to `null`.

A small inline badge ("⚡ Conditional") on each field card with a rule, so the rule is visible without expanding.

In the **live preview**, evaluate `visible_if` against an internal answer state and hide fields accordingly. This is the simplest way for the builder to dogfood the rule and surface mistakes early.

### Filler changes — the hard part

Two paths considered; **picking augment-blade for v1**.

**Path A (chosen) — augment the Blade filler:**

- Emit each field wrapper with `data-field-id="{{ $field->id }}"` and, when applicable, `data-visible-if='{"field_id":..,"operator":"..","value":".."}'`.
- Expand `resources/js/form-fill.ts`:
  1. On load, find all `[data-visible-if]` wrappers and index them by source `field_id`.
  2. On `change` / `input` of any source input, re-evaluate every dependent and toggle the wrapper's `hidden` attribute.
  3. When hiding: clear values inside (text inputs, radios, checkboxes, selects). When showing again: leave blank (don't restore stale).
  4. On submit, ensure the browser's HTML5 `required` doesn't fire on hidden fields — the `hidden` attribute should already suppress validation, but verify with a small unit-test page.
- Evaluator must match the server's `FormVisibilityEvaluator` semantics 1:1 (same operators, same empty-string handling, same checkbox-array semantics). Mirror the logic and add a comment in both places pointing at the other.

**Path B (not v1) — port filler to React/Inertia:** ~3 days vs ~1 day. Defer.

### Cost

- Migration + model: 0.5h
- Backend validation + persistence + cycle check: 2h
- `FormVisibilityEvaluator` + integration into submission: 2h
- Builder UI: 4h
- Filler JS evaluator + Blade wrapper attributes: 4h
- Builder preview: 1h
- Export/import support: 1h
- Testing (unit on evaluator, manual on filler with radio + checkbox + select sources): 2h

**Total: ~1.5 days.**

### Risks / things to watch

- **Cycle prevention** is trivial in v1 because sort-order is enforced, but the moment we allow AND/OR or backward references, we need a proper DAG check. Note in the rule UI: "rules can only reference earlier fields."
- **Hidden field state on submit.** The browser still submits `name=field_123` for `hidden` form fields. The server discards them — do **not** rely on the client.
- **Checkbox-group source semantics.** A checkbox-group stores `["A","B"]`. `equals: "A"` should mean "A is one of the selected values," not "the array equals the string A". Decide and document. Recommendation: `equals` = membership, `not_equals` = non-membership.
- **Empty string vs null vs undefined.** Define `empty` as: source value is `null`, `""`, `[]`, or absent from responses. Same definition on client and server.
- **Required + hidden interaction.** A field marked required but currently hidden must pass validation (treat as not required). Document this explicitly so it doesn't surprise the user.

### Out of scope for v1 (document & defer)

- AND/OR rule groups
- Text/number value comparison (`>`, `<`, `contains`, regex)
- Cross-field calculations or computed defaults that update reactively
- Conditional `required` (separate from conditional `visible`)
- Showing/hiding heading/paragraph display blocks (works automatically since they're rendered the same way — confirm with a test)

---

## Priority backlog (after conditional logic lands)

Ordered by impact-per-effort for the construction / employment / sign-off use case driving the system today.

### 2. Signature field (~1 day)

- New field type `signature`. Add to migration + `FormField::type` enum + builder UI.
- Builder: no extra config beyond label/required.
- Filler: render an HTML canvas-based signature pad (vanilla JS, no library if possible; otherwise `signature_pad` npm package — 6kb gzipped).
- Storage: base64 PNG into the `responses` JSON, OR upload to `storage/forms/{request_id}/signature.png` and store the path. Path is cleaner; pick that.
- Sign-off forms (Safety Manager, Construction Manager) all naturally end in a signature — currently faked as Yes/No radios.

### 3. Validation rules (~0.5 day)

- New JSON column `validation` on `form_fields`. Shape:
  ```json
  { "min_length": 3, "max_length": 200, "pattern": "^\\d{4}$", "min": 0, "max": 100 }
  ```
- Builder: a "Validation" sub-section in the field editor, fields rendered per type (min/max length for text/textarea, min/max value for number, pattern with help text).
- Filler: render as HTML5 `minlength` / `maxlength` / `pattern` / `min` / `max` attributes (free real-time validation).
- Backend: build the Laravel rule string dynamically per field in `FormRequestController` submission validation.

### 4. File upload (~1 day)

- New field type `file`. Per-field config: allowed mime types (comma-separated), max size MB.
- Storage: `storage/forms/{form_request_id}/{field_id}/{uuid}-{filename}`.
- Responses JSON stores `{ path, original_name, size, mime }`.
- Filler: `<input type="file">`. Plus a small JS preview for images.
- Show uploaded files in the submission view (already exists? check `FormRequestController::show`).

### 5. Page breaks / multi-step (~1 day)

- New field type `page_break`. Splits the filler into pages.
- Filler: step indicator at top, "Next" / "Back" buttons; validate the current page before allowing Next.
- Builder: visible as a horizontal divider in the field list.
- Submit only on the final page. Persist progress in `sessionStorage` keyed by form-request token so a refresh mid-form doesn't lose work.

### 6. Template duplication (~30 min)

- Mirror `DocumentTemplateController::duplicate` (controller already has the pattern at lines 97–107) for form templates.
- Add a "Duplicate" row action in the form-templates index Burger Menu.

### 7. Rating field (~0.5 day)

- New field type `rating` with `max` option (1–5 or 1–10).
- Filler: row of clickable stars/numbers.
- Useful for reference-check forms.

### 8. Conditional logic v2 (~2 days)

- AND/OR groups, allow text/number sources with `>` / `<` / `contains` / `matches regex`.
- Conditional `required` (separate from `visible_if` — `required_if`).
- Bring forward only after v1 has been in production for a few weeks and we have real-world rule patterns to point at.

### Lower priority / larger lifts

- Repeatable groups (~3 days) — schema change, response shape change, UI complexity. Defer unless a strong use case appears.
- Computed / readonly fields with an expression DSL — costly, narrow benefit.
- Multi-stage approval workflows (Construction Manager → WHS → Safety Manager chain) — a bigger product feature, not just a builder feature. Worth a separate plan.
- Draft save / autosave — useful for long forms but tied to the multi-step work.

---

## Open questions to resolve before starting

1. **Field-id vs sort-index on the wire.** The current builder treats new fields as having no id until saved. For `visible_if.field_id` to be usable in the UI, we either use sort-index on the wire and resolve to DB id server-side, or assign temporary client UUIDs and resolve at save time. **Recommendation: sort-index on the wire** — simpler, matches what the export/import already does conceptually.
2. **Filler runtime.** Sticking with Blade for v1. If we end up rebuilding for multi-step / file upload too, evaluate whether a React port pays for itself. Set a check-in after v1 ships.
3. **Visibility semantics for `checkbox` source.** `equals: "A"` = "A is among the checked options". Lock this in the spec.
4. **Empty definition.** `null | "" | []` all count as empty. Lock this in the spec.

---

## Test plan for conditional logic v1

- Unit test `FormVisibilityEvaluator` against a matrix of (source value, operator, target value) inputs.
- Unit test the cycle / order check in `FormTemplateController`.
- Manual filler test: radio source toggling a textarea; select source toggling a date; checkbox source toggling a section heading + paragraph + question.
- Manual server test: submit with a required-but-hidden field empty → passes. Submit with a non-required-but-visible field populated → passes. Submit with a hidden field populated → server discards the value.
- Manual export/import round-trip on a template with rules → rules survive the trip with source references intact.
