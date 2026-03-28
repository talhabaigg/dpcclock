<?php

namespace App\Models\Concerns;

use App\Models\FormRequest;
use Illuminate\Database\Eloquent\Relations\MorphMany;

trait HasFormRequests
{
    public function formRequests(): MorphMany
    {
        return $this->morphMany(FormRequest::class, 'formable');
    }
}
