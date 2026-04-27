<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ToolboxTalkAttendee extends Model
{
    public const SOURCE_PDF = 'pdf';
    public const SOURCE_QR = 'qr';
    public const SOURCE_IPAD = 'ipad';

    protected $fillable = [
        'toolbox_talk_id',
        'employee_id',
        'signed',
        'signed_at',
        'acknowledged_at',
        'signature_path',
        'source',
    ];

    protected $casts = [
        'signed' => 'boolean',
        'signed_at' => 'datetime',
        'acknowledged_at' => 'datetime',
    ];

    public function toolboxTalk(): BelongsTo
    {
        return $this->belongsTo(ToolboxTalk::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }
}
