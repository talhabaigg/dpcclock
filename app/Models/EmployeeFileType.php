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

    public const LEVEL_MANDATORY = 'mandatory';
    public const LEVEL_PREFERRED = 'preferred';
    public const LEVEL_OPTIONAL = 'optional';
    public const LEVEL_NONE = 'none';

    public const LEVELS = [
        self::LEVEL_MANDATORY,
        self::LEVEL_PREFERRED,
        self::LEVEL_OPTIONAL,
        self::LEVEL_NONE,
    ];

    /**
     * Whether this file type applies to the employee at all (level != none).
     */
    public function appliesToEmployee(Employee $employee): bool
    {
        return $this->requirementForEmployee($employee) !== self::LEVEL_NONE;
    }

    /**
     * Resolve the requirement level (mandatory|preferred|optional|none) for an employee.
     *
     * Conditions JSON shape (current):
     *   { "rule_groups": [ { "match": "all|any", "rules": [...], "result": "mandatory|preferred|optional|none" }, ... ] }
     *
     * Legacy shape (still supported):
     *   { "match": "all|any", "rules": [...] }   → treated as a single mandatory group
     *
     * If conditions is empty/null, defaults to mandatory for all employees.
     * If rule_groups exist but none match, defaults to none.
     */
    public function requirementForEmployee(Employee $employee): string
    {
        $conditions = $this->conditions;

        if (empty($conditions)) {
            return self::LEVEL_MANDATORY;
        }

        $groups = $this->normalizeRuleGroups($conditions);

        if ($groups === []) {
            return self::LEVEL_MANDATORY;
        }

        foreach ($groups as $group) {
            $rules = $group['rules'] ?? [];
            if ($rules === [] || $this->evaluateGroup($group, $employee)) {
                return $this->normalizeLevel($group['result'] ?? self::LEVEL_MANDATORY);
            }
        }

        return self::LEVEL_NONE;
    }

    /**
     * Convert legacy single-group shape into the new rule_groups list, leaving new shape untouched.
     */
    private function normalizeRuleGroups(array $conditions): array
    {
        if (isset($conditions['rule_groups']) && is_array($conditions['rule_groups'])) {
            return $conditions['rule_groups'];
        }

        if (isset($conditions['rules']) && is_array($conditions['rules'])) {
            return [[
                'match' => $conditions['match'] ?? 'all',
                'rules' => $conditions['rules'],
                'result' => self::LEVEL_MANDATORY,
            ]];
        }

        return [];
    }

    private function normalizeLevel(string $level): string
    {
        return in_array($level, self::LEVELS, true) ? $level : self::LEVEL_MANDATORY;
    }

    private function evaluateGroup(array $group, Employee $employee): bool
    {
        $match = $group['match'] ?? 'all';
        $rules = $group['rules'] ?? [];

        if ($rules === []) {
            return true;
        }

        $results = array_map(
            fn (array $rule) => isset($rule['match'])
                ? $this->evaluateGroup($rule, $employee)
                : $this->evaluateRule($rule, $employee),
            $rules
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
            'employment_agreement' => $employee->employment_agreement === $value,
            'worktype' => $employee->worktypes->contains('id', (int) $value),
            'location' => $employee->kiosks->contains('location_id', (int) $value),
            default => false,
        };

        return $operator === 'is_not' ? ! $result : $result;
    }
}
