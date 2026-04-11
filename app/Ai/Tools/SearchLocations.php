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
        return 'Search for projects/locations by name or external ID. Returns only top-level job locations (not sub-locations or work types). Use this to find the correct project for a requisition.';
    }

    public function handle(Request $request): Stringable|string
    {
        $search = trim($request['search'] ?? '');

        // Base query: only open, top-level job locations (same filter as requisition create page)
        $baseQuery = Location::open()->where(function ($query) {
            $query->where('eh_parent_id', 1149031)
                ->orWhere('eh_parent_id', 1249093)
                ->orWhere('eh_parent_id', 1198645);
        });

        // If search is empty or wildcard, return all available projects
        if ($search === '' || $search === '*') {
            $results = (clone $baseQuery)->orderBy('name')->limit(30)->get(['id', 'name', 'external_id', 'state']);
        } else {
            $words = array_values(array_filter(preg_split('/\s+/', $search)));

            $searchQuery = fn ($operator) => (clone $baseQuery)
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
        }

        $locations = $results->map(function ($location) {
            $arr = $location->toArray();
            $arr['is_deprecated'] = str_starts_with($location->name, 'Old-');

            return $arr;
        })->all();

        return json_encode([
            'locations' => $locations,
            'count' => count($locations),
            'note' => 'These are top-level project locations. Locations prefixed with "Old-" are deprecated. If multiple matches exist, ask the user which location they mean before proceeding.',
        ], JSON_PRETTY_PRINT);
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'search' => $schema->string()->description('Name or external ID to search for. Use "*" or empty string to list all available projects.')->required(),
        ];
    }
}
