<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Employee extends Model
{
    use \Illuminate\Database\Eloquent\SoftDeletes;
    use Concerns\HasComments;

    protected $fillable = [
        'eh_employee_id',
        'name',
        'preferred_name',
        'external_id',
        'email',
        'pin',
        'employment_type',
        'employment_agreement',
        'start_date',
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
     * Get active file types whose conditions match this employee.
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
     * Returns array of { file_type, file, status } where status is valid|expired|expiring_soon|missing.
     */
    public function fileComplianceStatus(): array
    {
        $required = $this->requiredFileTypes();
        $latest = $this->employeeFiles()
            ->with('fileType')
            ->orderByDesc('created_at')
            ->get()
            ->unique('employee_file_type_id')
            ->keyBy('employee_file_type_id');

        return $required->map(fn (EmployeeFileType $type) => [
            'file_type' => $type,
            'file' => $latest->get($type->id),
            'status' => match (true) {
                $latest->get($type->id) === null => 'missing',
                $latest->get($type->id)->isExpired() => 'expired',
                $latest->get($type->id)->isExpiringSoon() => 'expiring_soon',
                default => 'valid',
            },
        ])->values()->toArray();
    }

    public function isFileCompliant(): bool
    {
        return collect($this->fileComplianceStatus())
            ->every(fn (array $item) => $item['status'] === 'valid');
    }
}
