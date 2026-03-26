<?php

namespace App\Events;

use App\Models\SigningRequest;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DocumentSigned
{
    use Dispatchable, SerializesModels;

    public function __construct(public SigningRequest $signingRequest) {}
}
