<?php

namespace App\Services;

use App\Models\Drawing;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class DrawingProcessingService
{
    protected string $storageDisk;

    protected string $thumbnailDir = 'qa-drawing-thumbnails';

    protected string $diffDir = 'qa-drawing-diffs';

    protected array $tempFiles = [];

    public function __construct()
    {
        $this->storageDisk = config('filesystems.drawings_disk', 'public');
    }

    /**
     * Process a newly uploaded drawing:
     * - Generate thumbnail
     * - Extract page dimensions
     * - Generate diff if previous revision exists
     */
    public function processDrawing(Drawing $drawing): array
    {
        $results = [
            'thumbnail' => false,
            'dimensions' => false,
            'diff' => false,
            'errors' => [],
        ];

        try {
            // Update status to processing
            $drawing->update(['status' => Drawing::STATUS_PROCESSING]);

            // Get the full file path (downloads from S3 to temp if needed)
            $storagePath = $drawing->storage_path ?? $drawing->file_path;
            $filePath = $this->resolveLocalPath($storagePath);

            if (! $filePath || ! file_exists($filePath)) {
                throw new \Exception("Drawing file not found: {$storagePath}");
            }

            // Generate thumbnail
            $thumbnailResult = $this->generateThumbnail($drawing, $filePath);
            $results['thumbnail'] = $thumbnailResult['success'];
            if (! $thumbnailResult['success']) {
                $results['errors'][] = $thumbnailResult['error'];
            }

            // Extract page dimensions
            $dimensionsResult = $this->extractPageDimensions($drawing, $filePath);
            $results['dimensions'] = $dimensionsResult['success'];
            if (! $dimensionsResult['success']) {
                $results['errors'][] = $dimensionsResult['error'];
            }

            // Generate diff with previous revision if exists
            if ($drawing->previous_revision_id) {
                $diffResult = $this->generateDiff($drawing);
                $results['diff'] = $diffResult['success'];
                if (! $diffResult['success']) {
                    $results['errors'][] = $diffResult['error'];
                }
            }

            // Update status based on results
            $newStatus = empty($results['errors'])
                ? Drawing::STATUS_ACTIVE
                : Drawing::STATUS_DRAFT; // Stay in draft if processing failed

            $drawing->update(['status' => $newStatus]);

        } catch (\Exception $e) {
            Log::error('Drawing processing failed', [
                'drawing_id' => $drawing->id,
                'error' => $e->getMessage(),
            ]);
            $results['errors'][] = $e->getMessage();
            $drawing->update(['status' => Drawing::STATUS_DRAFT]);
        } finally {
            $this->cleanupTempFiles();
        }

        return $results;
    }

    /**
     * Generate a thumbnail for the drawing (first page)
     */
    public function generateThumbnail(Drawing $drawing, ?string $filePath = null): array
    {
        $filePath = $filePath ?? $this->resolveLocalPath($drawing->storage_path ?? $drawing->file_path);

        try {
            $isPdf = Str::lower(pathinfo($filePath, PATHINFO_EXTENSION)) === 'pdf';

            $thumbnailFilename = "{$drawing->id}_thumb.png";
            $thumbnailPath = "{$this->thumbnailDir}/{$thumbnailFilename}";

            // Always generate to a temp file first
            $tempThumbnail = sys_get_temp_dir().'/thumb_'.$drawing->id.'_'.uniqid().'.png';

            if ($isPdf) {
                $success = $this->pdfToImage($filePath, $tempThumbnail, 1, 1200);
            } else {
                $success = $this->resizeImage($filePath, $tempThumbnail, 1200);
            }

            if ($success && file_exists($tempThumbnail)) {
                // Upload to the configured disk
                $this->storeProcessedFile($tempThumbnail, $thumbnailPath);

                $updateData = ['thumbnail_path' => $thumbnailPath];
                if ($this->isS3()) {
                    $updateData['thumbnail_s3_key'] = $thumbnailPath;
                }
                $drawing->update($updateData);

                @unlink($tempThumbnail);

                return ['success' => true, 'path' => $thumbnailPath];
            }

            @unlink($tempThumbnail);

            return ['success' => false, 'error' => 'Failed to generate thumbnail'];

        } catch (\Exception $e) {
            Log::error('Thumbnail generation failed', [
                'drawing_id' => $drawing->id,
                'error' => $e->getMessage(),
            ]);

            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Extract page dimensions from a file path (without requiring a model).
     * Use this when processing a file before creating the drawing model.
     */
    public function extractPageDimensionsFromPath(string $filePath): array
    {
        try {
            $isPdf = Str::lower(pathinfo($filePath, PATHINFO_EXTENSION)) === 'pdf';

            $dimensions = [
                'pages' => 1,
                'width' => null,
                'height' => null,
            ];

            if ($isPdf) {
                // Try to get PDF info using pdfinfo or by parsing PDF
                $pdfInfo = $this->getPdfInfo($filePath);
                if ($pdfInfo) {
                    $dimensions = array_merge($dimensions, $pdfInfo);
                }
            } else {
                // For images, get dimensions directly
                $imageInfo = @getimagesize($filePath);
                if ($imageInfo) {
                    $dimensions['width'] = $imageInfo[0];
                    $dimensions['height'] = $imageInfo[1];
                }
            }

            return $dimensions;

        } catch (\Exception $e) {
            Log::error('Dimension extraction failed', [
                'file_path' => $filePath,
                'error' => $e->getMessage(),
            ]);

            return [
                'pages' => 1,
                'width' => null,
                'height' => null,
            ];
        }
    }

    /**
     * Extract page dimensions from PDF and update the drawing model.
     */
    public function extractPageDimensions(Drawing $drawing, ?string $filePath = null): array
    {
        $filePath = $filePath ?? $this->resolveLocalPath($drawing->storage_path ?? $drawing->file_path);

        try {
            $dimensions = $this->extractPageDimensionsFromPath($filePath);

            $drawing->update(['page_dimensions' => $dimensions]);

            return ['success' => true, 'dimensions' => $dimensions];

        } catch (\Exception $e) {
            Log::error('Dimension extraction failed', [
                'drawing_id' => $drawing->id,
                'error' => $e->getMessage(),
            ]);

            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Generate a diff image between this drawing and its previous revision
     */
    public function generateDiff(Drawing $drawing): array
    {
        if (! $drawing->previous_revision_id) {
            return ['success' => false, 'error' => 'No previous revision to compare'];
        }

        try {
            $previousRevision = Drawing::find($drawing->previous_revision_id);
            if (! $previousRevision) {
                return ['success' => false, 'error' => 'Previous revision not found'];
            }

            $diffFilename = "{$drawing->id}_diff_{$previousRevision->id}.png";
            $diffPath = "{$this->diffDir}/{$diffFilename}";

            // Resolve both files to local paths (downloads from S3 if needed)
            $currentPath = $this->resolveLocalPath($drawing->storage_path ?? $drawing->file_path);
            $previousPath = $this->resolveLocalPath($previousRevision->storage_path ?? $previousRevision->file_path);

            if (! $currentPath || ! $previousPath) {
                return ['success' => false, 'error' => 'Could not resolve drawing files for comparison'];
            }

            // Convert PDFs to images first if needed
            $currentImage = $this->getFirstPageImage($currentPath);
            $previousImage = $this->getFirstPageImage($previousPath);

            if (! $currentImage || ! $previousImage) {
                return ['success' => false, 'error' => 'Could not convert PDFs to images for comparison'];
            }

            // Generate the diff to a temp file
            $tempDiff = sys_get_temp_dir().'/diff_'.$drawing->id.'_'.uniqid().'.png';
            $success = $this->compareImages($previousImage, $currentImage, $tempDiff);

            // Clean up temp image conversions
            if ($currentImage !== $currentPath && file_exists($currentImage)) {
                @unlink($currentImage);
            }
            if ($previousImage !== $previousPath && file_exists($previousImage)) {
                @unlink($previousImage);
            }

            if ($success && file_exists($tempDiff)) {
                $this->storeProcessedFile($tempDiff, $diffPath);
                $drawing->update(['diff_image_path' => $diffPath]);
                @unlink($tempDiff);

                return ['success' => true, 'path' => $diffPath];
            }

            @unlink($tempDiff);

            return ['success' => false, 'error' => 'Failed to generate diff image'];

        } catch (\Exception $e) {
            Log::error('Diff generation failed', [
                'drawing_id' => $drawing->id,
                'error' => $e->getMessage(),
            ]);

            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Resolve a storage path to a local file path.
     * For local disk, returns the filesystem path directly.
     * For S3, downloads to a temp file and returns the temp path.
     */
    protected function resolveLocalPath(string $storagePath): ?string
    {
        if (! $this->isS3()) {
            $localPath = Storage::disk($this->storageDisk)->path($storagePath);

            return file_exists($localPath) ? $localPath : null;
        }

        // S3: download to temp
        try {
            if (! Storage::disk('s3')->exists($storagePath)) {
                Log::warning('File not found on S3', ['path' => $storagePath]);

                return null;
            }

            $extension = pathinfo($storagePath, PATHINFO_EXTENSION) ?: 'pdf';
            $tempPath = sys_get_temp_dir().'/drawing_'.md5($storagePath).'_'.uniqid().'.'.$extension;

            $content = Storage::disk('s3')->get($storagePath);
            file_put_contents($tempPath, $content);

            $this->tempFiles[] = $tempPath;

            return $tempPath;
        } catch (\Exception $e) {
            Log::error('Failed to download from S3', [
                'path' => $storagePath,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Store a locally-generated file to the configured disk.
     * For local disk, copies the file into storage.
     * For S3, uploads the file.
     */
    protected function storeProcessedFile(string $localPath, string $targetPath): void
    {
        Storage::disk($this->storageDisk)->put(
            $targetPath,
            file_get_contents($localPath)
        );
    }

    protected function isS3(): bool
    {
        return $this->storageDisk === 's3';
    }

    /**
     * Clean up any temp files downloaded during processing.
     */
    protected function cleanupTempFiles(): void
    {
        foreach ($this->tempFiles as $tempFile) {
            if (file_exists($tempFile)) {
                @unlink($tempFile);
            }
        }
        $this->tempFiles = [];
    }

    /**
     * Convert PDF first page to image
     *
     * @param  int  $maxWidth  Maximum width of output image (default 1200 for good AI text recognition)
     */
    protected function pdfToImage(string $pdfPath, string $outputPath, int $page = 1, int $maxWidth = 1200): bool
    {
        // Use higher DPI for larger output sizes
        $dpi = $maxWidth >= 1000 ? 200 : 150;

        // Try Imagick extension first
        if (extension_loaded('imagick')) {
            try {
                $imagick = new \Imagick;
                $imagick->setResolution($dpi, $dpi);
                $imagick->readImage($pdfPath.'['.($page - 1).']');

                // Flatten transparency to white background (prevents black background)
                $imagick->setImageBackgroundColor('white');
                $imagick->setImageAlphaChannel(\Imagick::ALPHACHANNEL_REMOVE);

                $imagick->setImageFormat('png');
                $imagick->thumbnailImage($maxWidth, 0);
                $imagick->writeImage($outputPath);
                $imagick->clear();
                $imagick->destroy();

                return true;
            } catch (\Exception $e) {
                Log::warning('Imagick PDF conversion failed', ['error' => $e->getMessage()]);
            }
        }

        // Try pdftoppm (poppler-utils)
        $pdftoppm = $this->findExecutable(['pdftoppm']);
        if ($pdftoppm) {
            $tempBase = sys_get_temp_dir().'/pdf_'.uniqid();
            $cmd = escapeshellarg($pdftoppm).' -png -f '.$page.' -l '.$page.' -scale-to '.$maxWidth.' '
                .escapeshellarg($pdfPath).' '.escapeshellarg($tempBase);
            exec($cmd.' 2>&1', $output, $returnCode);

            $tempFile = $tempBase.'-'.$page.'.png';
            if ($returnCode === 0 && file_exists($tempFile)) {
                rename($tempFile, $outputPath);

                return true;
            }
            // Clean up potential temp files
            @unlink($tempFile);
            @unlink($tempBase.'.png');
        }

        // Try ImageMagick convert
        $convert = $this->findExecutable(['magick', 'convert']);
        if ($convert) {
            $cmd = escapeshellarg($convert).' -density '.$dpi.' '
                .escapeshellarg($pdfPath.'['.($page - 1).']')
                .' -background white -alpha remove -resize '.$maxWidth.'x -quality 90 '
                .escapeshellarg($outputPath);
            Log::debug('ImageMagick command', ['cmd' => $cmd]);
            exec($cmd.' 2>&1', $output, $returnCode);

            if ($returnCode === 0 && file_exists($outputPath)) {
                return true;
            }
            Log::warning('ImageMagick conversion failed', ['returnCode' => $returnCode, 'output' => $output]);
        }

        // Try Ghostscript
        $gs = $this->findExecutable(['gs', 'gswin64c', 'gswin32c']);
        if ($gs) {
            $cmd = escapeshellarg($gs).' -dNOPAUSE -dBATCH -dSAFER -sDEVICE=png16m -r'.$dpi.' '
                .'-dFirstPage='.$page.' -dLastPage='.$page.' '
                .'-sOutputFile='.escapeshellarg($outputPath).' '
                .escapeshellarg($pdfPath);
            Log::debug('Ghostscript command', ['cmd' => $cmd]);
            exec($cmd.' 2>&1', $output, $returnCode);

            if ($returnCode === 0 && file_exists($outputPath)) {
                // Resize the output to match the requested maxWidth
                $this->resizeImage($outputPath, $outputPath, $maxWidth);

                return true;
            }
            Log::warning('Ghostscript conversion failed', ['returnCode' => $returnCode, 'output' => $output]);
        }

        Log::warning('No PDF to image converter available');

        return false;
    }

    /**
     * Resize an image using GD
     */
    protected function resizeImage(string $inputPath, string $outputPath, int $maxWidth): bool
    {
        $imageInfo = @getimagesize($inputPath);
        if (! $imageInfo) {
            return false;
        }

        [$width, $height, $type] = $imageInfo;

        // Calculate new dimensions
        $ratio = $maxWidth / $width;
        $newWidth = $maxWidth;
        $newHeight = (int) ($height * $ratio);

        // Create source image
        switch ($type) {
            case IMAGETYPE_JPEG:
                $source = imagecreatefromjpeg($inputPath);
                break;
            case IMAGETYPE_PNG:
                $source = imagecreatefrompng($inputPath);
                break;
            case IMAGETYPE_GIF:
                $source = imagecreatefromgif($inputPath);
                break;
            default:
                return false;
        }

        if (! $source) {
            return false;
        }

        // Create resized image
        $resized = imagecreatetruecolor($newWidth, $newHeight);

        // Preserve transparency for PNG
        if ($type === IMAGETYPE_PNG) {
            imagealphablending($resized, false);
            imagesavealpha($resized, true);
        }

        imagecopyresampled($resized, $source, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);

        // Save output
        $result = imagepng($resized, $outputPath, 6);

        imagedestroy($source);
        imagedestroy($resized);

        return $result;
    }

    /**
     * Get PDF info (pages, dimensions)
     */
    protected function getPdfInfo(string $pdfPath): ?array
    {
        // Try pdfinfo command
        $pdfinfo = $this->findExecutable(['pdfinfo']);
        if ($pdfinfo) {
            $cmd = escapeshellcmd($pdfinfo).' '.escapeshellarg($pdfPath);
            exec($cmd, $output, $returnCode);

            if ($returnCode === 0) {
                $info = [];
                foreach ($output as $line) {
                    if (preg_match('/^Pages:\s+(\d+)/', $line, $m)) {
                        $info['pages'] = (int) $m[1];
                    }
                    if (preg_match('/^Page size:\s+([\d.]+)\s+x\s+([\d.]+)/', $line, $m)) {
                        $info['width'] = (float) $m[1];
                        $info['height'] = (float) $m[2];
                    }
                }
                if (! empty($info)) {
                    return $info;
                }
            }
        }

        // Fallback: try to parse PDF header for page count
        $content = @file_get_contents($pdfPath, false, null, 0, 10000);
        if ($content && preg_match('/\/Count\s+(\d+)/', $content, $m)) {
            return ['pages' => (int) $m[1]];
        }

        return null;
    }

    /**
     * Get first page as image (converts PDF if needed)
     */
    protected function getFirstPageImage(string $filePath): ?string
    {
        $extension = Str::lower(pathinfo($filePath, PATHINFO_EXTENSION));

        // If already an image, return as-is
        if (in_array($extension, ['png', 'jpg', 'jpeg', 'gif'])) {
            return $filePath;
        }

        // Convert PDF to temp image
        if ($extension === 'pdf') {
            $tempPath = sys_get_temp_dir().'/drawing_'.uniqid().'.png';
            if ($this->pdfToImage($filePath, $tempPath)) {
                return $tempPath;
            }
        }

        return null;
    }

    /**
     * Compare two images and generate a diff image
     * Red = removed (only in image1), Blue = added (only in image2)
     */
    protected function compareImages(string $image1Path, string $image2Path, string $outputPath): bool
    {
        // Try ImageMagick compare
        $compare = $this->findExecutable(['magick', 'compare']);
        if ($compare) {
            // ImageMagick compare with highlight
            $cmd = escapeshellcmd($compare).' -metric AE -highlight-color blue -lowlight-color none '
                .escapeshellarg($image1Path).' '
                .escapeshellarg($image2Path).' '
                .escapeshellarg($outputPath).' 2>&1';
            exec($cmd, $output, $returnCode);

            // compare returns 0 for identical, 1 for different, 2 for error
            if (($returnCode === 0 || $returnCode === 1) && file_exists($outputPath)) {
                return true;
            }
        }

        // Fallback: use GD for a simple pixel diff
        return $this->gdCompareImages($image1Path, $image2Path, $outputPath);
    }

    /**
     * Simple GD-based image comparison
     */
    protected function gdCompareImages(string $image1Path, string $image2Path, string $outputPath): bool
    {
        $img1 = $this->loadImageGd($image1Path);
        $img2 = $this->loadImageGd($image2Path);

        if (! $img1 || ! $img2) {
            return false;
        }

        $width1 = imagesx($img1);
        $height1 = imagesy($img1);
        $width2 = imagesx($img2);
        $height2 = imagesy($img2);

        // Use the larger dimensions
        $width = max($width1, $width2);
        $height = max($height1, $height2);

        // Create output image
        $output = imagecreatetruecolor($width, $height);
        $white = imagecolorallocate($output, 255, 255, 255);
        $red = imagecolorallocate($output, 255, 100, 100);
        $blue = imagecolorallocate($output, 100, 100, 255);

        imagefill($output, 0, 0, $white);

        // Compare pixels
        for ($y = 0; $y < $height; $y++) {
            for ($x = 0; $x < $width; $x++) {
                $c1 = ($x < $width1 && $y < $height1) ? imagecolorat($img1, $x, $y) : 0xFFFFFF;
                $c2 = ($x < $width2 && $y < $height2) ? imagecolorat($img2, $x, $y) : 0xFFFFFF;

                if ($c1 !== $c2) {
                    // Calculate brightness difference
                    $b1 = (($c1 >> 16) & 0xFF) + (($c1 >> 8) & 0xFF) + ($c1 & 0xFF);
                    $b2 = (($c2 >> 16) & 0xFF) + (($c2 >> 8) & 0xFF) + ($c2 & 0xFF);

                    if ($b1 > $b2) {
                        // Pixel was darker in old image (removed content) - show red
                        imagesetpixel($output, $x, $y, $red);
                    } else {
                        // Pixel is darker in new image (added content) - show blue
                        imagesetpixel($output, $x, $y, $blue);
                    }
                } else {
                    // Copy original pixel (grayscale for context)
                    $gray = (int) ((($c1 >> 16) & 0xFF) * 0.3 + (($c1 >> 8) & 0xFF) * 0.59 + ($c1 & 0xFF) * 0.11);
                    $grayColor = imagecolorallocate($output, $gray, $gray, $gray);
                    imagesetpixel($output, $x, $y, $grayColor);
                }
            }
        }

        $result = imagepng($output, $outputPath, 6);

        imagedestroy($img1);
        imagedestroy($img2);
        imagedestroy($output);

        return $result;
    }

    /**
     * Load image using GD
     */
    protected function loadImageGd(string $path)
    {
        $info = @getimagesize($path);
        if (! $info) {
            return null;
        }

        switch ($info[2]) {
            case IMAGETYPE_JPEG:
                return imagecreatefromjpeg($path);
            case IMAGETYPE_PNG:
                return imagecreatefrompng($path);
            case IMAGETYPE_GIF:
                return imagecreatefromgif($path);
            default:
                return null;
        }
    }

    /**
     * Find an executable in common locations
     */
    protected function findExecutable(array $names): ?string
    {
        // Common installation paths for Windows
        $windowsPaths = [
            'C:\\Program Files\\ImageMagick-7.1.2-Q16-HDRI\\',
            'C:\\Program Files\\ImageMagick-7.1.1-Q16-HDRI\\',
            'C:\\Program Files\\ImageMagick-7.1.1-Q16\\',
            'C:\\Program Files\\ImageMagick-7.1.0-Q16-HDRI\\',
            'C:\\Program Files\\ImageMagick-7.1.0-Q16\\',
            'C:\\Program Files\\ImageMagick\\',
            'C:\\Program Files (x86)\\ImageMagick\\',
            'C:\\ImageMagick\\',
            'C:\\Program Files\\poppler\\bin\\',
            'C:\\Program Files\\poppler-24.02.0\\Library\\bin\\',
            'C:\\Program Files\\gs\\gs10.06.0\\bin\\',
            'C:\\Program Files\\gs\\gs10.02.1\\bin\\',
            'C:\\Program Files\\gs\\gs10.00.0\\bin\\',
        ];

        $unixPaths = [
            '/usr/bin/',
            '/usr/local/bin/',
            '/opt/homebrew/bin/',
        ];

        $paths = PHP_OS_FAMILY === 'Windows' ? $windowsPaths : $unixPaths;

        foreach ($names as $name) {
            // On Windows, check hardcoded paths FIRST before PATH
            // This avoids finding Windows' convert.exe (disk utility) instead of ImageMagick
            if (PHP_OS_FAMILY === 'Windows') {
                foreach ($paths as $path) {
                    $fullPath = $path.$name.'.exe';
                    if (file_exists($fullPath)) {
                        Log::debug('Found executable at path', ['name' => $name, 'path' => $fullPath]);

                        return $fullPath;
                    }
                }
            }

            // Try to find in PATH using where/which
            $output = [];
            $which = PHP_OS_FAMILY === 'Windows' ? 'where' : 'which';
            exec("$which $name 2>&1", $output, $returnCode);

            if ($returnCode === 0 && ! empty($output[0])) {
                $foundPath = trim($output[0]);
                // On Windows, skip if it's the Windows System32 convert.exe (disk utility)
                if (PHP_OS_FAMILY === 'Windows' && str_contains(strtolower($foundPath), 'system32')) {
                    Log::debug('Skipping Windows system utility', ['name' => $name, 'path' => $foundPath]);

                    continue;
                }
                // Skip INFO: messages or "not found" responses
                if (! str_contains($foundPath, 'INFO:') && ! str_contains($foundPath, 'not found') && file_exists($foundPath)) {
                    Log::debug('Found executable in PATH', ['name' => $name, 'path' => $foundPath]);

                    return $foundPath;
                }
            }

            // Try specific paths (for Unix or as fallback)
            if (PHP_OS_FAMILY !== 'Windows') {
                foreach ($paths as $path) {
                    $fullPath = $path.$name;
                    if (file_exists($fullPath)) {
                        Log::debug('Found executable at path', ['name' => $name, 'path' => $fullPath]);

                        return $fullPath;
                    }
                }
            }
        }

        Log::warning('Executable not found', ['names' => $names]);

        return null;
    }
}
