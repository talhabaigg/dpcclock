<?php

namespace App\Models;

use App\Contracts\ProvidesSigningPlaceholders;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Employee extends Model implements ProvidesSigningPlaceholders
{
    use \Illuminate\Database\Eloquent\SoftDeletes;
    use Concerns\HasComments;
    use Concerns\HasSigningRequests;

    protected $fillable = [
        'eh_employee_id',
        'name',
        'preferred_name',
        'external_id',
        'email',
        'pin',
        'employment_type',
        'employment_agreement',
        'employing_entity_id',
        'employing_entity_name',
        'start_date',
        'date_of_birth',
        'residential_street_address',
        'residential_suburb',
        'residential_state',
        'residential_postcode',
    ];

    protected $appends = ['display_name'];

    public function getDisplayNameAttribute(): string
    {
        return $this->preferred_name ?: $this->name;
    }

    public function kiosks()
    {
        return $this->belongsToMany(Kiosk::class, 'employee_kiosk', 'eh_employee_id', 'eh_kiosk_id', 'eh_employee_id', 'eh_kiosk_id')->withPivot('zone', 'top_up');
    }

    public function clocks(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Clock::class, 'eh_employee_id', 'eh_employee_id');
    }

    // public function clockedIn(): Attribute
    // {
    //     return Attribute::get(fn () => $this->hasOne(Clock::class, 'eh_employee_id', 'eh_employee_id')
    //         ->whereNull('clock_out')
    //         ->exists());
    // }

    public function worktypes()
    {
        return $this->belongsToMany(Worktype::class);
    }

    public function incidentReports()
    {
        return $this->hasMany(IncidentReport::class);
    }

    public function silicaEntries(): HasMany
    {
        return $this->hasMany(SilicaEntry::class);
    }

    public function employmentApplications()
    {
        return $this->belongsToMany(EmploymentApplication::class, 'employment_application_employee')
            ->withPivot('eh_location_id', 'linked_at')
            ->withTimestamps();
    }

    public function employeeFiles(): HasMany
    {
        return $this->hasMany(EmployeeFile::class);
    }

    /**
     * Get active file types whose conditions match this employee (level != none).
     */
    public function requiredFileTypes()
    {
        $this->loadMissing(['worktypes', 'kiosks']);

        return EmployeeFileType::active()
            ->orderBy('sort_order')
            ->get()
            ->filter(fn (EmployeeFileType $type) => $type->appliesToEmployee($this));
    }

    /**
     * Get compliance status for each required file type.
     * Returns array of { file_type, file, status, level } where:
     *   status is valid|expired|expiring_soon|missing
     *   level  is mandatory|preferred|optional
     */
    public function fileComplianceStatus(): array
    {
        $this->loadMissing(['worktypes', 'kiosks']);

        $required = EmployeeFileType::active()
            ->orderBy('sort_order')
            ->get()
            ->map(fn (EmployeeFileType $type) => [
                'type' => $type,
                'level' => $type->requirementForEmployee($this),
            ])
            ->filter(fn (array $row) => $row['level'] !== EmployeeFileType::LEVEL_NONE);

        $latest = $this->employeeFiles()
            ->with('fileType')
            ->orderByDesc('created_at')
            ->get()
            ->unique('employee_file_type_id')
            ->keyBy('employee_file_type_id');

        return $required->map(fn (array $row) => [
            'file_type' => $row['type'],
            'file' => $latest->get($row['type']->id),
            'level' => $row['level'],
            'status' => match (true) {
                $latest->get($row['type']->id) === null => 'missing',
                $latest->get($row['type']->id)->isExpired() => 'expired',
                $latest->get($row['type']->id)->isExpiringSoon() => 'expiring_soon',
                default => 'valid',
            },
        ])->values()->toArray();
    }

    /**
     * Compliant when every mandatory requirement is valid.
     * Preferred/optional gaps don't break compliance.
     */
    public function isFileCompliant(): bool
    {
        return collect($this->fileComplianceStatus())
            ->where('level', EmployeeFileType::LEVEL_MANDATORY)
            ->every(fn (array $item) => $item['status'] === 'valid');
    }

    public function isOfficeStaff(): bool
    {
        return (int) $this->employing_entity_id === (int) config('services.employment_hero.cms_entity_id');
    }

    public function scopeOfficeStaff(Builder $query): Builder
    {
        return $query->where('employing_entity_id', (int) config('services.employment_hero.cms_entity_id'));
    }

    public function scopeFieldStaff(Builder $query): Builder
    {
        $cmsId = (int) config('services.employment_hero.cms_entity_id');

        return $query->where(function (Builder $q) use ($cmsId) {
            $q->whereNull('employing_entity_id')
                ->orWhere('employing_entity_id', '!=', $cmsId);
        });
    }

    public function signingPlaceholders(): array
    {
        [$firstName, $lastName] = $this->splitName();
        $startDate = $this->start_date ? \Carbon\Carbon::parse($this->start_date)->format('d/m/Y') : '';

        return [
            'employee.first_name' => [
                'label' => 'First name',
                'value' => $firstName,
            ],
            'employee.last_name' => [
                'label' => 'Last name',
                'value' => $lastName,
            ],
            'employee.full_name' => [
                'label' => 'Full name',
                'value' => (string) ($this->preferred_name ?: $this->name),
            ],
            'employee.email' => [
                'label' => 'Email',
                'value' => (string) ($this->email ?? ''),
            ],
            'employee.employment_type' => [
                'label' => 'Employment type',
                'value' => (string) ($this->employment_type ?? ''),
            ],
            'employee.employing_entity' => [
                'label' => 'Employing entity',
                'value' => (string) ($this->employing_entity_name ?? ''),
            ],
            'employee.start_date' => [
                'label' => 'Start date',
                'value' => $startDate,
            ],
            'employee.address' => [
                'label' => 'Address',
                'value' => (string) ($this->residential_street_address ?? ''),
            ],
            'employee.suburb' => [
                'label' => 'Suburb',
                'value' => (string) ($this->residential_suburb ?? ''),
            ],
            'employee.state' => [
                'label' => 'State',
                'value' => (string) ($this->residential_state ?? ''),
            ],
            'employee.postcode' => [
                'label' => 'Postcode',
                'value' => (string) ($this->residential_postcode ?? ''),
            ],
        ];
    }

    private function splitName(): array
    {
        $name = trim((string) $this->name);
        if ($name === '') {
            return ['', ''];
        }
        $parts = explode(' ', $name, 2);

        return [$parts[0], $parts[1] ?? ''];
    }
}
