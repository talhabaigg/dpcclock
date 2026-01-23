<?php

namespace App\Jobs;

use App\Models\DrawingSet;
use App\Models\QaStageDrawing;
use App\Models\TitleBlockTemplate;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;

/**
 * Job to process a drawing set:
 * 1. Render each PDF page to PNG at 300 DPI
 * 2. Upload PNGs to S3
 * 3. Capture page dimensions and orientation
 * 4. Dispatch extraction jobs for each sheet
 */
class ProcessDrawingSetJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 60;
    public int $timeout = 600; // 10 minutes for large PDFs

    public function __construct(
        public int $drawingSetId
    ) {}

    public function handle(): void
    {
        $drawingSet = DrawingSet::find($this->drawingSetId);

        if (!$drawingSet) {
            Log::error('Drawing set not found', ['id' => $this->drawingSetId]);
            return;
        }

        $drawingSet->update(['status' => DrawingSet::STATUS_PROCESSING]);

        try {
            // Download PDF from S3 to temp location
            $pdfContent = Storage::disk('s3')->get($drawingSet->original_pdf_s3_key);

            if (empty($pdfContent)) {
                throw new \RuntimeException('PDF content is empty - S3 download failed or file is empty');
            }

            // Validate PDF header (should start with %PDF-)
            if (!str_starts_with($pdfContent, '%PDF-')) {
                throw new \RuntimeException('Invalid PDF file - does not have PDF header');
            }

            $tempPdfPath = sys_get_temp_dir() . '/drawing_set_' . $drawingSet->id . '.pdf';
            file_put_contents($tempPdfPath, $pdfContent);

            // Verify file was written
            if (!file_exists($tempPdfPath) || filesize($tempPdfPath) === 0) {
                throw new \RuntimeException('Failed to write PDF to temp location');
            }

            Log::info('PDF downloaded for processing', [
                'drawing_set_id' => $drawingSet->id,
                'temp_path' => $tempPdfPath,
                'file_size' => filesize($tempPdfPath),
            ]);

            // Process each page
            $sheets = $drawingSet->sheets()->orderBy('page_number')->get();

            foreach ($sheets as $sheet) {
                $this->processPage($drawingSet, $sheet, $tempPdfPath);
            }

            // Clean up temp file
            if (file_exists($tempPdfPath)) {
                unlink($tempPdfPath);
            }

            // Update drawing set status
            $drawingSet->updateStatusFromSheets();

        } catch (\Exception $e) {
            Log::error('Failed to process drawing set', [
                'id' => $drawingSet->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            $drawingSet->update([
                'status' => DrawingSet::STATUS_FAILED,
                'processing_errors' => ['error' => $e->getMessage()],
            ]);

            throw $e;
        }
    }

    /**
     * Process a single page: render to PNG, upload, extract dimensions.
     */
    private function processPage(DrawingSet $drawingSet, QaStageDrawing $sheet, string $tempPdfPath): void
    {
        $pageNumber = $sheet->page_number;
        $tempOutputDir = sys_get_temp_dir() . '/drawing_set_' . $drawingSet->id . '_pages';

        if (!is_dir($tempOutputDir)) {
            mkdir($tempOutputDir, 0755, true);
        }

        try {
            // Render page to PNG using pdftoppm (Poppler)
            $outputPrefix = $tempOutputDir . '/page';
            $pngPath = $this->renderPageToPng($tempPdfPath, $pageNumber, $outputPrefix);

            if (!$pngPath || !file_exists($pngPath)) {
                throw new \RuntimeException("Failed to render page {$pageNumber} to PNG");
            }

            // Get image dimensions
            $dimensions = getimagesize($pngPath);
            if (!$dimensions) {
                throw new \RuntimeException("Failed to get dimensions for page {$pageNumber}");
            }

            $width = $dimensions[0];
            $height = $dimensions[1];
            $orientation = $width >= $height ? 'landscape' : 'portrait';
            $sizeBucket = TitleBlockTemplate::createSizeBucket($width, $height);

            // Upload PNG to S3
            $s3Key = 'drawing-previews/' . $drawingSet->project_id . '/' .
                     $drawingSet->id . '/page_' . str_pad($pageNumber, 4, '0', STR_PAD_LEFT) . '.png';

            Storage::disk('s3')->put($s3Key, file_get_contents($pngPath), [
                'ContentType' => 'image/png',
            ]);

            // Update sheet record
            $sheet->update([
                'page_preview_s3_key' => $s3Key,
                'page_width_px' => $width,
                'page_height_px' => $height,
                'page_orientation' => $orientation,
                'size_bucket' => $sizeBucket,
                'extraction_status' => QaStageDrawing::EXTRACTION_QUEUED,
            ]);

            // Clean up temp PNG
            if (file_exists($pngPath)) {
                unlink($pngPath);
            }

            // Dispatch extraction job
            ExtractSheetMetadataJob::dispatch($sheet->id);

        } catch (\Exception $e) {
            Log::error('Failed to process page', [
                'drawing_set_id' => $drawingSet->id,
                'page_number' => $pageNumber,
                'error' => $e->getMessage(),
            ]);

            $sheet->update([
                'extraction_status' => QaStageDrawing::EXTRACTION_FAILED,
                'extraction_errors' => ['processing_error' => $e->getMessage()],
            ]);
        }
    }

    /**
     * Render a specific PDF page to PNG using pdftoppm (Poppler).
     *
     * @param string $pdfPath Path to PDF file
     * @param int $pageNumber 1-based page number
     * @param string $outputPrefix Output path prefix
     * @return string|null Path to generated PNG
     */
    private function renderPageToPng(string $pdfPath, int $pageNumber, string $outputPrefix): ?string
    {
        // Try pdftoppm first (best quality)
        $result = $this->tryPdftoppm($pdfPath, $pageNumber, $outputPrefix);
        if ($result) {
            return $result;
        }

        // Fallback to ImageMagick/Ghostscript
        $result = $this->tryImageMagick($pdfPath, $pageNumber, $outputPrefix);
        if ($result) {
            return $result;
        }

        // Last resort: Imagick PHP extension
        return $this->tryImagickExtension($pdfPath, $pageNumber, $outputPrefix);
    }

    /**
     * Render using pdftoppm (Poppler utils).
     */
    private function tryPdftoppm(string $pdfPath, int $pageNumber, string $outputPrefix): ?string
    {
        // Find pdftoppm executable
        $pdftoppm = $this->findPdftoppm();
        if (!$pdftoppm) {
            return null;
        }

        // pdftoppm uses 1-based page numbers
        // -r 300 = 300 DPI, -png = PNG output, -f/-l = first/last page
        $command = sprintf(
            '%s -r 300 -png -f %d -l %d %s %s',
            escapeshellarg($pdftoppm),
            $pageNumber,
            $pageNumber,
            escapeshellarg($pdfPath),
            escapeshellarg($outputPrefix)
        );

        $result = Process::timeout(120)->run($command);

        if (!$result->successful()) {
            Log::warning('pdftoppm failed', [
                'command' => $command,
                'output' => $result->output(),
                'error' => $result->errorOutput(),
            ]);
            return null;
        }

        // pdftoppm creates files like: outputPrefix-01.png or outputPrefix-1.png
        $possibleFiles = [
            $outputPrefix . '-' . $pageNumber . '.png',
            $outputPrefix . '-' . str_pad($pageNumber, 2, '0', STR_PAD_LEFT) . '.png',
            $outputPrefix . '-' . str_pad($pageNumber, 3, '0', STR_PAD_LEFT) . '.png',
        ];

        foreach ($possibleFiles as $file) {
            if (file_exists($file)) {
                return $file;
            }
        }

        // Try glob as fallback
        $files = glob($outputPrefix . '-*.png');
        if (!empty($files)) {
            return $files[0];
        }

        return null;
    }

    /**
     * Find pdftoppm executable path.
     */
    private function findPdftoppm(): ?string
    {
        // Check common Windows installation paths
        $windowsPaths = [
            'C:\\poppler\\poppler-24.08.0\\Library\\bin\\pdftoppm.exe',
            'C:\\poppler\\Library\\bin\\pdftoppm.exe',
            'C:\\Program Files\\poppler\\Library\\bin\\pdftoppm.exe',
        ];

        foreach ($windowsPaths as $path) {
            if (file_exists($path)) {
                return $path;
            }
        }

        // Check if in PATH (Linux/Mac or Windows with PATH configured)
        $checkResult = Process::run(PHP_OS_FAMILY === 'Windows' ? 'where pdftoppm 2>nul' : 'which pdftoppm 2>/dev/null');
        if ($checkResult->successful()) {
            $output = trim($checkResult->output());
            if ($output && file_exists($output)) {
                return $output;
            }
            // On Windows, 'where' might return the command name if found
            if (PHP_OS_FAMILY === 'Windows' && $output) {
                return 'pdftoppm';
            }
        }

        // Check configurable path from env
        $envPath = config('services.textract.pdftoppm_path');
        if ($envPath && file_exists($envPath)) {
            return $envPath;
        }

        return null;
    }

    /**
     * Render using ImageMagick convert command.
     */
    private function tryImageMagick(string $pdfPath, int $pageNumber, string $outputPrefix): ?string
    {
        // Check if convert is available
        $checkResult = Process::run(PHP_OS_FAMILY === 'Windows' ? 'where magick 2>nul' : 'which convert 2>/dev/null');
        if (!$checkResult->successful()) {
            return null;
        }

        $outputPath = $outputPrefix . '-' . $pageNumber . '.png';

        // ImageMagick uses 0-based page index in brackets
        $command = sprintf(
            'convert -density 300 %s[%d] -quality 90 %s',
            escapeshellarg($pdfPath),
            $pageNumber - 1, // 0-based index
            escapeshellarg($outputPath)
        );

        $result = Process::timeout(120)->run($command);

        if ($result->successful() && file_exists($outputPath)) {
            return $outputPath;
        }

        Log::warning('ImageMagick convert failed', [
            'command' => $command,
            'error' => $result->errorOutput(),
        ]);

        return null;
    }

    /**
     * Render using Imagick PHP extension.
     */
    private function tryImagickExtension(string $pdfPath, int $pageNumber, string $outputPrefix): ?string
    {
        if (!extension_loaded('imagick')) {
            return null;
        }

        try {
            $imagick = new \Imagick();
            $imagick->setResolution(300, 300);
            $imagick->readImage($pdfPath . '[' . ($pageNumber - 1) . ']'); // 0-based index
            $imagick->setImageFormat('png');
            $imagick->setImageCompressionQuality(90);

            $outputPath = $outputPrefix . '-' . $pageNumber . '.png';
            $imagick->writeImage($outputPath);
            $imagick->clear();
            $imagick->destroy();

            if (file_exists($outputPath)) {
                return $outputPath;
            }
        } catch (\Exception $e) {
            Log::warning('Imagick extension failed', [
                'error' => $e->getMessage(),
            ]);
        }

        return null;
    }

    /**
     * Handle job failure.
     */
    public function failed(\Throwable $exception): void
    {
        Log::error('ProcessDrawingSetJob failed permanently', [
            'drawing_set_id' => $this->drawingSetId,
            'error' => $exception->getMessage(),
        ]);

        $drawingSet = DrawingSet::find($this->drawingSetId);
        if ($drawingSet) {
            $drawingSet->update([
                'status' => DrawingSet::STATUS_FAILED,
                'processing_errors' => [
                    'error' => $exception->getMessage(),
                    'failed_at' => now()->toIso8601String(),
                ],
            ]);
        }
    }
}
