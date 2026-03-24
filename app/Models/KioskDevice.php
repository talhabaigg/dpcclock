<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KioskDevice extends Model
{
    protected $fillable = [
        'kiosk_id',
        'device_token',
        'device_name',
        'registered_by',
        'is_active',
        'last_seen_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'last_seen_at' => 'datetime',
    ];

    public function kiosk()
    {
        return $this->belongsTo(Kiosk::class);
    }

    public function registeredByUser()
    {
        return $this->belongsTo(User::class, 'registered_by');
    }
}
