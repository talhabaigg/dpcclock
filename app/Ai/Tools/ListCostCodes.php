<?php

namespace App\Ai\Tools;

use App\Models\CostCode;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;
use Stringable;

class ListCostCodes implements Tool
{
    public function description(): Stringable|string
    {
        return 'List valid cost codes for a specific location/project. Use this to find the correct cost code when a material item does not have one assigned.';
    }

    public function handle(Request $request): Stringable|string
    {
        $locationId = (int) $request['location_id'];

        $costCodes = CostCode::whereHas('locations', fn ($q) => $q->where('locations.id', $locationId))
            ->ordered()
            ->get(['id', 'code', 'description']);

        return json_encode([
            'cost_codes' => $costCodes->toArray(),
            'count' => $costCodes->count(),
        ], JSON_PRETTY_PRINT);
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'location_id' => $schema->integer()->description('The location/project ID to get cost codes for')->required(),
        ];
    }
}
