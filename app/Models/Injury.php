<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;

class Injury extends Model implements HasMedia
{
    use InteractsWithMedia;

    protected $fillable = [
        'id_formal', 'location_id', 'employee_id', 'employee_address',
        'incident', 'incident_other', 'occurred_at', 'reported_by',
        'reported_at', 'reported_to', 'location_of_incident', 'description',
        'emergency_services', 'work_cover_claim', 'treatment', 'treatment_at',
        'treatment_provider', 'treatment_external', 'treatment_external_location',
        'no_treatment_reason', 'follow_up', 'follow_up_notes', 'work_days_missed',
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
        'natures' => 'array',
        'mechanisms' => 'array',
        'agencies' => 'array',
        'contributions' => 'array',
        'corrective_actions' => 'array',
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
