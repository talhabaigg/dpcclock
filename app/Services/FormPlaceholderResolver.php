<?php

namespace App\Services;

use App\Contracts\ProvidesFormPlaceholders;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class FormPlaceholderResolver
{
    /**
     * Resolve placeholders in a string against a model instance.
     * Unknown tokens are replaced with an empty string.
     *
     * The optional $subject lets templates whose forms target a sub-entity
     * (e.g. a reference check whose subject is the EmploymentApplicationReference)
     * also resolve subject-scoped tokens like {{reference.contact_person}}.
     */
    public function interpolate(?string $template, ?Model $formable, ?Model $subject = null): string
    {
        if ($template === null || $template === '') {
            return (string) $template;
        }

        $values = $this->valuesFor($formable, $subject);

        return preg_replace_callback(
            '/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/',
            fn (array $m) => (string) ($values[$m[1]] ?? ''),
            $template,
        );
    }

    /**
     * Build the resolved token map for the given formable (and optional subject).
     * Includes model-specific tokens plus subject-specific tokens plus globals.
     *
     * @return array<string, string>
     */
    public function valuesFor(?Model $formable, ?Model $subject = null): array
    {
        $values = $this->globalValues();

        if ($formable instanceof ProvidesFormPlaceholders) {
            foreach ($formable->formPlaceholderValues() as $key => $value) {
                $values[$key] = $this->stringify($value);
            }
        }

        if ($subject instanceof ProvidesFormPlaceholders) {
            foreach ($subject->formPlaceholderValues() as $key => $value) {
                $values[$key] = $this->stringify($value);
            }
        }

        return $values;
    }

    /**
     * Return the list of token definitions (token => label) for the model class
     * plus globals. Used by the form-builder token picker.
     *
     * @param  class-string|null  $modelClass
     * @param  class-string|null  $subjectClass  Adds the subject's tokens too — used by templates that target a sub-entity.
     * @return array<string, string>
     */
    public function definitionsFor(?string $modelClass, ?string $subjectClass = null): array
    {
        $definitions = $this->globalDefinitions();

        if ($modelClass && is_subclass_of($modelClass, ProvidesFormPlaceholders::class)) {
            $definitions = array_merge($definitions, $modelClass::formPlaceholderDefinitions());
        }

        if ($subjectClass && is_subclass_of($subjectClass, ProvidesFormPlaceholders::class)) {
            $definitions = array_merge($definitions, $subjectClass::formPlaceholderDefinitions());
        }

        return $definitions;
    }

    /**
     * Return sample values for the form-builder preview.
     *
     * @param  class-string|null  $modelClass
     * @param  class-string|null  $subjectClass
     * @return array<string, string>
     */
    public function samplesFor(?string $modelClass, ?string $subjectClass = null): array
    {
        $samples = $this->globalSamples();

        if ($modelClass && is_subclass_of($modelClass, ProvidesFormPlaceholders::class)) {
            $samples = array_merge($samples, $modelClass::formPlaceholderSamples());
        }

        if ($subjectClass && is_subclass_of($subjectClass, ProvidesFormPlaceholders::class)) {
            $samples = array_merge($samples, $subjectClass::formPlaceholderSamples());
        }

        return $samples;
    }

    /**
     * Extract all placeholder tokens used inside a template string.
     *
     * @return array<int, string>
     */
    public function extractTokens(?string $template): array
    {
        if (! $template) {
            return [];
        }

        preg_match_all('/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/', $template, $matches);

        return array_values(array_unique($matches[1] ?? []));
    }

    private function globalValues(): array
    {
        $user = Auth::user();

        return [
            'today' => now()->format('j M Y'),
            'today.iso' => now()->format('Y-m-d'),
            'now.time' => now()->format('g:i A'),
            'current_user.name' => $user?->name ?? '',
            'current_user.email' => $user?->email ?? '',
        ];
    }

    private function globalDefinitions(): array
    {
        return [
            'today' => "Today's date",
            'today.iso' => "Today's date (ISO)",
            'now.time' => 'Current time',
            'current_user.name' => 'Person filling the form',
            'current_user.email' => 'Filler email',
        ];
    }

    private function globalSamples(): array
    {
        return [
            'today' => '11 May 2026',
            'today.iso' => '2026-05-11',
            'now.time' => '2:34 PM',
            'current_user.name' => 'Sarah Kim',
            'current_user.email' => 'sarah.kim@example.com',
        ];
    }

    private function stringify(mixed $value): string
    {
        if ($value === null) {
            return '';
        }
        if ($value instanceof \DateTimeInterface) {
            return $value->format('j M Y');
        }
        if (is_bool($value)) {
            return $value ? 'Yes' : 'No';
        }
        if (is_scalar($value)) {
            return (string) $value;
        }
        return '';
    }
}
