<?php

namespace App\Ai\Tools;

use App\Models\Location;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;
use Stringable;

class SearchLocations implements Tool
{
    public function description(): Stringable|string
    {
        return 'Search for projects/locations by name or external ID. Use this to find the correct location for a requisition.';
    }

    public function handle(Request $request): Stringable|string
    {
        $search = trim($request['search']);
        $words = array_values(array_filter(preg_split('/\s+/', $search)));

        $searchQuery = fn ($operator) => Location::query()
            ->where(function ($q) use ($words, $operator) {
                foreach ($words as $word) {
                    $method = $operator === 'and' ? 'where' : 'orWhere';
                    $q->$method(function ($inner) use ($word) {
                        $inner->where('name', 'like', "%{$word}%")
                            ->orWhere('external_id', 'like', "%{$word}%");
                    });
                }
            })
            ->orderBy('name')
            ->limit(20)
            ->get(['id', 'name', 'external_id', 'state']);

        // Try matching ALL words first, fall back to ANY word
        $results = $searchQuery('and');
        if ($results->isEmpty() && count($words) > 1) {
            $results = $searchQuery('or');
        }

        $locations = $results->map(function ($location) {
            $arr = $location->toArray();
            $arr['is_deprecated'] = str_starts_with($location->name, 'Old-');

            return $arr;
        })->all();

        return json_encode([
            'locations' => $locations,
            'count' => count($locations),
            'note' => 'Locations prefixed with "Old-" are deprecated. If multiple matches exist, ask the user which location they mean before proceeding.',
        ], JSON_PRETTY_PRINT);
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'search' => $schema->string()->description('Name or external ID to search for')->required(),
        ];
    }
}
