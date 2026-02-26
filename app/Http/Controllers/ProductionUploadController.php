<?php

namespace App\Http\Controllers;

use App\Models\Location;
use App\Models\ProductionUpload;
use App\Models\ProductionUploadLine;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class ProductionUploadController extends Controller
{
    /**
     * Column mapping: 0-indexed positions in the CSV row.
     */
    private const COLUMN_MAP = [
        'area'               => 22,
        'code_description'   => 23,
        'est_hours'          => 24,
        'percent_complete'   => 25,
        'earned_hours'       => 26,
        'used_hours'         => 27,
        'actual_variance'    => 28,
        'remaining_hours'    => 29,
        'cost_code'          => 35,
        'projected_hours'    => 44,
        'projected_variance' => 45,
    ];

    private const MIN_COLUMNS = 46;

    /**
     * Display the production data tab (Inertia page).
     */
    public function index(Location $location)
    {
        $location = app(LocationController::class)->getLocationWithCounts($location);

        $uploads = $location->productionUploads()
            ->with('uploader:id,name')
            ->orderByDesc('report_date')
            ->orderByDesc('created_at')
            ->get();

        return Inertia::render('locations/production-data', [
            'location' => $location,
            'uploads' => $uploads,
        ]);
    }

    /**
     * Preview a production CSV file without saving (JSON API).
     */
    public function preview(Request $request, Location $location)
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt',
        ]);

        $parsed = $this->parseCsv($request->file('file')->getRealPath());

        if (empty($parsed['rows'])) {
            return response()->json([
                'success' => false,
                'message' => 'No valid data rows found in the CSV file.',
            ], 422);
        }

        return response()->json([
            'rows' => $parsed['rows'],
            'summary' => $this->computeSummary($parsed['rows']),
            'error_rows' => count($parsed['errors']),
            'errors' => $parsed['errors'],
        ]);
    }

    /**
     * Upload and parse a production CSV file (JSON API).
     */
    public function upload(Request $request, Location $location)
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt',
            'report_date' => 'required|date',
        ]);

        $file = $request->file('file');
        $originalFilename = $file->getClientOriginalName();

        // Store original file to S3
        $s3Path = "production_uploads/{$location->id}/" . time() . "_{$originalFilename}";
        Storage::disk('s3')->put($s3Path, file_get_contents($file->getRealPath()));

        $parsed = $this->parseCsv($file->getRealPath());

        if (empty($parsed['rows'])) {
            return response()->json([
                'success' => false,
                'message' => 'No valid data rows found in the CSV file.',
            ], 422);
        }

        $rows = $parsed['rows'];
        $skipped = $parsed['skipped'];
        $errors = $parsed['errors'];

        // Insert in a transaction
        $upload = DB::transaction(function () use ($location, $originalFilename, $s3Path, $request, $rows, $skipped, $errors) {
            $upload = ProductionUpload::create([
                'location_id' => $location->id,
                'original_filename' => $originalFilename,
                's3_path' => $s3Path,
                'report_date' => $request->input('report_date'),
                'total_rows' => count($rows),
                'skipped_rows' => $skipped,
                'error_rows' => count($errors),
                'status' => 'completed',
                'error_summary' => !empty($errors) ? $errors : null,
                'uploaded_by' => auth()->id(),
            ]);

            // Bulk insert in chunks of 500
            foreach (array_chunk($rows, 500) as $chunk) {
                $insertData = array_map(function ($row) use ($upload) {
                    return array_merge($row, [
                        'production_upload_id' => $upload->id,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }, $chunk);

                DB::table('production_upload_lines')->insert($insertData);
            }

            return $upload;
        });

        return response()->json([
            'success' => true,
            'upload_id' => $upload->id,
            'total_rows' => count($rows),
            'skipped_rows' => $skipped,
            'error_rows' => count($errors),
            'errors' => $errors,
        ]);
    }

    /**
     * Show upload detail with lines (JSON API).
     */
    public function show(Location $location, ProductionUpload $upload)
    {
        abort_if($upload->location_id !== $location->id, 404);

        return response()->json([
            'upload' => $upload,
            'lines' => $upload->lines()->get(),
        ]);
    }

    /**
     * Soft-delete an upload (JSON API).
     */
    public function destroy(Location $location, ProductionUpload $upload)
    {
        abort_if($upload->location_id !== $location->id, 404);

        $upload->delete();

        return response()->json(['success' => true]);
    }

    /**
     * Parse a CSV file and return rows, skipped count, and errors.
     */
    private function parseCsv(string $filePath): array
    {
        $handle = fopen($filePath, 'r');
        $rows = [];
        $skipped = 0;
        $errors = [];
        $rowNum = 0;

        while (($csvRow = fgetcsv($handle)) !== false) {
            $rowNum++;

            if (count($csvRow) < self::MIN_COLUMNS) {
                $skipped++;
                $errors[] = [
                    'row' => $rowNum,
                    'reason' => 'Insufficient columns (found ' . count($csvRow) . ', need ' . self::MIN_COLUMNS . ')',
                ];
                continue;
            }

            $area = trim($csvRow[self::COLUMN_MAP['area']] ?? '');
            $codeDescription = trim($csvRow[self::COLUMN_MAP['code_description']] ?? '');

            // Filter: subtotal/summary rows without area or code_description
            if ($area === '' || $codeDescription === '') {
                continue;
            }

            $rows[] = [
                'area' => $area,
                'code_description' => $codeDescription,
                'cost_code' => trim($csvRow[self::COLUMN_MAP['cost_code']] ?? ''),
                'est_hours' => $this->parseNumeric($csvRow[self::COLUMN_MAP['est_hours']] ?? ''),
                'percent_complete' => $this->parseNumeric($csvRow[self::COLUMN_MAP['percent_complete']] ?? ''),
                'earned_hours' => $this->parseNumeric($csvRow[self::COLUMN_MAP['earned_hours']] ?? ''),
                'used_hours' => $this->parseNumeric($csvRow[self::COLUMN_MAP['used_hours']] ?? ''),
                'actual_variance' => $this->parseNumeric($csvRow[self::COLUMN_MAP['actual_variance']] ?? ''),
                'remaining_hours' => $this->parseNumeric($csvRow[self::COLUMN_MAP['remaining_hours']] ?? ''),
                'projected_hours' => $this->parseNumeric($csvRow[self::COLUMN_MAP['projected_hours']] ?? ''),
                'projected_variance' => $this->parseNumeric($csvRow[self::COLUMN_MAP['projected_variance']] ?? ''),
            ];
        }

        fclose($handle);

        return ['rows' => $rows, 'skipped' => $skipped, 'errors' => $errors];
    }

    /**
     * Compute summary totals from parsed rows.
     */
    private function computeSummary(array $rows): array
    {
        $totalEstHours = array_sum(array_column($rows, 'est_hours'));
        $totalEarnedHours = array_sum(array_column($rows, 'earned_hours'));

        return [
            'total_rows' => count($rows),
            'total_est_hours' => $totalEstHours,
            'total_earned_hours' => $totalEarnedHours,
            'total_used_hours' => array_sum(array_column($rows, 'used_hours')),
            'percent_complete' => $totalEstHours > 0
                ? round(($totalEarnedHours / $totalEstHours) * 100, 1)
                : 0,
            'total_actual_variance' => array_sum(array_column($rows, 'actual_variance')),
            'remaining_hours' => round($totalEstHours - $totalEarnedHours, 2),
            'total_projected_hours' => array_sum(array_column($rows, 'projected_hours')),
            'total_projected_variance' => array_sum(array_column($rows, 'projected_variance')),
        ];
    }

    /**
     * Parse a numeric value from the CSV.
     * Handles: commas (1,593 → 1593), parenthetical negatives ((93) → -93), percentage signs (34% → 34).
     */
    private function parseNumeric(string $value): float
    {
        $v = trim(str_replace([',', '%'], '', $value));

        // Handle parenthetical negatives: (93) → -93
        if (preg_match('/^\((.+)\)$/', $v, $m)) {
            return -(float) $m[1];
        }

        return is_numeric($v) ? (float) $v : 0.0;
    }
}
