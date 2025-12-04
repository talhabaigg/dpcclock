<?php

namespace App\Http\Controllers;

use App\Models\Location;
use Illuminate\Http\Request;


class LocationItemController extends Controller
{
    public function showLocationItems(Location $location)
    {
        $location->load('materialItems.supplier');

        return inertia('location-items/index', [
            'location' => $location
        ]);

    }

    public function showMaterialItemPriceListUploads(Location $location)
    {
        $location->load('materialItemPriceListUploads.creator');

        $location->materialItemPriceListUploads->each(function ($upload) {

            $upload->upload_file_path = $upload->upload_file_path
                ? \Storage::disk('s3')->temporaryUrl($upload->upload_file_path, now()->addMinutes(60))
                : null;

            $upload->failed_file_path = $upload->failed_file_path
                ? \Storage::disk('s3')->temporaryUrl($upload->failed_file_path, now()->addMinutes(60))
                : null;


        });

        return inertia('location-price-list-uploads/index', [
            'location' => $location
        ]);
    }
}
