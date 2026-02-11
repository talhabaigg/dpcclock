<?php

namespace App\Services;

use App\Models\Drawing;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class DrawingTileService
{
    protected string $storageDisk;
    protected string $tilesDir = 'drawing-tiles';
    protected int $defaultTileSize = 1024;
    protected int $maxZoomLevel = 5;

    protected DrawingProcessingService $processingService;

    public function __construct(DrawingProcessingService $processingService)
    {
        $this->processingService = $processingService;
        $this->storageDisk = config('filesystems.drawings_disk', 'public');
    }

    /**
     * Generate tiles for a drawing.
     * Uses ImageMagick CLI to avoid loading huge images into PHP/GD memory.
     */
    public function generateTiles(Drawing $drawing): array
    {
        $result = [
            'success' => false,
            'tiles_count' => 0,
            'max_zoom' => 0,
            'width' => 0,
            'height' => 0,
            'error' => null,
        ];

        try {
            $drawing->update(['tiles_status' => 'processing']);

            // Get the source image path (converts PDF to PNG via ImageMagick CLI)
            $imagePath = $this->getSourceImagePath($drawing);
            if (!$imagePath) {
                throw new \Exception('Could not get source image for tile generation');
            }

            // Get dimensions using identify (no memory load)
            [$width, $height] = $this->getImageDimensions($imagePath);
            if (!$width || !$height) {
                throw new \Exception('Could not read image dimensions');
            }

            $tileSize = $drawing->tile_size ?? $this->defaultTileSize;
            $maxZoom = $this->calculateMaxZoom(max($width, $height), $tileSize);
            $tilesBasePath = "{$this->tilesDir}/{$drawing->id}";

            Log::info('Tile generation starting', [
                'drawing_id' => $drawing->id,
                'dimensions' => "{$width}x{$height}",
                'max_zoom' => $maxZoom,
            ]);

            // Skip zoom levels where the image is too small to be useful.
            // We want the smallest generated level to have at least ~1500px in its largest dimension.
            $minZoom = $this->calculateMinZoom(max($width, $height), $maxZoom);

            // Generate tiles for each zoom level using ImageMagick CLI
            $totalTiles = 0;
            $magick = $this->findExecutable(['magick', 'convert']);

            for ($z = $minZoom; $z <= $maxZoom; $z++) {
                if ($magick) {
                    $tilesAtLevel = $this->generateTilesWithMagick(
                        $magick, $imagePath, $tilesBasePath,
                        $z, $maxZoom, $width, $height, $tileSize
                    );
                } else {
                    // Guard: check if image is too large for GD
                    $estimatedMemory = $width * $height * 4; // RGBA
                    $memoryLimit = $this->getMemoryLimitBytes();
                    if ($estimatedMemory > $memoryLimit * 0.5) {
                        throw new \Exception(
                            "Image too large for GD fallback ({$width}x{$height}, ~"
                            . round($estimatedMemory / 1048576) . "MB needed). Install ImageMagick CLI."
                        );
                    }
                    $tilesAtLevel = $this->generateTilesWithGD(
                        $imagePath, $tilesBasePath,
                        $z, $maxZoom, $width, $height, $tileSize
                    );
                }
                $totalTiles += $tilesAtLevel;
            }

            $drawing->update([
                'tiles_base_url' => $tilesBasePath,
                'tiles_max_zoom' => $maxZoom,
                'tiles_width' => $width,
                'tiles_height' => $height,
                'tile_size' => $tileSize,
                'tiles_status' => 'completed',
            ]);

            // Clean up temp image if created
            if ($imagePath !== $this->getOriginalFilePath($drawing)) {
                @unlink($imagePath);
            }

            $result['success'] = true;
            $result['tiles_count'] = $totalTiles;
            $result['max_zoom'] = $maxZoom;
            $result['width'] = $width;
            $result['height'] = $height;

            Log::info('Tile generation completed', [
                'drawing_id' => $drawing->id,
                'tiles_count' => $totalTiles,
                'max_zoom' => $maxZoom,
                'dimensions' => "{$width}x{$height}",
            ]);

        } catch (\Exception $e) {
            Log::error('Tile generation failed', [
                'drawing_id' => $drawing->id,
                'error' => $e->getMessage(),
            ]);

            $drawing->update(['tiles_status' => 'failed']);
            $result['error'] = $e->getMessage();
        }

        return $result;
    }

    /**
     * Get image dimensions without loading into memory.
     */
    protected function getImageDimensions(string $imagePath): array
    {
        // Try ImageMagick identify first (no memory load)
        $magick = $this->findExecutable(['magick', 'identify']);
        if ($magick) {
            // If we found 'magick', use 'magick identify'; if we found 'identify' directly, use it as-is
            $identifyCmd = str_contains($magick, 'magick') ? escapeshellarg($magick) . ' identify' : escapeshellarg($magick);
            $cmd = $identifyCmd . ' -format "%w %h" '
                . escapeshellarg($imagePath . '[0]');
            exec($cmd . ' 2>&1', $output, $returnCode);

            if ($returnCode === 0 && !empty($output[0])) {
                $parts = explode(' ', trim($output[0]));
                if (count($parts) >= 2) {
                    return [(int) $parts[0], (int) $parts[1]];
                }
            }
        }

        // Fallback to getimagesize (loads header only, not full image)
        $info = @getimagesize($imagePath);
        if ($info) {
            return [$info[0], $info[1]];
        }

        return [0, 0];
    }

    /**
     * Calculate the minimum useful zoom level.
     * Skips levels where the image would be smaller than ~1500px (too blurry for plans).
     */
    protected function calculateMinZoom(int $maxDimension, int $maxZoom): int
    {
        // At zoom z, the image dimension = maxDimension / 2^(maxZoom - z)
        // We want: maxDimension / 2^(maxZoom - z) >= 1500
        $minZoom = max(0, $maxZoom - (int) floor(log(max($maxDimension, 1) / 1500, 2)));

        return min($minZoom, $maxZoom);
    }

    protected function calculateMaxZoom(int $maxDimension, int $tileSize): int
    {
        $zoom = 0;
        $currentSize = $maxDimension;

        while ($currentSize > $tileSize * 2 && $zoom < $this->maxZoomLevel) {
            $currentSize = $currentSize / 2;
            $zoom++;
        }

        return $zoom;
    }

    /**
     * Generate tiles for a zoom level using ImageMagick CLI.
     * Avoids loading the full image into PHP memory.
     */
    protected function generateTilesWithMagick(
        string $magick,
        string $imagePath,
        string $tilesBasePath,
        int $zoomLevel,
        int $maxZoom,
        int $originalWidth,
        int $originalHeight,
        int $tileSize
    ): int {
        $scale = pow(2, $zoomLevel - $maxZoom);
        $scaledWidth = max(1, (int) ($originalWidth * $scale));
        $scaledHeight = max(1, (int) ($originalHeight * $scale));

        $cols = (int) ceil($scaledWidth / $tileSize);
        $rows = (int) ceil($scaledHeight / $tileSize);

        // Create a temp directory for this zoom level's tiles
        $tempDir = sys_get_temp_dir() . '/tiles_' . uniqid();
        @mkdir($tempDir, 0755, true);

        // Use ImageMagick to resize + crop into tiles in one pass
        // -extent pads edge tiles with white background
        // Use proc_open with array syntax to bypass CMD shell on Windows (avoids %d variable expansion)
        $outputPattern = $tempDir . '/tile_%d.png';
        $extentSize = ($cols * $tileSize) . 'x' . ($rows * $tileSize);

        // Build args: IM7 uses "magick convert", IM6 uses just "convert"
        $isMagick7 = str_contains(basename($magick), 'magick');
        $args = $isMagick7
            ? [$magick, 'convert'] : [$magick];
        $args = array_merge($args, [
            $imagePath,
            '-resize', "{$scaledWidth}x{$scaledHeight}!",
            '-background', 'white', '-extent', $extentSize,
            '-crop', "{$tileSize}x{$tileSize}", '+repage',
            $outputPattern,
        ]);

        $descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
        $process = proc_open($args, $descriptors, $pipes);

        if (!is_resource($process)) {
            Log::warning('ImageMagick proc_open failed', ['zoom' => $zoomLevel]);
            $this->cleanupDir($tempDir);
            return 0;
        }

        fclose($pipes[0]);
        $stdout = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $returnCode = proc_close($process);

        if ($returnCode !== 0) {
            Log::warning('ImageMagick tile crop failed', [
                'zoom' => $zoomLevel,
                'returnCode' => $returnCode,
                'stderr' => $stderr,
            ]);
            $this->cleanupDir($tempDir);
            return 0;
        }

        // Upload tiles to storage (ImageMagick numbers sequentially: tile_0.png, tile_1.png, ...)
        // The sequential order is: row by row, left to right
        $tilesCreated = 0;
        $index = 0;
        for ($y = 0; $y < $rows; $y++) {
            for ($x = 0; $x < $cols; $x++) {
                $tileFile = $tempDir . "/tile_{$index}.png";
                if (file_exists($tileFile)) {
                    $s3Path = "{$tilesBasePath}/{$zoomLevel}/{$x}_{$y}.png";
                    Storage::disk($this->storageDisk)->put($s3Path, file_get_contents($tileFile));
                    @unlink($tileFile);
                    $tilesCreated++;
                }
                $index++;
            }
        }

        $this->cleanupDir($tempDir);

        return $tilesCreated;
    }

    /**
     * Fallback: generate tiles using GD (for smaller images only).
     */
    protected function generateTilesWithGD(
        string $imagePath,
        string $tilesBasePath,
        int $zoomLevel,
        int $maxZoom,
        int $originalWidth,
        int $originalHeight,
        int $tileSize
    ): int {
        $scale = pow(2, $zoomLevel - $maxZoom);
        $scaledWidth = max(1, (int) ($originalWidth * $scale));
        $scaledHeight = max(1, (int) ($originalHeight * $scale));

        $cols = (int) ceil($scaledWidth / $tileSize);
        $rows = (int) ceil($scaledHeight / $tileSize);

        $sourceImage = $this->loadImage($imagePath);
        if (!$sourceImage) {
            throw new \Exception("Could not load source image: {$imagePath}");
        }

        if ($scale < 1) {
            $scaledImage = imagecreatetruecolor($scaledWidth, $scaledHeight);
            imagecopyresampled(
                $scaledImage, $sourceImage,
                0, 0, 0, 0,
                $scaledWidth, $scaledHeight,
                $originalWidth, $originalHeight
            );
            imagedestroy($sourceImage);
            $sourceImage = $scaledImage;
        }

        $tilesCreated = 0;

        for ($x = 0; $x < $cols; $x++) {
            for ($y = 0; $y < $rows; $y++) {
                $tileX = $x * $tileSize;
                $tileY = $y * $tileSize;
                $actualTileWidth = min($tileSize, $scaledWidth - $tileX);
                $actualTileHeight = min($tileSize, $scaledHeight - $tileY);

                $tile = imagecreatetruecolor($tileSize, $tileSize);
                $white = imagecolorallocate($tile, 255, 255, 255);
                imagefill($tile, 0, 0, $white);
                imagecopy($tile, $sourceImage, 0, 0, $tileX, $tileY, $actualTileWidth, $actualTileHeight);

                $tilePath = "{$tilesBasePath}/{$zoomLevel}/{$x}_{$y}.png";
                ob_start();
                imagepng($tile, null, 6);
                $imageData = ob_get_clean();
                Storage::disk($this->storageDisk)->put($tilePath, $imageData);

                imagedestroy($tile);
                $tilesCreated++;
            }
        }

        imagedestroy($sourceImage);
        return $tilesCreated;
    }

    /**
     * Get the source image path for a drawing.
     * Converts PDF to image if necessary.
     */
    protected function getSourceImagePath(Drawing $drawing): ?string
    {
        $originalPath = $this->getOriginalFilePath($drawing);

        if (!$originalPath || !file_exists($originalPath)) {
            $originalPath = $this->downloadFromS3($drawing);
        }

        if (!$originalPath) {
            return null;
        }

        $extension = Str::lower(pathinfo($originalPath, PATHINFO_EXTENSION));
        if ($extension === 'pdf') {
            $tempImagePath = sys_get_temp_dir() . '/drawing_tile_' . $drawing->id . '_' . uniqid() . '.png';

            if ($this->convertPdfToImage($originalPath, $tempImagePath, $drawing->page_number ?? 1, 400)) {
                return $tempImagePath;
            }
            return null;
        }

        return $originalPath;
    }

    protected function getOriginalFilePath(Drawing $drawing): ?string
    {
        $storagePath = $drawing->storage_path ?? $drawing->file_path;
        if ($storagePath) {
            $disk = config('filesystems.drawings_disk', 'public');
            if ($disk !== 's3') {
                $localPath = Storage::disk($disk)->path($storagePath);
                if (file_exists($localPath)) {
                    return $localPath;
                }
            }
        }

        return null;
    }

    protected function downloadFromS3(Drawing $drawing): ?string
    {
        $s3Key = $drawing->storage_path ?? $drawing->file_path ?? $drawing->page_preview_s3_key;
        if (!$s3Key) {
            return null;
        }

        try {
            $extension = pathinfo($s3Key, PATHINFO_EXTENSION) ?: 'pdf';
            $tempPath = sys_get_temp_dir() . '/drawing_' . $drawing->id . '_' . uniqid() . '.' . $extension;

            $content = Storage::disk('s3')->get($s3Key);
            if ($content) {
                file_put_contents($tempPath, $content);
                return $tempPath;
            }
        } catch (\Exception $e) {
            Log::error('Failed to download from S3', [
                'drawing_id' => $drawing->id,
                'error' => $e->getMessage(),
            ]);
        }

        return null;
    }

    /**
     * Convert PDF to image using available tools.
     * Matches the same fallback chain as DrawingProcessingService.
     */
    protected function convertPdfToImage(string $pdfPath, string $outputPath, int $page = 1, int $dpi = 300): bool
    {
        // Try pdftoppm first (poppler-utils) — most reliable on Linux servers
        $pdftoppm = $this->findExecutable(['pdftoppm']);
        if ($pdftoppm) {
            $tempBase = sys_get_temp_dir() . '/pdf_tile_' . uniqid();
            $cmd = escapeshellarg($pdftoppm) . ' -png -r ' . $dpi
                . ' -f ' . $page . ' -l ' . $page . ' '
                . escapeshellarg($pdfPath) . ' ' . escapeshellarg($tempBase);
            exec($cmd . ' 2>&1', $output, $returnCode);

            // pdftoppm names output as base-N.png
            $tempFile = $tempBase . '-' . $page . '.png';
            if (!file_exists($tempFile)) {
                // Some versions use base-0N.png format
                $tempFile = $tempBase . '-' . sprintf('%02d', $page) . '.png';
            }
            if (!file_exists($tempFile)) {
                // Single page might just be base.png
                $tempFile = $tempBase . '.png';
            }

            if ($returnCode === 0 && file_exists($tempFile)) {
                rename($tempFile, $outputPath);
                Log::info('Tile PDF conversion via pdftoppm', ['path' => $pdfPath]);
                return true;
            }
            @unlink($tempFile);
            Log::warning('pdftoppm conversion failed for tiles', ['returnCode' => $returnCode, 'output' => $output]);
        }

        // Try Imagick PHP extension
        if (extension_loaded('imagick')) {
            try {
                $imagick = new \Imagick();
                $imagick->setResolution($dpi, $dpi);
                $imagick->readImage($pdfPath . '[' . ($page - 1) . ']');
                $imagick->setImageBackgroundColor('white');
                $imagick->setImageAlphaChannel(\Imagick::ALPHACHANNEL_REMOVE);
                $imagick->setImageFormat('png');
                $imagick->writeImage($outputPath);
                $imagick->clear();
                $imagick->destroy();
                return true;
            } catch (\Exception $e) {
                Log::warning('Imagick PDF conversion failed for tiles', ['error' => $e->getMessage()]);
            }
        }

        // Try ImageMagick CLI (magick for v7, convert for v6)
        $magick = $this->findExecutable(['magick', 'convert']);
        if ($magick) {
            $cmd = escapeshellarg($magick) . ' -density ' . $dpi . ' '
                . escapeshellarg($pdfPath . '[' . ($page - 1) . ']')
                . ' -background white -alpha remove -quality 95 '
                . escapeshellarg($outputPath);

            exec($cmd . ' 2>&1', $output, $returnCode);

            if ($returnCode === 0 && file_exists($outputPath)) {
                Log::info('Tile PDF conversion via ImageMagick CLI', ['path' => $pdfPath]);
                return true;
            }
            Log::warning('ImageMagick CLI PDF conversion failed', ['returnCode' => $returnCode, 'output' => $output]);
        }

        // Try Ghostscript
        $gs = $this->findExecutable(['gs', 'gswin64c', 'gswin32c']);
        if ($gs) {
            $cmd = escapeshellarg($gs) . ' -dNOPAUSE -dBATCH -dSAFER -sDEVICE=png16m -r' . $dpi . ' '
                . '-dFirstPage=' . $page . ' -dLastPage=' . $page . ' '
                . '-sOutputFile=' . escapeshellarg($outputPath) . ' '
                . escapeshellarg($pdfPath);

            exec($cmd . ' 2>&1', $output, $returnCode);

            if ($returnCode === 0 && file_exists($outputPath)) {
                return true;
            }
        }

        Log::warning('No PDF converter available for tile generation');
        return false;
    }

    protected function loadImage(string $path)
    {
        $info = @getimagesize($path);
        if (!$info) {
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

    protected function findExecutable(array $names): ?string
    {
        $windowsPaths = [
            'C:\\Program Files\\ImageMagick-7.1.2-Q16-HDRI\\',
            'C:\\Program Files\\ImageMagick-7.1.1-Q16-HDRI\\',
            'C:\\Program Files\\ImageMagick-7.1.0-Q16-HDRI\\',
            'C:\\Program Files\\ImageMagick\\',
            'C:\\Program Files\\poppler\\bin\\',
            'C:\\Program Files\\poppler-24.02.0\\Library\\bin\\',
            'C:\\Program Files\\gs\\gs10.06.0\\bin\\',
            'C:\\Program Files\\gs\\gs10.02.1\\bin\\',
            'C:\\Program Files\\gs\\gs10.00.0\\bin\\',
        ];

        $unixPaths = ['/usr/bin/', '/usr/local/bin/', '/opt/homebrew/bin/'];
        $paths = PHP_OS_FAMILY === 'Windows' ? $windowsPaths : $unixPaths;

        foreach ($names as $name) {
            if (PHP_OS_FAMILY === 'Windows') {
                foreach ($paths as $path) {
                    $fullPath = $path . $name . '.exe';
                    if (file_exists($fullPath)) {
                        return $fullPath;
                    }
                }
            }

            $which = PHP_OS_FAMILY === 'Windows' ? 'where' : 'which';
            $output = [];
            exec("$which $name 2>&1", $output, $returnCode);

            if ($returnCode === 0 && !empty($output[0])) {
                $foundPath = trim($output[0]);
                // On Windows, skip System32 convert.exe (disk utility)
                if (PHP_OS_FAMILY === 'Windows' && str_contains(strtolower($foundPath), 'system32')) {
                    continue;
                }
                if (!str_contains($foundPath, 'INFO:') && !str_contains($foundPath, 'not found') && file_exists($foundPath)) {
                    return $foundPath;
                }
            }

            if (PHP_OS_FAMILY !== 'Windows') {
                foreach ($paths as $path) {
                    $fullPath = $path . $name;
                    if (file_exists($fullPath)) {
                        return $fullPath;
                    }
                }
            }
        }

        return null;
    }

    public function deleteTiles(Drawing $drawing): bool
    {
        if (!$drawing->tiles_base_url) {
            return true;
        }

        try {
            Storage::disk($this->storageDisk)->deleteDirectory($drawing->tiles_base_url);

            $drawing->update([
                'tiles_base_url' => null,
                'tiles_max_zoom' => null,
                'tiles_width' => null,
                'tiles_height' => null,
                'tiles_status' => null,
            ]);

            return true;
        } catch (\Exception $e) {
            Log::error('Failed to delete tiles', [
                'drawing_id' => $drawing->id,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    public function getTileUrl(Drawing $drawing, int $z, int $x, int $y): ?string
    {
        if (!$drawing->tiles_base_url) {
            return null;
        }

        $tilePath = "{$drawing->tiles_base_url}/{$z}/{$x}_{$y}.jpg";
        return Storage::disk($this->storageDisk)->url($tilePath);
    }

    public function hasTiles(Drawing $drawing): bool
    {
        return $drawing->tiles_status === 'completed'
            && $drawing->tiles_base_url
            && $drawing->tiles_max_zoom !== null;
    }

    protected function getMemoryLimitBytes(): int
    {
        $limit = ini_get('memory_limit');
        if ($limit === '-1') {
            return PHP_INT_MAX;
        }
        $unit = strtolower(substr($limit, -1));
        $value = (int) $limit;
        return match ($unit) {
            'g' => $value * 1073741824,
            'm' => $value * 1048576,
            'k' => $value * 1024,
            default => $value,
        };
    }

    protected function cleanupDir(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }
        $files = glob($dir . '/*');
        if ($files) {
            foreach ($files as $file) {
                @unlink($file);
            }
        }
        @rmdir($dir);
    }
}
