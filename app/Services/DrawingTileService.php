<?php

namespace App\Services;

use App\Models\QaStageDrawing;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class DrawingTileService
{
    protected string $storageDisk = 's3';
    protected string $tilesDir = 'drawing-tiles';
    protected int $defaultTileSize = 256;
    protected int $maxZoomLevel = 5;
    protected int $minImageDimension = 256;

    protected DrawingProcessingService $processingService;

    public function __construct(DrawingProcessingService $processingService)
    {
        $this->processingService = $processingService;
    }

    /**
     * Generate tiles for a drawing.
     * Creates a tile pyramid for efficient viewing at multiple zoom levels.
     */
    public function generateTiles(QaStageDrawing $drawing): array
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
            // Update status to processing
            $drawing->update(['tiles_status' => 'processing']);

            // Get the source image path
            $imagePath = $this->getSourceImagePath($drawing);
            if (!$imagePath) {
                throw new \Exception('Could not get source image for tile generation');
            }

            // Get image dimensions
            $imageInfo = @getimagesize($imagePath);
            if (!$imageInfo) {
                throw new \Exception('Could not read image dimensions');
            }

            $width = $imageInfo[0];
            $height = $imageInfo[1];
            $tileSize = $drawing->tile_size ?? $this->defaultTileSize;

            // Calculate max zoom level based on image size
            $maxDimension = max($width, $height);
            $maxZoom = $this->calculateMaxZoom($maxDimension, $tileSize);

            // Base path for tiles in S3
            $tilesBasePath = "{$this->tilesDir}/{$drawing->id}";

            // Generate tiles for each zoom level
            $totalTiles = 0;
            for ($z = 0; $z <= $maxZoom; $z++) {
                $tilesAtLevel = $this->generateTilesForZoomLevel(
                    $imagePath,
                    $tilesBasePath,
                    $z,
                    $maxZoom,
                    $width,
                    $height,
                    $tileSize
                );
                $totalTiles += $tilesAtLevel;
            }

            // Update drawing with tile information
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
     * Calculate the maximum zoom level based on image dimensions.
     */
    protected function calculateMaxZoom(int $maxDimension, int $tileSize): int
    {
        // At zoom level 0, the entire image fits in a few tiles
        // Each zoom level doubles the resolution
        $zoom = 0;
        $currentSize = $maxDimension;

        while ($currentSize > $tileSize * 2 && $zoom < $this->maxZoomLevel) {
            $currentSize = $currentSize / 2;
            $zoom++;
        }

        return $zoom;
    }

    /**
     * Generate tiles for a specific zoom level.
     */
    protected function generateTilesForZoomLevel(
        string $imagePath,
        string $tilesBasePath,
        int $zoomLevel,
        int $maxZoom,
        int $originalWidth,
        int $originalHeight,
        int $tileSize
    ): int {
        // Calculate the scale for this zoom level
        // At maxZoom, scale = 1 (full resolution)
        // Each lower zoom level halves the resolution
        $scale = pow(2, $zoomLevel - $maxZoom);
        $scaledWidth = (int) ($originalWidth * $scale);
        $scaledHeight = (int) ($originalHeight * $scale);

        // Ensure minimum dimensions
        $scaledWidth = max($scaledWidth, 1);
        $scaledHeight = max($scaledHeight, 1);

        // Calculate number of tiles
        $cols = (int) ceil($scaledWidth / $tileSize);
        $rows = (int) ceil($scaledHeight / $tileSize);

        // Load source image
        $sourceImage = $this->loadImage($imagePath);
        if (!$sourceImage) {
            throw new \Exception("Could not load source image: {$imagePath}");
        }

        // Create scaled version if needed
        if ($scale < 1) {
            $scaledImage = imagecreatetruecolor($scaledWidth, $scaledHeight);
            imagecopyresampled(
                $scaledImage,
                $sourceImage,
                0, 0, 0, 0,
                $scaledWidth, $scaledHeight,
                $originalWidth, $originalHeight
            );
            imagedestroy($sourceImage);
            $sourceImage = $scaledImage;
        }

        $tilesCreated = 0;

        // Generate each tile
        for ($x = 0; $x < $cols; $x++) {
            for ($y = 0; $y < $rows; $y++) {
                $tileX = $x * $tileSize;
                $tileY = $y * $tileSize;

                // Calculate actual tile dimensions (may be smaller at edges)
                $actualTileWidth = min($tileSize, $scaledWidth - $tileX);
                $actualTileHeight = min($tileSize, $scaledHeight - $tileY);

                // Create tile image
                $tile = imagecreatetruecolor($tileSize, $tileSize);
                $white = imagecolorallocate($tile, 255, 255, 255);
                imagefill($tile, 0, 0, $white);

                // Copy the portion from source
                imagecopy(
                    $tile,
                    $sourceImage,
                    0, 0,
                    $tileX, $tileY,
                    $actualTileWidth, $actualTileHeight
                );

                // Save tile to S3
                $tilePath = "{$tilesBasePath}/{$zoomLevel}/{$x}_{$y}.jpg";
                $this->saveTileToS3($tile, $tilePath);

                imagedestroy($tile);
                $tilesCreated++;
            }
        }

        imagedestroy($sourceImage);

        return $tilesCreated;
    }

    /**
     * Save a tile image to S3.
     */
    protected function saveTileToS3($image, string $path): bool
    {
        // Capture JPEG output to buffer
        ob_start();
        imagejpeg($image, null, 85);
        $imageData = ob_get_clean();

        return Storage::disk($this->storageDisk)->put($path, $imageData, 'public');
    }

    /**
     * Get the source image path for a drawing.
     * Converts PDF to image if necessary.
     */
    protected function getSourceImagePath(QaStageDrawing $drawing): ?string
    {
        $originalPath = $this->getOriginalFilePath($drawing);

        if (!$originalPath || !file_exists($originalPath)) {
            // Try to download from S3 if needed
            $originalPath = $this->downloadFromS3($drawing);
        }

        if (!$originalPath) {
            return null;
        }

        // Check if it's a PDF
        $extension = Str::lower(pathinfo($originalPath, PATHINFO_EXTENSION));
        if ($extension === 'pdf') {
            // Convert PDF to high-resolution image for tiling
            $tempImagePath = sys_get_temp_dir() . '/drawing_tile_' . $drawing->id . '_' . uniqid() . '.png';

            // Use higher DPI for tile generation (300 DPI for high quality)
            if ($this->convertPdfToImage($originalPath, $tempImagePath, $drawing->page_number ?? 1, 300)) {
                return $tempImagePath;
            }
            return null;
        }

        return $originalPath;
    }

    /**
     * Get the original file path for a drawing.
     */
    protected function getOriginalFilePath(QaStageDrawing $drawing): ?string
    {
        // Check if file is stored locally
        if ($drawing->file_path) {
            $localPath = Storage::disk('public')->path($drawing->file_path);
            if (file_exists($localPath)) {
                return $localPath;
            }
        }

        return null;
    }

    /**
     * Download file from S3 to a temp location.
     */
    protected function downloadFromS3(QaStageDrawing $drawing): ?string
    {
        $s3Key = $drawing->file_path ?? $drawing->page_preview_s3_key;
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
     */
    protected function convertPdfToImage(string $pdfPath, string $outputPath, int $page = 1, int $dpi = 300): bool
    {
        // Try Imagick first
        if (extension_loaded('imagick')) {
            try {
                $imagick = new \Imagick();
                $imagick->setResolution($dpi, $dpi);
                $imagick->readImage($pdfPath . '[' . ($page - 1) . ']');
                $imagick->setImageFormat('png');
                $imagick->writeImage($outputPath);
                $imagick->clear();
                $imagick->destroy();
                return true;
            } catch (\Exception $e) {
                Log::warning('Imagick PDF conversion failed for tiles', ['error' => $e->getMessage()]);
            }
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

        return false;
    }

    /**
     * Load an image using GD.
     */
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

    /**
     * Find an executable in common locations.
     */
    protected function findExecutable(array $names): ?string
    {
        $paths = PHP_OS_FAMILY === 'Windows'
            ? [
                'C:\\Program Files\\gs\\gs10.06.0\\bin\\',
                'C:\\Program Files\\gs\\gs10.02.1\\bin\\',
                'C:\\Program Files\\gs\\gs10.00.0\\bin\\',
            ]
            : ['/usr/bin/', '/usr/local/bin/', '/opt/homebrew/bin/'];

        foreach ($names as $name) {
            foreach ($paths as $path) {
                $ext = PHP_OS_FAMILY === 'Windows' ? '.exe' : '';
                $fullPath = $path . $name . $ext;
                if (file_exists($fullPath)) {
                    return $fullPath;
                }
            }

            // Try to find in PATH
            $which = PHP_OS_FAMILY === 'Windows' ? 'where' : 'which';
            exec("$which $name 2>&1", $output, $returnCode);
            if ($returnCode === 0 && !empty($output[0]) && file_exists(trim($output[0]))) {
                return trim($output[0]);
            }
        }

        return null;
    }

    /**
     * Delete all tiles for a drawing.
     */
    public function deleteTiles(QaStageDrawing $drawing): bool
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

    /**
     * Get the URL for a specific tile.
     */
    public function getTileUrl(QaStageDrawing $drawing, int $z, int $x, int $y): ?string
    {
        if (!$drawing->tiles_base_url) {
            return null;
        }

        $tilePath = "{$drawing->tiles_base_url}/{$z}/{$x}_{$y}.jpg";
        return Storage::disk($this->storageDisk)->url($tilePath);
    }

    /**
     * Check if tiles exist for a drawing.
     */
    public function hasTiles(QaStageDrawing $drawing): bool
    {
        return $drawing->tiles_status === 'completed'
            && $drawing->tiles_base_url
            && $drawing->tiles_max_zoom !== null;
    }
}
