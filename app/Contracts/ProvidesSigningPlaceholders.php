<?php

namespace App\Contracts;

interface ProvidesSigningPlaceholders
{
    /**
     * Return the placeholder definitions this model exposes to signing documents.
     *
     * Keys are full placeholder names (e.g. "employee.first_name"); values are
     * associative arrays with 'label' (human-readable) and 'value' (resolved
     * string for this specific model instance).
     *
     * @return array<string, array{label: string, value: string}>
     */
    public function signingPlaceholders(): array;
}
