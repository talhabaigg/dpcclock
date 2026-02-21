<?php

namespace App\Ai\Tools;

use App\Models\Location;
use App\Models\RequisitionHeaderTemplate;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;
use Stringable;

class GetLocationDefaults implements Tool
{
    public function description(): Stringable|string
    {
        return 'Get default delivery information for a location. Returns saved delivery contact, deliver_to address, requested_by name, and order reference. Use this to pre-fill requisition header fields.';
    }

    public function handle(Request $request): Stringable|string
    {
        $locationId = (int) $request['location_id'];

        $location = Location::find($locationId);

        if (! $location) {
            return json_encode(['error' => "Location with ID {$locationId} not found"]);
        }

        $template = RequisitionHeaderTemplate::where('location_id', $locationId)->first();

        return json_encode([
            'location_id' => $location->id,
            'location_name' => $location->name,
            'external_id' => $location->external_id,
            'delivery_contact' => $template?->delivery_contact,
            'requested_by' => $template?->requested_by,
            'deliver_to' => $template?->deliver_to ?? $location->name,
            'order_reference' => $template?->order_reference,
        ], JSON_PRETTY_PRINT);
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'location_id' => $schema->integer()->description('The location/project ID to get defaults for')->required(),
        ];
    }
}
