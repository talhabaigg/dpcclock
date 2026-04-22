<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class EmployeeFileType extends Model
{
    protected $fillable = [
        'name',
        'category',
        'slug',
        'description',
        'has_back_side',
        'expiry_requirement',
        'requires_completed_date',
        'allow_multiple',
        'options',
        'conditions',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'has_back_side' => 'boolean',
        'requires_completed_date' => 'boolean',
        'allow_multiple' => 'boolean',
        'is_active' => 'boolean',
        'conditions' => 'array',
        'category' => 'array',
        'options' => 'array',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $type) {
            if (empty($type->slug)) {
                $type->slug = Str::slug($type->name);
            }
        });
    }

    public function employeeFiles(): HasMany
    {
        return $this->hasMany(EmployeeFile::class);
    }

    public function hasVersions(): bool
    {
        return $this->expiry_requirement !== 'none';
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Evaluate whether this file type's conditions apply to the given employee.
     * Empty/null conditions = required for all employees.
     */
    public function appliesToEmployee(Employee $employee): bool
    {
        $conditions = $this->conditions;

        if (empty($conditions) || empty($conditions['rules'])) {
            return true;
        }

        return $this->evaluateGroup($conditions, $employee);
    }

    private function evaluateGroup(array $group, Employee $employee): bool
    {
        $match = $group['match'] ?? 'all';
        $results = array_map(
            fn (array $rule) => isset($rule['match'])
                ? $this->evaluateGroup($rule, $employee)
                : $this->evaluateRule($rule, $employee),
            $group['rules']
        );

        return $match === 'all'
            ? ! in_array(false, $results, true)
            : in_array(true, $results, true);
    }

    private function evaluateRule(array $rule, Employee $employee): bool
    {
        $field = $rule['field'];
        $operator = $rule['operator'];
        $value = $rule['value'];

        $result = match ($field) {
            'employment_type' => $employee->employment_type === $value,
            'worktype' => $employee->worktypes->contains('id', (int) $value),
            'location' => $employee->kiosks->contains('location_id', (int) $value),
            default => false,
        };

        return $operator === 'is_not' ? ! $result : $result;
    }
}
