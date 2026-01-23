<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Service for CV-based (Computer Vision) drawing comparison.
 *
 * This service calls the Python microservice that uses OpenCV for
 * deterministic, pixel-accurate change detection between drawing revisions.
 *
 * The Python service provides:
 * - Feature-based image alignment (ORB)
 * - Pixel difference detection
 * - Contour-based region detection
 * - Accurate bounding boxes for changed regions
 */
class CVDrawingComparisonService
{
    /**
     * Base URL for the Python CV microservice.
     */
    protected string $serviceUrl;

    /**
     * Request timeout in seconds.
     */
    protected int $timeout;

    public function __construct()
    {
        $this->serviceUrl = config('services.cv_comparison.url', 'http://localhost:5050');
        $this->timeout = config('services.cv_comparison.timeout', 120);
    }

    /**
     * Check if the CV service is healthy and available.
     */
    public function isHealthy(): bool
    {
        try {
            $response = Http::timeout(5)
                ->get("{$this->serviceUrl}/health");

            return $response->successful() &&
                   ($response->json('status') === 'healthy');
        } catch (\Exception $e) {
            Log::warning('CV Comparison Service health check failed', [
                'url' => $this->serviceUrl,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Compare two drawing images using computer vision.
     *
     * @param string $imageA Base64 encoded older revision (or data URL)
     * @param string $imageB Base64 encoded newer revision (or data URL)
     * @param array $config Optional configuration overrides
     * @return array Comparison results with regions and visualization
     */
    public function compare(string $imageA, string $imageB, array $config = []): array
    {
        try {
            Log::info('CV Comparison: Starting comparison');

            $response = Http::timeout($this->timeout)
                ->post("{$this->serviceUrl}/compare", [
                    'image_a' => $imageA,
                    'image_b' => $imageB,
                    'config' => $config,
                ]);

            if (!$response->successful()) {
                Log::error('CV Comparison: Service returned error', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return [
                    'success' => false,
                    'error' => 'CV service returned status ' . $response->status(),
                    'regions' => [],
                    'region_count' => 0,
                ];
            }

            $result = $response->json();

            Log::info('CV Comparison: Completed', [
                'success' => $result['success'] ?? false,
                'region_count' => $result['region_count'] ?? 0,
                'alignment_success' => $result['alignment']['success'] ?? false,
            ]);

            return $result;

        } catch (\Exception $e) {
            Log::error('CV Comparison: Exception', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
                'regions' => [],
                'region_count' => 0,
            ];
        }
    }

    /**
     * Compare drawings from S3 storage paths.
     *
     * @param string $pathA S3 path to older revision
     * @param string $pathB S3 path to newer revision
     * @param array $config Optional configuration overrides
     * @return array Comparison results
     */
    public function compareFromStorage(string $pathA, string $pathB, array $config = []): array
    {
        try {
            // Get images from S3
            $imageA = $this->getImageAsBase64($pathA);
            $imageB = $this->getImageAsBase64($pathB);

            if (!$imageA || !$imageB) {
                return [
                    'success' => false,
                    'error' => 'Failed to load one or both images from storage',
                    'regions' => [],
                    'region_count' => 0,
                ];
            }

            return $this->compare($imageA, $imageB, $config);

        } catch (\Exception $e) {
            Log::error('CV Comparison: Storage load failed', [
                'pathA' => $pathA,
                'pathB' => $pathB,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => 'Failed to load images: ' . $e->getMessage(),
                'regions' => [],
                'region_count' => 0,
            ];
        }
    }

    /**
     * Crop a region from an image.
     *
     * @param string $image Base64 encoded image
     * @param array $boundingBox Normalized bounding box (x, y, width, height)
     * @param float $padding Padding percentage (0.0 - 1.0)
     * @return array Crop result with cropped_image
     */
    public function cropRegion(string $image, array $boundingBox, float $padding = 0.1): array
    {
        try {
            $response = Http::timeout(30)
                ->post("{$this->serviceUrl}/crop", [
                    'image' => $image,
                    'bounding_box' => $boundingBox,
                    'padding' => $padding,
                ]);

            if (!$response->successful()) {
                return [
                    'success' => false,
                    'error' => 'Crop service returned status ' . $response->status(),
                ];
            }

            return $response->json();

        } catch (\Exception $e) {
            Log::error('CV Crop: Exception', [
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Get an image from S3 storage as base64.
     */
    protected function getImageAsBase64(string $path): ?string
    {
        try {
            $disk = Storage::disk('s3');

            if (!$disk->exists($path)) {
                Log::warning('CV Comparison: Image not found in S3', ['path' => $path]);
                return null;
            }

            $contents = $disk->get($path);
            $mimeType = $this->getMimeType($path);

            return "data:{$mimeType};base64," . base64_encode($contents);

        } catch (\Exception $e) {
            Log::error('CV Comparison: Failed to load image from S3', [
                'path' => $path,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Determine MIME type from file extension.
     */
    protected function getMimeType(string $path): string
    {
        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));

        return match ($extension) {
            'png' => 'image/png',
            'jpg', 'jpeg' => 'image/jpeg',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            default => 'image/png',
        };
    }

    /**
     * Get configuration for different sensitivity levels.
     */
    public function getSensitivityConfig(string $level = 'medium'): array
    {
        return match ($level) {
            'low' => [
                'diff_threshold' => 50,
                'min_contour_area' => 1000,
                'blur_kernel' => 7,
                'dilate_iterations' => 2,
            ],
            'high' => [
                'diff_threshold' => 15,
                'min_contour_area' => 200,
                'blur_kernel' => 3,
                'dilate_iterations' => 4,
            ],
            default => [ // medium
                'diff_threshold' => 30,
                'min_contour_area' => 500,
                'blur_kernel' => 5,
                'dilate_iterations' => 3,
            ],
        };
    }
}
