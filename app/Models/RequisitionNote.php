<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class RequisitionNote extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'requisition_id',
        'note',
        'created_by',
    ];
    public function requisition()
    {
        return $this->belongsTo(Requisition::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
