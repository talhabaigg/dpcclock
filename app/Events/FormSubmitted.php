<?php

namespace App\Events;

use App\Models\FormRequest;
use Illuminate\Foundation\Events\Dispatchable;

class FormSubmitted
{
    use Dispatchable;

    public function __construct(
        public FormRequest $formRequest,
    ) {}
}
