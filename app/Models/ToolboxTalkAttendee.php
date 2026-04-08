<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ToolboxTalkAttendee extends Model
{
    protected $fillable = [
        'toolbox_talk_id',
        'employee_id',
        'signed',
    ];

    protected $casts = [
        'signed' => 'boolean',
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
