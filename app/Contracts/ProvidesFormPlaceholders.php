<?php

namespace App\Contracts;

interface ProvidesFormPlaceholders
{
    /**
     * Return a map of placeholder tokens to resolved values for this instance.
     *
     * Keys are dot-notation tokens (e.g. "applicant.first_name").
     * Values are scalar strings/numbers/dates the value will be cast to string.
     *
     * @return array<string, mixed>
     */
    public function formPlaceholderValues(): array;

    /**
     * Return a map of placeholder tokens to human-readable labels, for the
     * form-builder token picker. Static — does not require an instance.
     *
     * @return array<string, string>
     */
    public static function formPlaceholderDefinitions(): array;

    /**
     * Return a map of placeholder tokens to sample values, used by the
     * form-builder preview. Static — does not require an instance.
     *
     * @return array<string, string>
     */
    public static function formPlaceholderSamples(): array;
}
