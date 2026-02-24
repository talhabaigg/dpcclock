<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class JobVendorCommitment extends Model
{
    protected $table = 'job_vendor_commitments';

    protected $fillable = [
        'job_number',
        'company',
        'vendor',
        'subcontract_no',
        'po_no',
        'approval_status',
        'project_manager',
        'original_commitment',
        'approved_changes',
        'current_commitment',
        'total_billed',
        'os_commitment',
        'invoiced_amount',
        'retainage_percent',
        'retainage',
        'paid_amount',
        'ap_balance',
    ];

    /**
     * Determine if this is a subcontract (SC) or purchase order (PO).
     */
    public function getTypeAttribute(): string
    {
        return !empty($this->subcontract_no) ? 'SC' : 'PO';
    }

    public function location()
    {
        return $this->belongsTo(Location::class, 'job_number', 'external_id');
    }

    public function jobSummary()
    {
        return $this->belongsTo(JobSummary::class, 'job_number', 'job_number');
    }
}
