<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AiChatMessage extends Model
{
    protected $fillable = [
        'user_id',
        'conversation_id',
        'role',
        'message',
        'model_used',
        'tokens_used',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
