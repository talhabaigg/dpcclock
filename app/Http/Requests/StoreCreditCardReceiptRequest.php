<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreCreditCardReceiptRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('receipts.view');
    }

    public function rules(): array
    {
        return [
            'receipts' => ['required', 'array', 'min:1', 'max:10'],
            'receipts.*' => ['file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:20480'],
        ];
    }

    public function messages(): array
    {
        return [
            'receipts.required' => 'Please upload at least one receipt image.',
            'receipts.*.mimes' => 'Each receipt must be an image or PDF file (jpg, png, webp, pdf).',
            'receipts.*.max' => 'Each receipt image must not exceed 20MB.',
        ];
    }
}
