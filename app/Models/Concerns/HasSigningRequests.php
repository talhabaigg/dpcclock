<?php

namespace App\Models\Concerns;

use App\Models\SigningRequest;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;

trait HasSigningRequests
{
    public function signingRequests(): MorphMany
    {
        return $this->morphMany(SigningRequest::class, 'signable');
    }

    public function latestSigningRequest(): MorphOne
    {
        return $this->morphOne(SigningRequest::class, 'signable')->latestOfMany();
    }
}
