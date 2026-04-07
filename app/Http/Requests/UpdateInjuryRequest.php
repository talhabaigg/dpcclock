<?php

namespace App\Http\Requests;

use App\Models\Injury;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateInjuryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('injury-register.edit') && !$this->route('injury')->isLocked();
    }

    public function rules(): array
    {
        return (new StoreInjuryRequest())->rules();
    }
}
