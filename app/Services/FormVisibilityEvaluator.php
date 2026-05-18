<?php

namespace App\Services;

use App\Models\FormField;
use Illuminate\Support\Collection;

/**
 * Evaluates FormField visible_if rules and section cascading. Mirror the
 * semantics in resources/js/form-fill.ts AND the React filler in
 * employment-applications/show.tsx — all three must agree exactly. Lock-step
 * changes are required.
 *
 * Section model: a `heading` field opens a section. Every following field
 * (any type) belongs to that section until the next `heading`, or end of
 * form. When a heading's rule evaluates false, the heading and every field in
 * its section are hidden. A field's own rule is AND-ed with its section's.
 * Fields before the first heading have no parent section.
 */
class FormVisibilityEvaluator
{
    public const OPERATORS = ['equals', 'not_equals', 'empty', 'not_empty'];

    /**
     * Walk an ordered field collection and produce a [fieldId => bool] map.
     * Use this when evaluating an entire form; it handles section cascade.
     *
     * @param  Collection<int,FormField>  $orderedFields fields in sort_order
     * @param  array<int,mixed>  $responses keyed by field id
     * @return array<int,bool>
     */
    public function evaluateAll(Collection $orderedFields, array $responses): array
    {
        $visibility = [];
        // Current section's visibility (true when no current section).
        $sectionVisible = true;

        foreach ($orderedFields as $field) {
            if ($field->type === 'heading') {
                // A new heading opens (or replaces) the current section.
                $sectionVisible = $this->ruleHolds($field->visible_if, $responses);
                $visibility[$field->id] = $sectionVisible;
                continue;
            }

            $ownRule = $this->ruleHolds($field->visible_if, $responses);
            $visibility[$field->id] = $sectionVisible && $ownRule;
        }

        return $visibility;
    }

    /**
     * Single-field rule evaluation. Does NOT consider section cascade.
     * Use evaluateAll() for whole-form evaluation.
     *
     * @param  array<int,mixed>  $responses keyed by field id
     */
    public function isVisible(FormField $field, array $responses): bool
    {
        return $this->ruleHolds($field->visible_if, $responses);
    }

    /**
     * @param  array<int,mixed>|null  $rule
     * @param  array<int,mixed>  $responses
     */
    private function ruleHolds(?array $rule, array $responses): bool
    {
        if (! is_array($rule) || empty($rule['field_id']) || empty($rule['operator'])) {
            return true;
        }

        $sourceId = (int) $rule['field_id'];
        $operator = (string) $rule['operator'];
        $target = $rule['value'] ?? null;
        $sourceValue = $responses[$sourceId] ?? null;

        return $this->compare($sourceValue, $operator, $target);
    }

    /**
     * Pure comparison so tests can drive it without building FormField objects.
     */
    public function compare(mixed $sourceValue, string $operator, mixed $target): bool
    {
        $empty = $this->isEmpty($sourceValue);

        return match ($operator) {
            'empty' => $empty,
            'not_empty' => ! $empty,
            'equals' => $this->matches($sourceValue, (string) ($target ?? '')),
            'not_equals' => ! $this->matches($sourceValue, (string) ($target ?? '')),
            default => true,
        };
    }

    /**
     * empty = null, empty string, or empty array. Whitespace-only strings count
     * as filled (matching how Laravel's `required` treats them — the server
     * already coerces to string before submitting).
     */
    private function isEmpty(mixed $value): bool
    {
        if ($value === null) {
            return true;
        }
        if (is_string($value)) {
            return $value === '';
        }
        if (is_array($value)) {
            return count($value) === 0;
        }

        return false;
    }

    /**
     * Equality semantics:
     * - scalar source: standard string compare (cast both sides).
     * - array source (checkbox group): membership — true if $target is one of the values.
     */
    private function matches(mixed $sourceValue, string $target): bool
    {
        if (is_array($sourceValue)) {
            foreach ($sourceValue as $v) {
                if ((string) $v === $target) {
                    return true;
                }
            }

            return false;
        }

        return (string) ($sourceValue ?? '') === $target;
    }
}
