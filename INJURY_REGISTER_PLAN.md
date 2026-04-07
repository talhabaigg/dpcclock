# Injury Register — Implementation Plan for DPCClock

> **Context:** Recreating the Injury Register module from `app.superiorgroup.com.au` within the DPCClock Laravel 12 + Inertia.js + React 19 + TypeScript stack.

---

## Phase 1: Database — Migrations & Models

### Step 1.1: Create the main `injury_registers` migration

Run: `php artisan make:migration create_injury_registers_table`

**Table schema:**

```php
Schema::create('injury_registers', function (Blueprint $table) {
    $table->id();
    $table->string('id_formal')->unique();                    // Auto-generated: INJ-0001
    $table->foreignId('location_id')->nullable()->constrained()->nullOnDelete(); // "Project" equivalent
    $table->foreignId('employee_id')->nullable()->constrained()->nullOnDelete(); // "Worker"
    $table->string('employee_address')->nullable();           // Worker's home address
    $table->string('incident');                               // Enum string: new_injury, aggravated_injury, etc.
    $table->string('incident_other')->nullable();             // Free text if incident = "other"
    $table->dateTime('occurred_at')->nullable();              // Date & time of occurrence
    $table->string('reported_by')->nullable();                // Person who reported (text)
    $table->dateTime('reported_at')->nullable();              // Date & time reported
    $table->string('reported_to')->nullable();                // Person reported to
    $table->string('location_of_incident')->nullable();       // Specific location text
    $table->text('description')->nullable();                  // Detailed description of what occurred
    $table->boolean('emergency_services')->default(false);    // Were emergency services called?
    $table->boolean('work_cover_claim')->default(false);      // WorkCover claim?
    $table->boolean('treatment')->default(false);             // Was treatment provided?
    $table->dateTime('treatment_at')->nullable();             // Treatment date/time
    $table->string('treatment_provider')->nullable();         // Who provided treatment
    $table->string('treatment_external')->nullable();         // Enum: first_aid, medical_centre, hospital, other
    $table->string('treatment_external_location')->nullable();// External treatment location
    $table->text('no_treatment_reason')->nullable();          // Why no treatment
    $table->boolean('follow_up')->nullable();                 // Follow up required?
    $table->text('follow_up_notes')->nullable();              // Follow up details
    $table->integer('work_days_missed')->default(0);          // Number of days lost
    $table->string('report_type')->nullable();                // Enum: report, first_aid, mti, lti
    $table->boolean('witnesses')->default(false);             // Were there witnesses?
    $table->text('witness_details')->nullable();              // Witness info
    $table->text('worker_signature')->nullable();             // Base64 signature data
    $table->text('representative_signature')->nullable();     // Base64 signature data
    $table->foreignId('representative_id')->nullable()->constrained('employees')->nullOnDelete();
    $table->string('body_location_image')->nullable();        // Path to body location drawing
    $table->dateTime('locked_at')->nullable();                // Record lock timestamp
    $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
    $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamps();

    $table->index(['location_id', 'occurred_at']);
    $table->index('incident');
    $table->index('report_type');
});
```

### Step 1.2: Create child tables for multi-select fields

Run: `php artisan make:migration create_injury_register_natures_table`

```php
// injury_register_natures — Nature of injury/illness (multi-select)
Schema::create('injury_register_natures', function (Blueprint $table) {
    $table->id();
    $table->foreignId('injury_register_id')->constrained()->onDelete('cascade');
    $table->string('nature');          // Enum key: abrasion, cut, laceration, etc.
    $table->text('comments')->nullable();
    $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamps();
});
```

Run: `php artisan make:migration create_injury_register_mechanisms_table`

```php
// injury_register_mechanisms — Mechanism of injury (multi-select)
Schema::create('injury_register_mechanisms', function (Blueprint $table) {
    $table->id();
    $table->foreignId('injury_register_id')->constrained()->onDelete('cascade');
    $table->string('mechanism');       // Enum key: slip, fall_from_height, lifting, etc.
    $table->text('comments')->nullable();
    $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamps();
});
```

Run: `php artisan make:migration create_injury_register_agencies_table`

```php
// injury_register_agencies — Agency of incident (multi-select)
Schema::create('injury_register_agencies', function (Blueprint $table) {
    $table->id();
    $table->foreignId('injury_register_id')->constrained()->onDelete('cascade');
    $table->string('agency');          // Enum key: tools_powered, materials, vehicle, etc.
    $table->text('comments')->nullable();
    $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamps();
});
```

Run: `php artisan make:migration create_injury_register_contributions_table`

```php
// injury_register_contributions — Contributing factors (multi-select)
Schema::create('injury_register_contributions', function (Blueprint $table) {
    $table->id();
    $table->foreignId('injury_register_id')->constrained()->onDelete('cascade');
    $table->string('contribution');    // Enum key: drugs_or_alcohol, equipment_defects, etc.
    $table->text('comments')->nullable();
    $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamps();
});
```

Run: `php artisan make:migration create_injury_register_corrective_actions_table`

```php
// injury_register_corrective_actions — Corrective actions taken (multi-select)
Schema::create('injury_register_corrective_actions', function (Blueprint $table) {
    $table->id();
    $table->foreignId('injury_register_id')->constrained()->onDelete('cascade');
    $table->string('action');          // Enum key: swms_review, amend_swms, toolbox_talk, etc.
    $table->text('comments')->nullable();
    $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamps();
});
```

Run: `php artisan make:migration create_injury_register_files_table`

```php
// injury_register_files — Attached files/photos
Schema::create('injury_register_files', function (Blueprint $table) {
    $table->id();
    $table->foreignId('injury_register_id')->constrained()->onDelete('cascade');
    $table->string('file_path');
    $table->string('file_name');
    $table->string('mime_type')->nullable();
    $table->integer('file_size')->nullable();
    $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamps();
});
```

### Step 1.3: Create Eloquent Models

Run: `php artisan make:model InjuryRegister`

**File:** `app/Models/InjuryRegister.php`

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InjuryRegister extends Model
{
    protected $fillable = [
        'id_formal', 'location_id', 'employee_id', 'employee_address',
        'incident', 'incident_other', 'occurred_at', 'reported_by',
        'reported_at', 'reported_to', 'location_of_incident', 'description',
        'emergency_services', 'work_cover_claim', 'treatment', 'treatment_at',
        'treatment_provider', 'treatment_external', 'treatment_external_location',
        'no_treatment_reason', 'follow_up', 'follow_up_notes', 'work_days_missed',
        'report_type', 'witnesses', 'witness_details', 'worker_signature',
        'representative_signature', 'representative_id', 'body_location_image',
        'locked_at', 'created_by', 'updated_by',
    ];

    protected $casts = [
        'occurred_at' => 'datetime',
        'reported_at' => 'datetime',
        'treatment_at' => 'datetime',
        'locked_at' => 'datetime',
        'emergency_services' => 'boolean',
        'work_cover_claim' => 'boolean',
        'treatment' => 'boolean',
        'follow_up' => 'boolean',
        'witnesses' => 'boolean',
        'work_days_missed' => 'integer',
    ];

    protected $appends = ['incident_label', 'report_type_label'];

    // --- Enum option constants ---

    public const INCIDENT_OPTIONS = [
        'aggravated_injury' => 'Aggravated injury',
        'fire' => 'Fire',
        'illness' => 'Illness',
        'near_miss' => 'Near miss',
        'non_work_related' => 'Non-work-related injury / illness',
        'new_injury' => 'New injury',
        'new_injury_on_break' => 'New injury – During a designated break whilst at work',
        'new_injury_going_to_work' => 'New injury – On the way to / from work',
        'property_damage' => 'Property damage',
        'reoccurring_injury' => 'Reoccurring injury',
        'theft' => 'Theft',
        'other' => 'Other',
    ];

    public const REPORT_TYPE_OPTIONS = [
        'report' => 'Report only',
        'first_aid' => 'First aid only',
        'mti' => 'MTI',
        'lti' => 'LTI',
    ];

    public const TREATMENT_EXTERNAL_OPTIONS = [
        'first_aid' => 'First aid only',
        'medical_centre' => 'Medical centre',
        'hospital' => 'Hospital',
        'other' => 'Other',
    ];

    public const NATURE_OPTIONS = [
        'abrasion' => 'Abrasion', 'cut' => 'Cut or open wound', 'laceration' => 'Laceration',
        'puncture_wound' => 'Puncture wound', 'sprain' => 'Sprain / strain', 'dislocation' => 'Dislocation',
        'fracture' => 'Fracture / break', 'bruising' => 'Bruising / swelling', 'heart' => 'Heart / circulatory',
        'loss_of_consciousness' => 'Loss of consciousness / fainting', 'inhalation' => 'Inhalation',
        'internal_injury' => 'Internal injury', 'infectious_disease' => 'Infectious disease',
        'psychological_disorder' => 'Psychological disorder', 'foreign_body' => 'Foreign body',
        'needle_stick' => 'Needle stick', 'amputation' => 'Amputation', 'electric_shock' => 'Electric shock',
        'traumatic_shock' => 'Traumatic shock', 'respiratory' => 'Respiratory', 'poisoning' => 'Poisoning',
        'exposure' => 'Exposure', 'allergy' => 'Allergy', 'nervous_system' => 'Nervous system injury',
        'skin_disorder' => 'Skin disorder', 'insect_bite' => 'Insect sting / bite',
        'burn' => 'Burn / scald', 'hearing_loss' => 'Hearing loss', 'other' => 'Other',
    ];

    public const MECHANISM_OPTIONS = [
        'slip' => 'Slip / trip / fall', 'plant_damage' => 'Property / plant damage',
        'flying_material' => 'Flying material', 'mental_stress' => 'Mental stress',
        'fall_from_height' => 'Fall from height', 'lifting' => 'Lifting / bending / twisting',
        'foreign_object' => 'Foreign object', 'harassment' => 'Harassment',
        'caught_by' => 'Caught by / against', 'sharp_object' => 'Contact with sharp object',
        'body_stressing' => 'Body stressing', 'biological_agent' => 'Biological agent',
        'struck_by' => 'Struck by / against', 'chemicals' => 'Chemical or substances',
        'pushing_pulling' => 'Pushing / pulling', 'environmental' => 'Environmental',
        'noise_vibration' => 'Noise / vibration', 'occupational_overuse' => 'Occupational overuse',
        'electricity' => 'Electricity', 'heat_cold_fire' => 'Heat / cold / fire', 'other' => 'Other',
    ];

    public const AGENCY_OPTIONS = [
        'tools_powered' => 'Tools (powered)', 'materials' => 'Materials (list)',
        'animal' => 'Animal / insect', 'vehicle' => 'Vehicle / transport',
        'tools_non_powered' => 'Tools (non-powered)', 'buildings' => 'Buildings / structures',
        'biological_agent' => 'Biological agent', 'another_person' => 'Another person',
        'mobile_plant' => 'Mobile plant', 'equipment' => 'Equipment (other than tools)',
        'environment' => 'Environment', 'chemicals' => 'Chemicals / substance', 'other' => 'Other',
    ];

    public const CONTRIBUTION_OPTIONS = [
        'drugs_or_alcohol' => 'Drugs or alcohol', 'equipment_defects' => 'Equipment defects',
        'improper_use_of_equipment' => 'Improper use of equipment', 'inappropriate_ppe' => 'Inappropriate PPE',
        'incorrect_manual_handling' => 'Incorrect manual handling', 'lack_of_ppe' => 'Lack of PPE',
        'lack_of_protective_devices' => 'Lack of protective devices (guarding, handles etc.)',
        'lack_of_supervision' => 'Lack of supervision', 'lack_of_training' => 'Lack of training',
        'poor_housekeeping' => 'Poor housekeeping', 'safety_procedures_not_followed' => 'Safety procedures not followed',
        'unauthorised_equipment_use' => 'Unauthorised equipment use', 'other' => 'Other',
    ];

    public const CORRECTIVE_ACTION_OPTIONS = [
        'swms_review' => 'SWMS Review with individual / workgroup',
        'amend_swms' => 'Amend SWMS (controls relating to the incident / injury to be reviewed and amended)',
        'toolbox_talk' => 'Toolbox Talk (workgroup) regarding corrective actions taken to prevent reoccurrence',
        'issue_non_conformance' => 'Issue non-conformance where company policies / procedures have not been followed (i.e. not wearing required PPE)',
        'other' => 'Other',
    ];

    // --- Accessors ---

    public function getIncidentLabelAttribute(): ?string
    {
        return self::INCIDENT_OPTIONS[$this->incident] ?? $this->incident;
    }

    public function getReportTypeLabelAttribute(): ?string
    {
        return self::REPORT_TYPE_OPTIONS[$this->report_type] ?? $this->report_type;
    }

    // --- Relationships ---

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function representative(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'representative_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function natures(): HasMany
    {
        return $this->hasMany(InjuryRegisterNature::class);
    }

    public function mechanisms(): HasMany
    {
        return $this->hasMany(InjuryRegisterMechanism::class);
    }

    public function agencies(): HasMany
    {
        return $this->hasMany(InjuryRegisterAgency::class);
    }

    public function contributions(): HasMany
    {
        return $this->hasMany(InjuryRegisterContribution::class);
    }

    public function correctiveActions(): HasMany
    {
        return $this->hasMany(InjuryRegisterCorrectiveAction::class);
    }

    public function files(): HasMany
    {
        return $this->hasMany(InjuryRegisterFile::class);
    }

    // --- Helpers ---

    public static function generateFormalId(): string
    {
        $last = static::max('id') ?? 0;
        return 'INJ-' . str_pad($last + 1, 4, '0', STR_PAD_LEFT);
    }

    public function isLocked(): bool
    {
        return $this->locked_at !== null;
    }
}
```

Also create simple child models (one for each child table): `InjuryRegisterNature`, `InjuryRegisterMechanism`, `InjuryRegisterAgency`, `InjuryRegisterContribution`, `InjuryRegisterCorrectiveAction`, `InjuryRegisterFile`. Each should `belongsTo(InjuryRegister::class)`.

---

## Phase 2: Backend — Routes, Controller, Form Request

### Step 2.1: Add permissions via migration

Run: `php artisan make:migration add_injury_register_permissions`

```php
// Insert into Spatie permissions table
$permissions = [
    'injury-register.view',
    'injury-register.create',
    'injury-register.edit',
    'injury-register.delete',
    'injury-register.lock',
    'injury-register.export',
];
```

### Step 2.2: Create Form Request

**File:** `app/Http/Requests/StoreInjuryRegisterRequest.php`

Validate all fields: `incident` (required, in enum), `employee_id` (required, exists), `location_id` (required, exists), `occurred_at` (required, date), `report_type` (nullable, in enum), multi-select arrays (array of valid enum keys), `worker_signature` (nullable, string for base64), file uploads (nullable, array of files, each max 10MB, image/pdf mimetypes).

### Step 2.3: Create Controller

**File:** `app/Http/Controllers/InjuryRegisterController.php`

Methods:
- `index()` — Paginate injury registers with filters (location, employee, incident type, report type, workcover claim, active/locked). Eager load `employee`, `location`, `natures`, `mechanisms`, `agencies`, `contributions`, `correctiveActions`. Return via `Inertia::render('injury-register/index', [...])`.
- `create()` — Return create form with option arrays and employee/location lists. `Inertia::render('injury-register/create', [...])`.
- `store(StoreInjuryRegisterRequest $request)` — Validate, generate `id_formal`, create main record, sync child records (natures, mechanisms, agencies, contributions, corrective actions), handle file uploads, redirect to index with success flash.
- `show(InjuryRegister $injuryRegister)` — Load with all relationships, return detail view.
- `edit(InjuryRegister $injuryRegister)` — Same as create but pre-populated. Guard against locked records.
- `update(UpdateInjuryRegisterRequest $request, InjuryRegister $injuryRegister)` — Similar to store but with sync (delete + re-create children). Guard against locked records.
- `destroy(InjuryRegister $injuryRegister)` — Soft delete or hard delete. Guard against locked records.
- `lock(InjuryRegister $injuryRegister)` — Set `locked_at = now()`.
- `unlock(InjuryRegister $injuryRegister)` — Set `locked_at = null`.
- `export(Request $request)` — Export filtered list to Excel/CSV using `maatwebsite/excel`.

### Step 2.4: Register Routes

**In `routes/web.php`**, add within the authenticated middleware group:

```php
// Injury Register
Route::middleware('permission:injury-register.view')->group(function () {
    Route::get('injury-register', [InjuryRegisterController::class, 'index'])->name('injury-register.index');
    Route::get('injury-register/{injuryRegister}', [InjuryRegisterController::class, 'show'])->name('injury-register.show');
});

Route::post('injury-register', [InjuryRegisterController::class, 'store'])->name('injury-register.store')
    ->middleware('permission:injury-register.create');
Route::get('injury-register/create', [InjuryRegisterController::class, 'create'])->name('injury-register.create')
    ->middleware('permission:injury-register.create');
Route::get('injury-register/{injuryRegister}/edit', [InjuryRegisterController::class, 'edit'])->name('injury-register.edit')
    ->middleware('permission:injury-register.edit');
Route::put('injury-register/{injuryRegister}', [InjuryRegisterController::class, 'update'])->name('injury-register.update')
    ->middleware('permission:injury-register.edit');
Route::delete('injury-register/{injuryRegister}', [InjuryRegisterController::class, 'destroy'])->name('injury-register.destroy')
    ->middleware('permission:injury-register.delete');
Route::post('injury-register/{injuryRegister}/lock', [InjuryRegisterController::class, 'lock'])->name('injury-register.lock')
    ->middleware('permission:injury-register.lock');
Route::post('injury-register/{injuryRegister}/unlock', [InjuryRegisterController::class, 'unlock'])->name('injury-register.unlock')
    ->middleware('permission:injury-register.lock');
Route::get('injury-register-export', [InjuryRegisterController::class, 'export'])->name('injury-register.export')
    ->middleware('permission:injury-register.export');
```

**IMPORTANT:** Place the `create` route BEFORE the `{injuryRegister}` show route to avoid route conflict.

---

## Phase 3: Frontend — React Pages & Components

### Step 3.1: TypeScript Types

**File:** `resources/js/types/injury-register.ts`

Define interfaces: `InjuryRegister`, `InjuryRegisterNature`, `InjuryRegisterMechanism`, `InjuryRegisterAgency`, `InjuryRegisterContribution`, `InjuryRegisterCorrectiveAction`, `InjuryRegisterFile`, plus option type `{value: string; label: string}[]` for each enum.

### Step 3.2: Index Page (List View)

**File:** `resources/js/pages/injury-register/index.tsx`

Features to implement:
- Filter bar with dropdowns: location, employee, incident type, report type, workcover claim, reported by, active/locked status
- Reset button to clear all filters
- Table columns: ID (formal), Occurred at, Worker (name + employment type), Project/Location, Incident type, Workcover claim (Yes/No), Days lost, Report type (badge)
- Row actions via three-dot menu: View, Edit, Lock/Unlock, Delete
- "Report incident / injury" primary button linking to create page
- Pagination component at bottom
- Use existing Shadcn `Table`, `Select`, `Button`, `DropdownMenu`, `Badge` components
- Use Inertia `router.get()` for filter changes (server-side filtering)

### Step 3.3: Create/Edit Form Page

**File:** `resources/js/pages/injury-register/create.tsx`
**File:** `resources/js/pages/injury-register/edit.tsx` (or reuse create with props)

This is a long single-page form with these sections:

1. **Type of incident** — Single select dropdown
2. **Worker and location** — Employee select, address text field, location/project select, location of incident text, date/time of occurrence, reported by, date/time reported, reported to
3. **Nature of injury/illness** — Multi-select checkboxes (25 options) + optional comments textarea
4. **Mechanism of injury** — Multi-select checkboxes (21 options) + optional comments textarea
5. **Agency of incident** — Multi-select checkboxes (13 options) + optional comments textarea
6. **Contributing factors** — Multi-select checkboxes (13 options) + optional comments textarea
7. **Corrective actions** — Multi-select checkboxes (5 options) + optional comments textarea
8. **File uploads** — Drag-and-drop zone for incident photos (use existing Dropzone pattern)
9. **Body location** — Canvas drawing component (optional — can use a body outline SVG with click-to-mark regions)
10. **Detailed description** — Rich text or textarea
11. **Treatment** — Emergency services (Yes/No), treatment provided (Yes/No), conditional fields for treatment details or no-treatment reason
12. **Witnesses** — Yes/No toggle, conditional witness details textarea
13. **Worker signature** — SignaturePad canvas (reuse existing `signature_pad` package pattern from `send-for-signing-modal.tsx`)
14. **SWC Representative sign-off** — Employee select + SignaturePad canvas
15. **Follow up** — Yes/No toggle + notes textarea
16. **Submit/Cancel buttons**

Use Inertia `useForm` hook for form state management. All multi-select sections should use a reusable `<MultiCheckboxSection>` component.

### Step 3.4: Show/Detail Page

**File:** `resources/js/pages/injury-register/show.tsx`

Read-only view of all submitted data with:
- All fields displayed in organized sections matching the form layout
- Signatures displayed as images
- Body location drawing displayed
- Attached files shown with download links
- Edit button (if not locked and has permission)
- Lock/Unlock button (if has permission)
- Print/Export to PDF button

### Step 3.5: Reusable Components to Build

1. **`MultiCheckboxSection.tsx`** — Renders a list of checkboxes from options array, manages selected values array, includes optional comments textarea. Used for natures, mechanisms, agencies, contributions, corrective actions.

2. **`SignatureCapture.tsx`** — Wrapper around `signature_pad` NPM package. Props: `value` (base64 string), `onChange`, `label`, `clearLabel`. Reuse pattern from existing `send-for-signing-modal.tsx`.

3. **`BodyLocationCanvas.tsx`** — SVG body outline with clickable regions or free-draw canvas for marking injury locations. Can be a Phase 2 enhancement — start with a simple file upload for body location image.

4. **`InjuryStatusBadge.tsx`** — Colored badge showing report type (Report only = gray, First aid = blue, MTI = orange, LTI = red).

---

## Phase 4: Navigation & Sidebar

### Step 4.1: Add to sidebar navigation

Find the sidebar/navigation component (likely in `resources/js/components/` or the layout file) and add an "Injury Register" link between existing safety/HR modules. Use a shield or medical icon from Tabler Icons.

Guard visibility with the `injury-register.view` permission.

---

## Phase 5: Optional Enhancements (Phase 2)

- **PDF export** — Generate a formatted PDF of the injury report using `barryvdh/laravel-dompdf` (already installed). Add a `generatePdf()` method to the controller.
- **Activity logging** — Use `spatie/laravel-activitylog` (already installed) to log all changes to injury records for audit trail.
- **Email notifications** — Send notification to safety managers when a new injury is reported. Use Laravel's notification system.
- **Dashboard widget** — Show recent injuries, counts by type, and trend chart on the main dashboard.
- **Excel export** — Use `maatwebsite/excel` (already installed) to export filtered list. Create `InjuryRegisterExport` class.
- **Body location canvas** — Full SVG body diagram with click-to-mark functionality.

---

## Execution Order (for Claude Code)

Run these commands and create files in this exact sequence:

```
1.  php artisan make:migration create_injury_registers_table
2.  php artisan make:migration create_injury_register_natures_table
3.  php artisan make:migration create_injury_register_mechanisms_table
4.  php artisan make:migration create_injury_register_agencies_table
5.  php artisan make:migration create_injury_register_contributions_table
6.  php artisan make:migration create_injury_register_corrective_actions_table
7.  php artisan make:migration create_injury_register_files_table
8.  php artisan make:migration add_injury_register_permissions
9.  Fill in all migration files with the schemas above
10. php artisan migrate
11. php artisan make:model InjuryRegister
12. php artisan make:model InjuryRegisterNature
13. php artisan make:model InjuryRegisterMechanism
14. php artisan make:model InjuryRegisterAgency
15. php artisan make:model InjuryRegisterContribution
16. php artisan make:model InjuryRegisterCorrectiveAction
17. php artisan make:model InjuryRegisterFile
18. Fill in all model files with relationships and constants
19. php artisan make:request StoreInjuryRegisterRequest
20. php artisan make:request UpdateInjuryRegisterRequest
21. Fill in validation rules
22. php artisan make:controller InjuryRegisterController
23. Fill in controller methods (index, create, store, show, edit, update, destroy, lock, unlock, export)
24. Add routes to routes/web.php
25. Create resources/js/types/injury-register.ts
26. Create resources/js/components/injury-register/MultiCheckboxSection.tsx
27. Create resources/js/components/injury-register/SignatureCapture.tsx
28. Create resources/js/components/injury-register/InjuryStatusBadge.tsx
29. Create resources/js/pages/injury-register/index.tsx
30. Create resources/js/pages/injury-register/create.tsx
31. Create resources/js/pages/injury-register/show.tsx
32. Create resources/js/pages/injury-register/edit.tsx
33. Add sidebar navigation link
34. npm run build (verify no TS errors)
35. Test in browser
```

---

## Key Patterns to Follow (from existing codebase)

| Concern | Follow this existing file |
|---------|--------------------------|
| Migration with FK | `2025_01_25_120000_create_location_pay_rate_templates_table.php` |
| Model with relationships | `app/Models/Employee.php` |
| Controller (Inertia) | `app/Http/Controllers/EmployeeController.php` |
| Form request validation | `app/Http/Requests/StoreEmploymentApplicationRequest.php` |
| List page (React) | `resources/js/pages/employees/index.tsx` |
| Form page (React) | `resources/js/pages/employment-applications/apply.tsx` |
| Signature pad usage | `resources/js/components/signing/send-for-signing-modal.tsx` |
| Routes pattern | `routes/web.php` (employee/location sections) |
| Permissions pattern | Existing `permission:` middleware usage |
