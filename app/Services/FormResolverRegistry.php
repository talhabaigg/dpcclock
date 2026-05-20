<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\User;
use Illuminate\Support\Collection;

class FormResolverRegistry
{
    /**
     * Allowlisted option sources. Keys are referenced by FormField.options_source.
     * Values resolve to a collection of ['id' => ..., 'name' => ...] rows.
     *
     * Builder UI surfaces this list; nothing outside this map is callable.
     *
     * @var array<string, array{label: string, resolver: callable, value_resolver?: callable}>
     */
    protected array $sources;

    public function __construct()
    {
        $this->sources = [
            'users' => [
                'label' => 'Users',
                'resolver' => fn () => User::query()
                    ->orderBy('name')
                    ->get(['id', 'name'])
                    ->map(fn (User $u) => ['id' => (string) $u->id, 'name' => $u->name])
                    ->values(),
            ],
            'employees' => [
                'label' => 'Employees',
                'resolver' => fn () => Employee::query()
                    ->orderBy('name')
                    ->get(['id', 'name'])
                    ->map(fn (Employee $e) => ['id' => (string) $e->id, 'name' => $e->name])
                    ->values(),
            ],
        ];
    }

    /**
     * @return array<int, array{key: string, label: string}>
     */
    public function list(): array
    {
        return collect($this->sources)
            ->map(fn (array $cfg, string $key) => ['key' => $key, 'label' => $cfg['label']])
            ->values()
            ->all();
    }

    public function has(string $key): bool
    {
        return isset($this->sources[$key]);
    }

    /**
     * Resolve a source key to a collection of {id, name} options.
     */
    public function resolve(string $key): Collection
    {
        if (! $this->has($key)) {
            return collect();
        }

        return ($this->sources[$key]['resolver'])();
    }

    /**
     * Resolve stored values (ids) back to display labels for snapshotting.
     * Accepts a single id or an array of ids; always returns an array of names.
     *
     * @param  mixed  $value
     * @return array<int, string>
     */
    public function resolveDisplayValues(string $key, mixed $value): array
    {
        if ($value === null || $value === '' || $value === []) {
            return [];
        }

        $ids = array_map(
            fn ($v) => (string) $v,
            is_array($value) ? $value : [$value],
        );

        return $this->resolve($key)
            ->whereIn('id', $ids)
            ->pluck('name')
            ->values()
            ->all();
    }
}
