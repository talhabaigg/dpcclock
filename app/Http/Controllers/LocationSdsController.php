<?php

namespace App\Http\Controllers;

use App\Models\Location;
use App\Models\SafetyDataSheet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use setasign\Fpdi\Tcpdf\Fpdi;

class LocationSdsController extends Controller
{
    public function index(Location $location)
    {
        $allSds = SafetyDataSheet::with('media')
            ->orderBy('product_name')
            ->get()
            ->map(fn (SafetyDataSheet $sds) => [
                'id' => $sds->id,
                'product_name' => $sds->product_name,
                'manufacturer' => $sds->manufacturer,
                'hazard_classifications' => $sds->hazard_classifications ?? [],
                'expires_at' => $sds->expires_at->toDateString(),
                'is_expired' => $sds->isExpired(),
            ]);

        $assignedIds = $location->safetyDataSheets()->pluck('safety_data_sheet_id')->toArray();

        return Inertia::render('locations/sds-register', [
            'location' => [
                'id' => $location->id,
                'name' => $location->name,
                'external_id' => $location->external_id,
            ],
            'allSds' => $allSds,
            'assignedIds' => $assignedIds,
        ]);
    }

    public function sync(Request $request, Location $location)
    {
        $validated = $request->validate([
            'sds_ids' => 'present|array',
            'sds_ids.*' => 'integer|exists:safety_data_sheets,id',
        ]);

        $location->safetyDataSheets()->sync($validated['sds_ids']);

        return redirect()->back()->with('success', 'SDS register updated for ' . $location->name);
    }

    public function downloadMergedPdf(Location $location)
    {
        $sdsRecords = $location->safetyDataSheets()->with('media')->get();

        if ($sdsRecords->isEmpty()) {
            return redirect()->back()->with('error', 'No SDS records assigned to this project.');
        }

        $pdf = new Fpdi();
        $tempFiles = [];
        $skipped = [];

        foreach ($sdsRecords as $sds) {
            $media = $sds->getFirstMedia('sds_file');
            if (!$media) {
                $skipped[] = $sds->product_name . ' (no file)';
                continue;
            }

            $tmpPath = tempnam(sys_get_temp_dir(), 'sds_merge_') . '.pdf';
            $tempFiles[] = $tmpPath;

            try {
                $contents = Storage::disk($media->disk)->get($media->getPathRelativeToRoot());
                file_put_contents($tmpPath, $contents);

                $pageCount = $pdf->setSourceFile($tmpPath);
                for ($i = 1; $i <= $pageCount; $i++) {
                    $templateId = $pdf->importPage($i);
                    $size = $pdf->getTemplateSize($templateId);
                    $pdf->AddPage($size['orientation'], [$size['width'], $size['height']]);
                    $pdf->useTemplate($templateId);
                }
            } catch (\Throwable $e) {
                $skipped[] = $sds->product_name;
                Log::warning('SDS merge: failed to import PDF', [
                    'location_id' => $location->id,
                    'sds_id' => $sds->id,
                    'product_name' => $sds->product_name,
                    'disk' => $media->disk,
                    'path' => $media->getPathRelativeToRoot(),
                    'error' => $e->getMessage(),
                ]);
            }
        }

        if ($pdf->PageNo() === 0) {
            foreach ($tempFiles as $tmp) {
                @unlink($tmp);
            }
            $msg = 'No PDF files could be merged.';
            if (!empty($skipped)) {
                $msg .= ' Skipped: ' . implode(', ', array_slice($skipped, 0, 5));
                if (count($skipped) > 5) {
                    $msg .= ' and ' . (count($skipped) - 5) . ' more';
                }
            }
            return redirect()->back()->with('error', $msg);
        }

        $filename = 'SDS_Register_' . preg_replace('/[^A-Za-z0-9_-]/', '_', $location->name) . '.pdf';
        $output = $pdf->Output($filename, 'S');

        foreach ($tempFiles as $tmp) {
            @unlink($tmp);
        }

        return response($output, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }
}
