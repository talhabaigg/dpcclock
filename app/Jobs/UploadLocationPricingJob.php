<?php

namespace App\Jobs;

use App\Models\Location;
use App\Models\MaterialItem;
use App\Models\MaterialItemPriceListUpload;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

class UploadLocationPricingJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     *
     * @var int
     */
    public $tries;

    /**
     * The number of seconds the job can run before timing out.
     *
     * @var int
     */
    public $timeout;

    /**
     * @var string
     */
    protected $filePath;

    /**
     * @var string
     */
    protected $uploadedFileName;

    /**
     * @var int
     */
    protected $userId;

    /**
     * Create a new job instance.
     */
    public function __construct(string $filePath, string $uploadedFileName, int $userId)
    {
        $this->filePath = $filePath;
        $this->uploadedFileName = $uploadedFileName;
        $this->userId = $userId;
        $this->tries = config('premier.jobs.retry_times', 3);
        $this->timeout = config('premier.jobs.timeout', 600);
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $startTime = now();
        Log::info('UploadLocationPricingJob: Job started', [
            'file' => $this->uploadedFileName,
            'user_id' => $this->userId
        ]);

        try {
            // Read and parse the CSV file
            $rows = array_map('str_getcsv', file($this->filePath));
            $header = array_map('trim', array_shift($rows));

            // Remove BOM if present
            $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0]);

            $totalRows = count($rows);
            Log::info('UploadLocationPricingJob: CSV parsed', [
                'total_rows' => $totalRows,
                'headers' => $header
            ]);

            $stats = [
                'empty' => 0,
                'malformed' => 0,
                'duplicate' => 0,
                'failed_lookup' => 0,
                'processed' => 0,
            ];

            $seen = [];
            $dataToInsert = [];
            $locationIds = [];
            $failedRows = [];

            // Preload locations and materials for efficient lookup
            Log::info('UploadLocationPricingJob: Loading reference data');
            $locationsData = Location::select('id', 'external_id')->get()->keyBy('external_id');
            $materials = MaterialItem::select('id', 'code')->get()->keyBy('code');
            Log::info('UploadLocationPricingJob: Reference data loaded', [
                'locations_count' => $locationsData->count(),
                'materials_count' => $materials->count()
            ]);

            // Process each row
            foreach ($rows as $rowIndex => $row) {
                // Skip empty rows
                if (count($row) === 1 && trim((string) $row[0]) === '') {
                    $stats['empty']++;
                    Log::debug('UploadLocationPricingJob: Empty row skipped', ['row' => $rowIndex + 2]);
                    continue;
                }

                // Check for malformed rows (column count mismatch)
                if (count($row) !== count($header)) {
                    $stats['malformed']++;
                    $failedRows[] = $row;
                    Log::warning('UploadLocationPricingJob: Malformed row', [
                        'row' => $rowIndex + 2,
                        'expected_columns' => count($header),
                        'actual_columns' => count($row)
                    ]);
                    continue;
                }

                $data = array_combine($header, $row);

                // Lookup location and material
                $location = $locationsData->get($data['location_id'] ?? null);
                $material = $materials->get($data['code'] ?? null);

                if (!$location || !$material) {
                    $stats['failed_lookup']++;
                    $failedRows[] = $row;
                    Log::warning('UploadLocationPricingJob: Lookup failed', [
                        'row' => $rowIndex + 2,
                        'location_id' => $data['location_id'] ?? 'missing',
                        'code' => $data['code'] ?? 'missing',
                        'location_found' => !is_null($location),
                        'material_found' => !is_null($material)
                    ]);
                    continue;
                }

                // Check for duplicates within the file
                $key = $location->id . '-' . $material->id;
                if (isset($seen[$key])) {
                    $stats['duplicate']++;
                    Log::debug('UploadLocationPricingJob: Duplicate row skipped', [
                        'row' => $rowIndex + 2,
                        'location_id' => $location->id,
                        'material_id' => $material->id
                    ]);
                    continue;
                }
                $seen[$key] = true;
                $locationIds[] = $location->id;

                $dataToInsert[] = [
                    'location_id' => $location->id,
                    'material_item_id' => $material->id,
                    'unit_cost_override' => floatval($data['unit_cost'] ?? 0),
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }

            $stats['processed'] = count($dataToInsert);
            $totalFailed = $stats['malformed'] + $stats['failed_lookup'];

            Log::info('UploadLocationPricingJob: Processing complete', [
                'total_rows' => $totalRows,
                'empty_rows' => $stats['empty'],
                'processed_rows' => $stats['processed'],
                'failed_rows' => $totalFailed,
                'malformed_rows' => $stats['malformed'],
                'failed_lookup_rows' => $stats['failed_lookup'],
                'duplicate_rows' => $stats['duplicate'],
                'validation' => [
                    'total_equals_processed_plus_failed' => ($totalRows - $stats['empty']) === ($stats['processed'] + $totalFailed + $stats['duplicate']),
                    'calculation' => sprintf(
                        '%d (total - empty) = %d (processed) + %d (failed) + %d (duplicate)',
                        $totalRows - $stats['empty'],
                        $stats['processed'],
                        $totalFailed,
                        $stats['duplicate']
                    )
                ]
            ]);

            // Get unique location IDs and deduplicate dataToInsert
            $uniqueLocationIds = array_unique($locationIds);
            $dataToInsert = collect($dataToInsert)
                ->unique(fn($item) => $item['location_id'] . '-' . $item['material_item_id'])
                ->values()
                ->toArray();

            Log::info('UploadLocationPricingJob: Starting database transaction', [
                'unique_locations' => count($uniqueLocationIds),
                'records_to_insert' => count($dataToInsert)
            ]);

            // Perform database transaction
            DB::transaction(function () use ($uniqueLocationIds, $dataToInsert) {
                // Delete old pricing only for relevant locations
                $deletedCount = DB::table('location_item_pricing')
                    ->whereIn('location_id', $uniqueLocationIds)
                    ->delete();

                Log::info('UploadLocationPricingJob: Old pricing deleted', [
                    'deleted_count' => $deletedCount
                ]);

                // Insert new pricing in chunks to avoid memory issues
                $batchSize = config('premier.jobs.batch_size', 1000);
                $chunks = array_chunk($dataToInsert, $batchSize);

                foreach ($chunks as $index => $chunk) {
                    DB::table('location_item_pricing')->insert($chunk);
                    Log::info('UploadLocationPricingJob: Batch inserted', [
                        'batch' => $index + 1,
                        'total_batches' => count($chunks),
                        'rows_in_batch' => count($chunk)
                    ]);
                }
            });

            Log::info('UploadLocationPricingJob: Database transaction complete');

            // Handle failed rows
            $s3FailedUrl = null;
            $failedFilePath = null;

            if (!empty($failedRows)) {
                Log::info('UploadLocationPricingJob: Processing failed rows', [
                    'failed_count' => count($failedRows)
                ]);

                $filename = 'failed_location_pricing_' . now()->format('Ymd_His') . '.csv';
                $localFilePath = storage_path("app/{$filename}");

                $handle = fopen($localFilePath, 'w');
                fputcsv($handle, $header);
                foreach ($failedRows as $failedRow) {
                    fputcsv($handle, $failedRow);
                }
                fclose($handle);

                // Save the file to S3
                $s3Path = "location_pricing/failed/{$filename}";
                Storage::disk('s3')->put($s3Path, file_get_contents($localFilePath));

                // Delete the local file after uploading to S3
                unlink($localFilePath);

                $s3FailedUrl = Storage::disk('s3')->url($s3Path);
                $failedFilePath = $s3Path;

                Log::info('UploadLocationPricingJob: Failed rows file uploaded to S3', [
                    's3_path' => $s3Path
                ]);
            }

            // Get the first location for the upload record (use the first processed location)
            $firstLocationId = !empty($uniqueLocationIds) ? $uniqueLocationIds[0] : null;

            // Create upload record
            $priceList = MaterialItemPriceListUpload::create([
                'location_id' => $firstLocationId,
                'upload_file_path' => 'location_pricing/uploads/' . $this->uploadedFileName,
                'failed_file_path' => $failedFilePath,
                'status' => 'success',
                'total_rows' => $totalRows - $stats['empty'], // Exclude empty rows from total
                'processed_rows' => $stats['processed'],
                'failed_rows' => $totalFailed,
                'created_by' => $this->userId,
            ]);

            if (!$priceList) {
                Log::error('UploadLocationPricingJob: Failed to create MaterialItemPriceListUpload record', [
                    'file' => $this->uploadedFileName
                ]);
            } else {
                Log::info('UploadLocationPricingJob: Upload record created', [
                    'record_id' => $priceList->id
                ]);
            }

            $duration = now()->diffInSeconds($startTime);
            Log::info('UploadLocationPricingJob: Job completed successfully', [
                'processed_rows' => $stats['processed'],
                'failed_rows' => $totalFailed,
                'duration_seconds' => $duration,
                'has_failed_file' => !is_null($s3FailedUrl)
            ]);

            // Store result data for controller access (optional)
            cache()->put(
                "location_pricing_upload_{$this->uploadedFileName}",
                [
                    'processed' => $stats['processed'],
                    'failed' => $totalFailed,
                    'failed_url' => $s3FailedUrl,
                    'status' => 'success'
                ],
                now()->addMinutes(30)
            );

            // Clean up temporary file after successful processing
            if (file_exists($this->filePath)) {
                unlink($this->filePath);
                Log::info('UploadLocationPricingJob: Temporary file deleted', [
                    'file_path' => $this->filePath
                ]);
            }

        } catch (Throwable $e) {
            Log::error('UploadLocationPricingJob: Job failed', [
                'file' => $this->uploadedFileName,
                'user_id' => $this->userId,
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString()
            ]);

            // Create failed upload record
            try {
                MaterialItemPriceListUpload::create([
                    'location_id' => null,
                    'upload_file_path' => 'location_pricing/uploads/' . $this->uploadedFileName,
                    'failed_file_path' => null,
                    'status' => 'failed',
                    'total_rows' => 0,
                    'processed_rows' => 0,
                    'failed_rows' => 0,
                    'created_by' => $this->userId,
                ]);

                cache()->put(
                    "location_pricing_upload_{$this->uploadedFileName}",
                    [
                        'status' => 'failed',
                        'error' => $e->getMessage()
                    ],
                    now()->addMinutes(30)
                );
            } catch (Throwable $dbError) {
                Log::error('UploadLocationPricingJob: Failed to create error record', [
                    'error' => $dbError->getMessage()
                ]);
            }

            // Clean up temporary file even on failure
            if (file_exists($this->filePath)) {
                unlink($this->filePath);
                Log::info('UploadLocationPricingJob: Temporary file deleted after error', [
                    'file_path' => $this->filePath
                ]);
            }

            throw $e;
        }
    }

    /**
     * Handle a job failure.
     */
    public function failed(Throwable $exception): void
    {
        Log::error('UploadLocationPricingJob: Job failed permanently after all retries', [
            'file' => $this->uploadedFileName,
            'user_id' => $this->userId,
            'error' => $exception->getMessage(),
            'attempts' => $this->attempts()
        ]);

        // Update cache with permanent failure status
        cache()->put(
            "location_pricing_upload_{$this->uploadedFileName}",
            [
                'status' => 'failed_permanently',
                'error' => $exception->getMessage()
            ],
            now()->addHours(24)
        );

        // Clean up temporary file after permanent failure
        if (file_exists($this->filePath)) {
            unlink($this->filePath);
            Log::info('UploadLocationPricingJob: Temporary file deleted after permanent failure', [
                'file_path' => $this->filePath
            ]);
        }

        // Here you could send notifications to administrators
        // Example: notify(new JobFailedNotification($exception));
    }

    /**
     * Calculate the number of seconds to wait before retrying the job.
     */
    public function backoff(): array
    {
        // Exponential backoff: 1 minute, 2 minutes, 4 minutes
        return [60, 120, 240];
    }
}
