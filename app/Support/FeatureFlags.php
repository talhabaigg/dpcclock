<?php

namespace App\Support;

use InvalidArgumentException;
use Laravel\Pennant\Feature;

class FeatureFlags
{
    public const GLOBAL_SCOPE = 'global';

    public const KIOSK_SILICA_QUESTION = 'kiosk-silica-question';

    /**
     * @return array<string, array{label: string, description: string, default: bool}>
     */
    public static function definitions(): array
    {
        return config('features.flags', [
            self::KIOSK_SILICA_QUESTION => [
                'label' => 'Kiosk Silica Question',
                'description' => 'Show the silica question on kiosk clock-out and require a silica response before submission.',
                'default' => false,
            ],
        ]);
    }

    public static function defineAll(): void
    {
        foreach (self::definitions() as $name => $definition) {
            Feature::define($name, fn (mixed $scope) => $definition['default']);
        }
    }

    public static function exists(string $name): bool
    {
        return array_key_exists($name, self::definitions());
    }

    /**
     * @return array{name: string, label: string, description: string, default: bool, active: bool}
     */
    public static function get(string $name): array
    {
        self::ensureExists($name);

        $definition = self::definitions()[$name];

        return [
            'name' => $name,
            'label' => $definition['label'],
            'description' => $definition['description'],
            'default' => $definition['default'],
            'active' => self::active($name),
        ];
    }

    /**
     * @return array<int, array{name: string, label: string, description: string, default: bool, active: bool}>
     */
    public static function all(): array
    {
        return collect(array_keys(self::definitions()))
            ->map(fn (string $name) => self::get($name))
            ->values()
            ->all();
    }

    public static function active(string $name): bool
    {
        self::ensureExists($name);

        return (bool) Feature::for(self::GLOBAL_SCOPE)->value($name);
    }

    public static function set(string $name, bool $active): void
    {
        self::ensureExists($name);

        $interaction = Feature::for(self::GLOBAL_SCOPE);

        if ($active) {
            $interaction->activate($name);

            return;
        }

        $interaction->deactivate($name);
    }

    protected static function ensureExists(string $name): void
    {
        if (! self::exists($name)) {
            throw new InvalidArgumentException("Unknown feature flag [{$name}].");
        }
    }
}
