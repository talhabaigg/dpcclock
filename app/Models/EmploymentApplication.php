<?php

namespace App\Models;

use App\Models\Concerns\HasChecklists;
use App\Models\Concerns\HasComments;
use App\Models\Concerns\HasFormRequests;
use App\Models\Concerns\HasSigningRequests;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EmploymentApplication extends Model
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
}
