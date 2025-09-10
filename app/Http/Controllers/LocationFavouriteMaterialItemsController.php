<?php

namespace App\Http\Controllers;

use App\Models\Location;
use App\Models\MaterialItem;
use DB;
use Illuminate\Http\Request;

class LocationFavouriteMaterialItemsController extends Controller
{
    public function uploadFavouriteMaterials(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt',
        ]);

        $path = $request->file('file')->getRealPath();
        $rows = array_map('str_getcsv', file($path));
        $header = array_map('trim', array_shift($rows));
        $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0]);

        $dataToInsert = [];
        $locationIds = [];

        foreach ($rows as $row) {
            $data = array_combine($header, $row);

            $location = Location::where('external_id', $data['location_id'])->first();
            $material = MaterialItem::where('code', $data['code'])->first();

            if (!$location || !$material) {
                continue;
            }

            $locationIds[] = $location->id;

            $dataToInsert[] = [
                'location_id' => $location->id,
                'material_item_id' => $material->id,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        $uniqueLocationIds = array_unique($locationIds);
        $dataToInsert = collect($dataToInsert)
            ->unique(fn($item) => $item['location_id'] . '-' . $item['material_item_id'])
            ->values()
            ->toArray();

        DB::transaction(function () use ($uniqueLocationIds, $dataToInsert) {
            // Delete old pricing only for relevant locations
            DB::table('location_favourite_materials')
                ->whereIn('location_id', $uniqueLocationIds)
                ->delete();

            // Insert new pricing
            DB::table('location_favourite_materials')->insert($dataToInsert);
        });

        return back()->with('success', "Imported " . count($dataToInsert) . " prices successfully.");
    }

    public function downloadFavouriteMaterials($locationId)
    {
        $location = Location::findOrFail($locationId);
        $fileName = 'location_favourite_items_' . $location->name . '_' . now()->format('Ymd_His') . '.csv';
        $filePath = storage_path("app/{$fileName}");

        $handle = fopen($filePath, 'w');
        fputcsv($handle, ['location_id', 'code', 'description']);

        $items = DB::table('location_favourite_materials')
            ->where('location_id', $location->id)
            ->join('material_items', 'location_favourite_materials.material_item_id', '=', 'material_items.id')
            ->select('location_favourite_materials.location_id', 'material_items.code', 'material_items.description')
            ->get();
        foreach ($items as $item) {
            fputcsv($handle, [
                $location->external_id,
                $item->code,
                $item->description,
            ]);
        }
        fclose($handle);

        return response()->download($filePath)->deleteFileAfterSend(true);
    }


}
