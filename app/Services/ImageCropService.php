<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Drivers\Gd\Driver as GdDriver;
use Intervention\Image\Drivers\Imagick\Driver as ImagickDriver;
use Intervention\Image\ImageManager;

/**
 * Service for cropping images for title block extraction.
 *
 * Supports normalized crop rectangles (0..1 coordinates) that can be
 * applied to images of any size.
 */
class ImageCropService
{
    private ImageManager $imageManager;

    /**
     * Default heuristic crop region (bottom-right quadrant where title blocks usually are).
     * Values are normalized (0..1) relative to image dimensions.
     */
    public const DEFAULT_HEURISTIC_CROP = [
        'x' => 0.55,  // Start at 55% from left
        'y' => 0.60,  // Start at 60% from top
        'w' => 0.45,  // Width is 45% of image
        'h' => 0.40,  // Height is 40% of image
    ];

    public function __construct()
    {
        // Prefer Imagick for better quality, fall back to GD
        if (extension_loaded('imagick')) {
            $this->imageManager = new ImageManager(new ImagickDriver);
        } else {
            $this->imageManager = new ImageManager(new GdDriver);
        }
    }

    /**
     * Crop an image using normalized coordinates.
     *
     * @param  string  $imagePath  Path to source image (local or S3)
     * @param  array  $cropRect  Normalized crop rect {x, y, w, h} where values are 0..1
     * @param  string|null  $disk  Storage disk ('local', 's3', etc.)
     * @return string|null Cropped image as PNG bytes, or null on failure
     */
    public function cropImage(string $imagePath, array $cropRect, ?string $disk = null): ?string
    {
        try {
            // Read image
            if ($disk) {
                $imageData = Storage::disk($disk)->get($imagePath);
                if (! $imageData) {
                    Log::error('Failed to read image from storage', ['path' => $imagePath, 'disk' => $disk]);

                    return null;
                }
                $image = $this->imageManager->read($imageData);
            } else {
                // Local filesystem path
                $image = $this->imageManager->read($imagePath);
            }

            // Get image dimensions
            $width = $image->width();
            $height = $image->height();

            // Convert normalized coordinates to pixels
            $pixels = $this->normalizedToPixels($cropRect, $width, $height);

            // Ensure crop region is within bounds
            $pixels = $this->clampToImageBounds($pixels, $width, $height);

            // Perform crop
            $image->crop(
                $pixels['w'],
                $pixels['h'],
                $pixels['x'],
                $pixels['y']
            );

            // Return as PNG bytes
            return $image->toPng()->toString();

        } catch (\Exception $e) {
            Log::error('Image crop failed', [
                'path' => $imagePath,
                'crop_rect' => $cropRect,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Crop using the default heuristic region (bottom-right).
     *
     * @param  string  $imagePath  Path to source image
     * @param  string|null  $disk  Storage disk
     * @return string|null Cropped image as PNG bytes
     */
    public function cropHeuristic(string $imagePath, ?string $disk = null): ?string
    {
        return $this->cropImage($imagePath, self::DEFAULT_HEURISTIC_CROP, $disk);
    }

    /**
     * Get image dimensions.
     *
     * @param  string  $imagePath  Path to image
     * @param  string|null  $disk  Storage disk
     * @return array{width: int, height: int}|null
     */
    public function getImageDimensions(string $imagePath, ?string $disk = null): ?array
    {
        try {
            if ($disk) {
                $imageData = Storage::disk($disk)->get($imagePath);
                if (! $imageData) {
                    return null;
                }
                $image = $this->imageManager->read($imageData);
            } else {
                $image = $this->imageManager->read($imagePath);
            }

            return [
                'width' => $image->width(),
                'height' => $image->height(),
            ];
        } catch (\Exception $e) {
            Log::error('Failed to get image dimensions', [
                'path' => $imagePath,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Convert normalized coordinates (0..1) to pixel coordinates.
     *
     * @param  array  $normalized  {x, y, w, h} normalized 0..1
     * @param  int  $imageWidth  Image width in pixels
     * @param  int  $imageHeight  Image height in pixels
     * @return array{x: int, y: int, w: int, h: int} Pixel coordinates
     */
    public function normalizedToPixels(array $normalized, int $imageWidth, int $imageHeight): array
    {
        return [
            'x' => (int) round(($normalized['x'] ?? 0) * $imageWidth),
            'y' => (int) round(($normalized['y'] ?? 0) * $imageHeight),
            'w' => (int) round(($normalized['w'] ?? 1) * $imageWidth),
            'h' => (int) round(($normalized['h'] ?? 1) * $imageHeight),
        ];
    }

    /**
     * Convert pixel coordinates to normalized coordinates (0..1).
     *
     * @param  array  $pixels  {x, y, w, h} pixel coordinates
     * @param  int  $imageWidth  Image width in pixels
     * @param  int  $imageHeight  Image height in pixels
     * @return array{x: float, y: float, w: float, h: float} Normalized coordinates
     */
    public function pixelsToNormalized(array $pixels, int $imageWidth, int $imageHeight): array
    {
        return [
            'x' => $imageWidth > 0 ? ($pixels['x'] ?? 0) / $imageWidth : 0,
            'y' => $imageHeight > 0 ? ($pixels['y'] ?? 0) / $imageHeight : 0,
            'w' => $imageWidth > 0 ? ($pixels['w'] ?? $imageWidth) / $imageWidth : 1,
            'h' => $imageHeight > 0 ? ($pixels['h'] ?? $imageHeight) / $imageHeight : 1,
        ];
    }

    /**
     * Ensure crop region doesn't exceed image bounds.
     *
     * @param  array  $pixels  Pixel coordinates {x, y, w, h}
     * @param  int  $imageWidth  Image width
     * @param  int  $imageHeight  Image height
     * @return array Clamped pixel coordinates
     */
    private function clampToImageBounds(array $pixels, int $imageWidth, int $imageHeight): array
    {
        $x = max(0, min($pixels['x'], $imageWidth - 1));
        $y = max(0, min($pixels['y'], $imageHeight - 1));

        // Ensure width and height don't extend past image bounds
        $w = max(1, min($pixels['w'], $imageWidth - $x));
        $h = max(1, min($pixels['h'], $imageHeight - $y));

        return ['x' => $x, 'y' => $y, 'w' => $w, 'h' => $h];
    }

    /**
     * Save cropped image to S3 and return the key.
     *
     * @param  string  $croppedBytes  PNG image bytes
     * @param  string  $prefix  S3 key prefix
     * @param  string  $filename  Base filename (without extension)
     * @return string|null S3 key on success
     */
    public function saveCroppedToS3(string $croppedBytes, string $prefix, string $filename): ?string
    {
        try {
            $s3Key = trim($prefix, '/').'/'.$filename.'_crop.png';

            Storage::disk('s3')->put($s3Key, $croppedBytes, [
                'ContentType' => 'image/png',
            ]);

            return $s3Key;
        } catch (\Exception $e) {
            Log::error('Failed to save cropped image to S3', [
                'prefix' => $prefix,
                'filename' => $filename,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Get the default heuristic crop rectangle.
     */
    public static function getDefaultHeuristicCrop(): array
    {
        return self::DEFAULT_HEURISTIC_CROP;
    }
}
