<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IncidentReport extends Model
{
    protected $fillable = [
        'report_number',
        'incident_date',
        'day_of_week',
        'employee_name',
        'employee_id',
        'company',
        'project_name',
        'location_id',
        'position',
        'nature_of_injury',
        'nature_of_injury_code',
        'body_location',
        'mechanism_of_incident',
        'agency_of_injury',
        'incident_type',
        'workcover_claim',
        'days_lost',
        'days_suitable_duties',
        'medical_expenses_non_workcover',
        'status',
        'comments',
        'claim_active',
        'claim_type',
        'claim_status',
        'capacity',
        'employment_status',
        'claim_cost',
        'uploaded_by',
    ];

    protected $casts = [
        'incident_date' => 'date',
        'workcover_claim' => 'boolean',
        'claim_active' => 'boolean',
        'days_lost' => 'integer',
        'days_suitable_duties' => 'integer',
        'medical_expenses_non_workcover' => 'decimal:2',
        'claim_cost' => 'decimal:2',
    ];

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function scopeForMonth($query, int $year, int $month)
    {
        return $query->whereYear('incident_date', $year)
            ->whereMonth('incident_date', $month);
    }

    public function scopeForFinancialYear($query, int $fyStartYear)
    {
        return $query->whereBetween('incident_date', [
            "{$fyStartYear}-07-01",
            ($fyStartYear + 1) . '-06-30',
        ]);
    }

    public function scopeOfType($query, string $type)
    {
        return $query->where('incident_type', $type);
    }

    public function scopeWithClaims($query)
    {
        return $query->where('workcover_claim', true);
    }
}
