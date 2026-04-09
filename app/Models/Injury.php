<?php

namespace App\Models;

use App\Models\Concerns\HasComments;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;

class Injury extends Model implements HasMedia
{
    use HasComments, InteractsWithMedia, LogsActivity;

    protected $fillable = [
        'id_formal', 'location_id', 'employee_id', 'employee_name', 'employee_address',
        'incident', 'incident_other', 'occurred_at', 'reported_by',
        'reported_at', 'reported_to', 'location_of_incident', 'description',
        'emergency_services', 'work_cover_claim',
        'claim_active', 'claim_type', 'claim_status', 'capacity', 'employment_status', 'claim_cost',
        'treatment', 'treatment_at',
        'treatment_provider', 'treatment_external', 'treatment_external_location',
        'no_treatment_reason', 'follow_up', 'follow_up_notes',
        'work_days_missed', 'days_suitable_duties', 'suitable_duties_from', 'suitable_duties_to', 'medical_expenses',
        'report_type', 'witnesses', 'witness_details',
        'natures', 'natures_comments',
        'mechanisms', 'mechanisms_comments',
        'agencies', 'agencies_comments',
        'contributions', 'contributions_comments',
        'corrective_actions', 'corrective_actions_comments',
        'worker_signature', 'representative_signature', 'representative_id',
        'body_location_image', 'locked_at', 'created_by', 'updated_by',
    ];

    protected $casts = [
        'occurred_at' => 'datetime:Y-m-d\TH:i:s',
        'reported_at' => 'datetime:Y-m-d\TH:i:s',
        'treatment_at' => 'datetime:Y-m-d\TH:i:s',
        'locked_at' => 'datetime:Y-m-d\TH:i:s',
        'emergency_services' => 'boolean',
        'work_cover_claim' => 'boolean',
        'claim_active' => 'boolean',
        'claim_cost' => 'decimal:2',
        'days_suitable_duties' => 'integer',
        'suitable_duties_from' => 'date',
        'suitable_duties_to' => 'date',
        'medical_expenses' => 'decimal:2',
        'treatment' => 'boolean',
        'follow_up' => 'boolean',
        'witnesses' => 'boolean',
        'work_days_missed' => 'integer',
        'natures' => 'array',
        'mechanisms' => 'array',
        'agencies' => 'array',
        'contributions' => 'array',
        'corrective_actions' => 'array',
    ];

    protected $appends = ['incident_label', 'report_type_label', 'computed_suitable_duties_days'];

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

    public const CLAIM_TYPE_OPTIONS = [
        'statutory' => 'Statutory',
        'common_law' => 'Common Law',
    ];

    public const CLAIM_STATUS_OPTIONS = [
        'active' => 'Active',
        'denied' => 'Denied',
        'closed' => 'Closed',
    ];

    public const CAPACITY_OPTIONS = [
        'full_duties' => 'Full Duties',
        'suitable_duties' => 'Suitable Duties',
        'no_capacity' => 'No Capacity',
    ];

    public const EMPLOYMENT_STATUS_OPTIONS = [
        'full_time' => 'Full Time',
        'part_time' => 'Part Time',
        'casual' => 'Casual',
        'contractor' => 'Contractor',
    ];

    public const CORRECTIVE_ACTION_OPTIONS = [
        'swms_review' => 'SWMS Review with individual / workgroup',
        'amend_swms' => 'Amend SWMS (controls relating to the incident / injury to be reviewed and amended)',
        'toolbox_talk' => 'Toolbox Talk (workgroup) regarding corrective actions taken to prevent reoccurrence',
        'issue_non_conformance' => 'Issue non-conformance where company policies / procedures have not been followed (i.e. not wearing required PPE)',
        'other' => 'Other',
    ];

    // --- Activity log ---

    protected static array $fieldLabels = [
        'location_id' => 'Location',
        'employee_id' => 'Worker',
        'employee_address' => 'Worker Address',
        'incident' => 'Incident Type',
        'incident_other' => 'Incident (Other)',
        'occurred_at' => 'Occurred At',
        'reported_by' => 'Reported By',
        'reported_at' => 'Reported At',
        'reported_to' => 'Reported To',
        'location_of_incident' => 'Location of Incident',
        'description' => 'Description',
        'emergency_services' => 'Emergency Services',
        'work_cover_claim' => 'WorkCover Claim',
        'treatment' => 'Treatment Provided',
        'treatment_at' => 'Treatment At',
        'treatment_provider' => 'Treatment Provider',
        'treatment_external' => 'External Treatment',
        'treatment_external_location' => 'External Treatment Location',
        'no_treatment_reason' => 'No Treatment Reason',
        'follow_up' => 'Follow Up Required',
        'follow_up_notes' => 'Follow Up Notes',
        'work_days_missed' => 'Days Lost',
        'report_type' => 'Report Type',
        'witnesses' => 'Witnesses',
        'witness_details' => 'Witness Details',
        'locked_at' => 'Lock Status',
        'representative_id' => 'Representative',
    ];

    protected static array $ignoredFields = [
        'id_formal', 'created_by', 'updated_by', 'updated_at',
        'worker_signature', 'representative_signature', 'body_location_image',
        'natures', 'natures_comments', 'mechanisms', 'mechanisms_comments',
        'agencies', 'agencies_comments', 'contributions', 'contributions_comments',
        'corrective_actions', 'corrective_actions_comments',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnlyDirty()
            ->logFillable()
            ->useLogName('injury');
    }

    protected static function booted(): void
    {
        static::created(function (Injury $injury) {
            $userId = auth()->id() ?? $injury->created_by;
            if ($userId) {
                $injury->addSystemComment(
                    'Created injury report ' . $injury->id_formal,
                    ['event' => 'created'],
                    $userId,
                );
            }
        });

        static::updated(function (Injury $injury) {
            $changes = $injury->getChanges();
            $original = $injury->getOriginal();

            // Filter out ignored fields
            $tracked = array_diff_key($changes, array_flip(static::$ignoredFields));
            unset($tracked['id'], $tracked['created_at']);

            if (empty($tracked)) {
                return;
            }

            // Special case: lock / unlock
            if (array_key_exists('locked_at', $tracked)) {
                $event = $injury->locked_at ? 'locked' : 'unlocked';
                $body = $event === 'locked' ? 'Locked this record' : 'Unlocked this record';
                $injury->addSystemComment($body, ['event' => $event], auth()->id());

                unset($tracked['locked_at']);
                if (empty($tracked)) {
                    return;
                }
            }

            $lines = [];
            foreach ($tracked as $field => $newValue) {
                $label = static::$fieldLabels[$field] ?? str_replace('_', ' ', ucfirst($field));
                $oldValue = $original[$field] ?? null;

                $oldDisplay = static::formatFieldValue($field, $oldValue);
                $newDisplay = static::formatFieldValue($field, $newValue);

                $lines[] = "**{$label}**: {$oldDisplay} → {$newDisplay}";
            }

            $body = count($lines) === 1
                ? 'Updated ' . $lines[0]
                : "Updated record:\n" . implode("\n", array_map(fn ($l) => "- {$l}", $lines));

            $injury->addSystemComment(
                $body,
                ['event' => 'updated', 'changes' => array_keys($tracked)],
                auth()->id(),
            );
        });
    }

    protected static function formatFieldValue(string $field, mixed $value): string
    {
        if (is_null($value) || $value === '') {
            return '_empty_';
        }

        if (is_bool($value) || $value === '0' || $value === '1') {
            if ($field === 'work_cover_claim' || $field === 'emergency_services'
                || $field === 'treatment' || $field === 'follow_up' || $field === 'witnesses') {
                return filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 'Yes' : 'No';
            }
        }

        return match ($field) {
            'incident' => self::INCIDENT_OPTIONS[$value] ?? $value,
            'report_type' => self::REPORT_TYPE_OPTIONS[$value] ?? $value,
            'treatment_external' => self::TREATMENT_EXTERNAL_OPTIONS[$value] ?? $value,
            'location_id' => Location::find($value)?->name ?? $value,
            'employee_id' => Employee::find($value)?->preferred_name ?? Employee::find($value)?->name ?? $value,
            'representative_id' => Employee::find($value)?->preferred_name ?? Employee::find($value)?->name ?? $value,
            default => (string) $value,
        };
    }

    // --- Media collections ---

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('files');
        $this->addMediaCollection('body_location')->singleFile();
    }

    // --- Accessors ---

    public function getIncidentLabelAttribute(): ?string
    {
        return self::INCIDENT_OPTIONS[$this->incident] ?? $this->incident;
    }

    public function getReportTypeLabelAttribute(): ?string
    {
        return self::REPORT_TYPE_OPTIONS[$this->report_type] ?? $this->report_type;
    }

    public function getComputedSuitableDutiesDaysAttribute(): int
    {
        if (! $this->suitable_duties_from) {
            return $this->days_suitable_duties ?? 0;
        }

        $from = \Carbon\Carbon::parse($this->suitable_duties_from);
        $to = $this->suitable_duties_to ? \Carbon\Carbon::parse($this->suitable_duties_to) : \Carbon\Carbon::today();

        if ($to->lt($from)) {
            return 0;
        }

        // Get all public holidays and RDOs in the date range
        $excludedDates = TimesheetEvent::whereIn('type', ['public_holiday', 'rdo'])
            ->where('start', '<=', $to->toDateString())
            ->where('end', '>=', $from->toDateString())
            ->get()
            ->flatMap(function ($event) use ($from, $to) {
                $dates = [];
                $eventStart = \Carbon\Carbon::parse($event->start)->max($from);
                $eventEnd = \Carbon\Carbon::parse($event->end)->min($to);
                for ($d = $eventStart->copy(); $d->lte($eventEnd); $d->addDay()) {
                    $dates[] = $d->toDateString();
                }
                return $dates;
            })
            ->unique()
            ->toArray();

        $days = 0;
        for ($d = $from->copy(); $d->lte($to); $d->addDay()) {
            if ($d->isWeekend()) {
                continue;
            }
            if (in_array($d->toDateString(), $excludedDates)) {
                continue;
            }
            $days++;
        }

        return $days;
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

    // --- Query scopes ---

    public function scopeForMonth($query, int $year, int $month)
    {
        return $query->whereYear('occurred_at', $year)
            ->whereMonth('occurred_at', $month);
    }

    public function scopeForFinancialYear($query, int $fyStartYear)
    {
        return $query->whereBetween('occurred_at', [
            "{$fyStartYear}-07-01",
            ($fyStartYear + 1) . '-06-30',
        ]);
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
