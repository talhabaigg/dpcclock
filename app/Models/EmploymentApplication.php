<?php

namespace App\Models;

use App\Contracts\ProvidesFormPlaceholders;
use App\Models\Concerns\HasChecklists;
use App\Models\Concerns\HasComments;
use App\Models\Concerns\HasFormRequests;
use App\Models\Concerns\HasSigningRequests;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\DB;
use Spatie\Activitylog\Models\Activity;

class EmploymentApplication extends Model implements ProvidesFormPlaceholders
{
    use HasChecklists, HasComments, HasFormRequests, HasSigningRequests;
    public const STATUS_NEW = 'new';
    public const STATUS_REVIEWING = 'reviewing';
    public const STATUS_PHONE_INTERVIEW = 'phone_interview';
    public const STATUS_REFERENCE_CHECK = 'reference_check';
    public const STATUS_FACE_TO_FACE = 'face_to_face';
    public const STATUS_WHS_REVIEW = 'whs_review';
    public const STATUS_FINAL_REVIEW = 'final_review';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_CONTRACT_SENT = 'contract_sent';
    public const STATUS_CONTRACT_SIGNED = 'contract_signed';
    public const STATUS_ONBOARDED = 'onboarded';
    public const STATUS_DECLINED = 'declined';

    public const STATUSES = [
        self::STATUS_NEW,
        self::STATUS_REVIEWING,
        self::STATUS_PHONE_INTERVIEW,
        self::STATUS_REFERENCE_CHECK,
        self::STATUS_FACE_TO_FACE,
        self::STATUS_WHS_REVIEW,
        self::STATUS_FINAL_REVIEW,
        self::STATUS_APPROVED,
        self::STATUS_CONTRACT_SENT,
        self::STATUS_CONTRACT_SIGNED,
        self::STATUS_ONBOARDED,
        self::STATUS_DECLINED,
    ];

    public const STATUS_LABELS = [
        self::STATUS_NEW              => 'New',
        self::STATUS_REVIEWING        => 'Reviewing',
        self::STATUS_PHONE_INTERVIEW  => 'Phone Interview',
        self::STATUS_REFERENCE_CHECK  => 'Reference Check',
        self::STATUS_FACE_TO_FACE     => 'Face to Face',
        self::STATUS_WHS_REVIEW       => 'WHS Review',
        self::STATUS_FINAL_REVIEW     => 'Final Review',
        self::STATUS_APPROVED         => 'Approved',
        self::STATUS_CONTRACT_SENT    => 'Contract Sent',
        self::STATUS_CONTRACT_SIGNED  => 'Contract Signed',
        self::STATUS_ONBOARDED        => 'Onboarded',
        self::STATUS_DECLINED         => 'Declined',
    ];

    protected $fillable = [
        'surname',
        'first_name',
        'suburb',
        'address',
        'state',
        'postcode',
        'email',
        'phone',
        'date_of_birth',
        'why_should_we_employ_you',
        'referred_by',
        'aboriginal_or_tsi',
        'occupation',
        'apprentice_year',
        'trade_qualified',
        'occupation_other',
        'preferred_project_site',
        'safety_induction_number',
        'ewp_below_11m',
        'ewp_above_11m',
        'forklift_licence_number',
        'work_safely_at_heights',
        'scaffold_licence_number',
        'first_aid_completion_date',
        'workplace_impairment_training',
        'wit_completion_date',
        'asbestos_awareness_training',
        'crystalline_silica_course',
        'gender_equity_training',
        'quantitative_fit_test',
        'workcover_claim',
        'medical_condition',
        'medical_condition_other',
        'acceptance_full_name',
        'acceptance_email',
        'acceptance_date',
        'declaration_accepted',
        'status',
        'declined_at',
        'declined_by',
        'declined_reason',
        'latitude',
        'longitude',
        'geocoded_at',
    ];

    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'aboriginal_or_tsi' => 'boolean',
            'trade_qualified' => 'boolean',
            'ewp_below_11m' => 'boolean',
            'ewp_above_11m' => 'boolean',
            'work_safely_at_heights' => 'boolean',
            'first_aid_completion_date' => 'date',
            'workplace_impairment_training' => 'boolean',
            'wit_completion_date' => 'date',
            'asbestos_awareness_training' => 'boolean',
            'crystalline_silica_course' => 'boolean',
            'gender_equity_training' => 'boolean',
            'workcover_claim' => 'boolean',
            'declaration_accepted' => 'boolean',
            'acceptance_date' => 'date',
            'declined_at' => 'datetime',
            'geocoded_at' => 'datetime',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
        ];
    }

    public function references(): HasMany
    {
        return $this->hasMany(EmploymentApplicationReference::class)->orderBy('sort_order');
    }

    public function screeningInterview(): HasOne
    {
        return $this->hasOne(EmploymentApplicationScreeningInterview::class);
    }

    public function skills(): HasMany
    {
        return $this->hasMany(EmploymentApplicationSkill::class);
    }

    public function declinedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'declined_by');
    }

    public function isDeclined(): bool
    {
        return $this->status === self::STATUS_DECLINED;
    }

    public function getFullNameAttribute(): string
    {
        return "{$this->first_name} {$this->surname}";
    }

    /**
     * Human-readable label used by form notifications and system comments so
     * recipients can see *which* applicant the form is about.
     */
    public function displayLabel(): string
    {
        $name = trim("{$this->first_name} {$this->surname}");

        return $name !== '' ? $name : "Application #{$this->id}";
    }

    /**
     * Deep link to this application's show page — included in form-request
     * emails so the recipient can review the applicant before signing off.
     */
    public function formContextUrl(): string
    {
        return route('employment-applications.show', $this->id);
    }

    /**
     * Find duplicate applications by email or phone.
     */
    public function scopeDuplicatesOf($query, string $email, ?string $phone = null)
    {
        return $query->where(function ($q) use ($email, $phone) {
            $q->where('email', $email);
            if ($phone) {
                $q->orWhere('phone', $phone);
            }
        });
    }

    public function employees(): BelongsToMany
    {
        return $this->belongsToMany(Employee::class, 'employment_application_employee')
            ->withPivot('eh_location_id', 'linked_at')
            ->withTimestamps();
    }

    /**
     * Find an Employee record (active or archived) that matches this applicant.
     * Matches on email, then mobile, then name+DOB — same precedence as
     * WorkerScreening::checkWorker(). Returns null when nothing matches.
     */
    public function findMatchingEmployee(): ?Employee
    {
        $email = $this->email ? strtolower($this->email) : null;
        $phoneDigits = $this->phone ? preg_replace('/\D+/', '', $this->phone) : null;
        $fullName = trim("{$this->first_name} {$this->surname}");
        $dob = $this->date_of_birth?->format('Y-m-d');

        if (! $email && ! $phoneDigits && (! $fullName || ! $dob)) {
            return null;
        }

        return Employee::withTrashed()
            ->where(function ($q) use ($email, $phoneDigits, $fullName, $dob) {
                if ($email) {
                    $q->orWhereRaw('LOWER(email) = ?', [$email]);
                }
                if ($phoneDigits) {
                    // Strip common separators on the column so '0400 000 000' matches '0400000000'.
                    // REGEXP_REPLACE isn't portable; chained REPLACE() works on MySQL + SQLite.
                    $q->orWhereRaw(
                        "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(mobile_number, ' ', ''), '-', ''), '(', ''), ')', ''), '+', '') = ?",
                        [$phoneDigits],
                    );
                }
                if ($fullName && $dob) {
                    $q->orWhere(function ($qq) use ($fullName, $dob) {
                        $qq->whereRaw('LOWER(name) = ?', [strtolower($fullName)])
                            ->where('date_of_birth', $dob);
                    });
                }
            })
            ->first();
    }

    /**
     * Wipe all workflow data attached to this application and re-attach the
     * current auto-attach checklist templates. Applicant-supplied data
     * (parent fields, references, skills, geocode) is preserved.
     */
    public function resetToFresh(): void
    {
        DB::transaction(function () {
            $this->wipeWorkflowData();

            $this->forceFill([
                'status' => self::STATUS_NEW,
                'declined_at' => null,
                'declined_by' => null,
                'declined_reason' => null,
            ])->save();

            $this->attachAutoChecklists();
        });
    }

    /**
     * Hard-delete every morph-linked or FK-only workflow row attached to this
     * application. Shared by resetToFresh() (which then re-attaches fresh
     * checklists) and the admin destroy action (which then deletes the parent
     * row, letting FK cascades clean up references/skills/screening/employee
     * pivot).
     */
    public function wipeWorkflowData(): void
    {
        $checklistIds = $this->checklists()->pluck('id');
        $itemIds = ChecklistItem::whereIn('checklist_id', $checklistIds)->pluck('id');

        Activity::where('subject_type', ChecklistItem::class)
            ->whereIn('subject_id', $itemIds)
            ->delete();

        $this->checklists()->delete();

        $this->comments()->withTrashed()->get()->each->forceDelete();

        $this->formRequests()->get()->each->delete();
        $this->signingRequests()->get()->each->delete();

        $this->screeningInterview()->delete();

        // Reference checks are FK-only (no Eloquent relation on this model)
        // and cascade only when the application itself is deleted — wipe
        // them explicitly so a reset clears completed referee responses.
        DB::table('employment_application_reference_checks')
            ->where('employment_application_id', $this->id)
            ->delete();

        $this->employees()->detach();
    }

    public function formPlaceholderValues(): array
    {
        return [
            'applicant.first_name' => $this->first_name,
            'applicant.last_name' => $this->surname,
            'applicant.full_name' => trim("{$this->first_name} {$this->surname}"),
            'applicant.email' => $this->email,
            'applicant.phone' => $this->phone,
            'applicant.suburb' => $this->suburb,
            'applicant.state' => $this->state,
            'applicant.occupation' => $this->occupation,
            'applicant.preferred_site' => $this->preferred_project_site,
            'application.id' => (string) $this->id,
            'application.status' => $this->status,
            'application.received_date' => $this->created_at?->format('j M Y'),
        ];
    }

    public static function formPlaceholderDefinitions(): array
    {
        return [
            'applicant.first_name' => 'Applicant first name',
            'applicant.last_name' => 'Applicant last name',
            'applicant.full_name' => 'Applicant full name',
            'applicant.email' => 'Applicant email',
            'applicant.phone' => 'Applicant phone',
            'applicant.suburb' => 'Applicant suburb',
            'applicant.state' => 'Applicant state',
            'applicant.occupation' => 'Applicant occupation',
            'applicant.preferred_site' => 'Preferred project site',
            'application.id' => 'Application ID',
            'application.status' => 'Application status',
            'application.received_date' => 'Application received date',
        ];
    }

    public static function formPlaceholderSamples(): array
    {
        return [
            'applicant.first_name' => 'Jane',
            'applicant.last_name' => 'Doe',
            'applicant.full_name' => 'Jane Doe',
            'applicant.email' => 'jane.doe@example.com',
            'applicant.phone' => '0400 000 000',
            'applicant.suburb' => 'Geelong',
            'applicant.state' => 'VIC',
            'applicant.occupation' => 'Carpenter',
            'applicant.preferred_site' => 'Site A',
            'application.id' => '42',
            'application.status' => 'whs_review',
            'application.received_date' => '1 May 2026',
        ];
    }
}
