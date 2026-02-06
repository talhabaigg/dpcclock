<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class DrawingComparisonService
{
    private string $apiKey;

    private string $model;

    public function __construct()
    {
        $this->apiKey = config('services.openai.api_key') ?: env('OPENAI_API_KEY') ?: '';
        // Use configurable model - default to latest GPT-4o
        $this->model = config('services.openai.vision_model') ?: env('OPENAI_VISION_MODEL') ?: 'gpt-4o-2024-11-20';
    }

    /**
     * Compare two drawing revisions and identify changes.
     *
     * @param  string  $imageA  Base64 or URL of first revision (older)
     * @param  string  $imageB  Base64 or URL of second revision (newer)
     * @param  string  $context  Optional context about the drawings (e.g., "walls and ceilings")
     * @param  string|null  $additionalPrompt  Optional additional instructions for refinement
     * @return array{success: bool, summary: string|null, changes: array, error: string|null}
     */
    public function compareRevisions(string $imageA, string $imageB, string $context = '', ?string $additionalPrompt = null): array
    {
        if (! $this->apiKey) {
            return [
                'success' => false,
                'summary' => null,
                'changes' => [],
                'error' => 'OpenAI API key not configured',
            ];
        }

        $tradeContext = $context ?: 'construction drawings';

        // Build additional instructions section if provided
        $additionalInstructions = '';
        if ($additionalPrompt) {
            $additionalInstructions = "\n\nADDITIONAL INSTRUCTIONS FROM USER:\n{$additionalPrompt}\n";
        }

        $prompt = <<<PROMPT
You are an expert construction drawing analyst specializing in {$tradeContext} for commercial construction projects.

CONTEXT: You are analyzing drawings for a Walls & Ceilings subcontractor. Focus on elements relevant to this trade:
- Wall framing, stud layouts, and partition changes
- Ceiling grid layouts, heights, and bulkhead modifications
- Drywall specifications and material callouts
- Acoustic treatments and fire-rated assemblies
- Backing, blocking, and structural support changes
- Door and window frame rough openings
- MEP coordination clearances affecting wall/ceiling work

IMPORTANT: Correctly identify room types by reading room labels/tags on the drawing. Common labels include:
- Bathroom/Restroom/WC/Toilet (not pools)
- Kitchen/Pantry/Break Room
- Office/Conference/Meeting
- Corridor/Hallway
- Mechanical/Electrical/Telecom rooms
Do NOT guess room functions - read the actual labels on the drawing.

I'm showing you two revisions of the same construction drawing:
- IMAGE 1 (first image): The OLDER revision (e.g., Revision B)
- IMAGE 2 (second image): The NEWER revision (e.g., Revision C)

Please analyze these drawings and identify ALL changes between the revisions.

Focus on:
1. Dimensional changes (measurements, distances) affecting walls and ceilings
2. Added or removed elements (walls, partitions, soffits, bulkheads, fixtures)
3. Material or specification changes (drywall type, stud gauge, insulation)
4. Layout modifications that affect framing scope
5. Annotation/note changes relevant to wall and ceiling work
6. Any revision clouds or change markers visible on the drawing
7. Changes that may impact existing work or require rework
{$additionalInstructions}
Provide your response in this JSON format:
{
    "summary": "Brief 1-2 sentence summary of the overall changes",
    "change_count": number,
    "changes": [
        {
            "type": "dimension|addition|removal|modification|annotation|specification",
            "description": "What changed - be specific about wall/ceiling elements affected",
            "location": "Where on the drawing (e.g., 'Bathroom B102', 'Corridor near grid C-4', 'Conference Room 201 ceiling')",
            "impact": "low|medium|high",
            "potential_change_order": true/false,
            "reason": "Why this might require a change order (if applicable)",
            "coordinates": {
                "page": 1,
                "x": 0.42,
                "y": 0.31,
                "width": 0.12,
                "height": 0.08,
                "reference": "image_2"
            }
        }
    ],
    "confidence": "low|medium|high",
    "notes": "Any additional observations or uncertainties"
}

CRITICAL COORDINATE INSTRUCTIONS:
- The x,y coordinates should point to the CENTER of the change area (not top-left corner)
- Use normalized values between 0 and 1 relative to the full page (0 = left/top edge, 1 = right/bottom edge)
- x=0.5, y=0.5 would be the exact center of the page
- width and height define the bounding box size around the center point
- Always include page, x, y, width, and height for every change
- If unsure about the exact location, give your best estimate based on the visible change

If you cannot clearly see changes or the images are unclear, say so in the notes.
Be thorough but accurate - only report changes you can actually see.
PROMPT;

        try {
            Log::info('Starting AI comparison', [
                'model' => $this->model,
                'context' => $tradeContext,
            ]);

            $response = Http::withToken($this->apiKey)
                ->timeout(120)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => $this->model,
                    'messages' => [
                        [
                            'role' => 'user',
                            'content' => [
                                [
                                    'type' => 'text',
                                    'text' => $prompt,
                                ],
                                [
                                    'type' => 'image_url',
                                    'image_url' => [
                                        'url' => $imageA,
                                        'detail' => 'high',
                                    ],
                                ],
                                [
                                    'type' => 'image_url',
                                    'image_url' => [
                                        'url' => $imageB,
                                        'detail' => 'high',
                                    ],
                                ],
                            ],
                        ],
                    ],
                    'max_tokens' => 4096,
                    'temperature' => 0.2, // Lower temperature for more consistent analysis
                ]);

            if (! $response->successful()) {
                Log::error('OpenAI comparison failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return [
                    'success' => false,
                    'summary' => null,
                    'changes' => [],
                    'error' => 'OpenAI API error: '.$response->status(),
                ];
            }

            $data = $response->json();
            $content = $data['choices'][0]['message']['content'] ?? '';

            Log::info('OpenAI comparison response', [
                'content_length' => strlen($content),
                'usage' => $data['usage'] ?? null,
            ]);

            // Parse the JSON response
            $parsed = $this->parseJsonResponse($content);

            if (! $parsed) {
                return [
                    'success' => true,
                    'summary' => $content, // Return raw text if JSON parsing fails
                    'changes' => [],
                    'raw_response' => $content,
                    'error' => null,
                ];
            }

            $changes = $this->normalizeChanges($parsed['changes'] ?? []);

            return [
                'success' => true,
                'summary' => $parsed['summary'] ?? null,
                'changes' => $changes,
                'change_count' => $parsed['change_count'] ?? count($changes),
                'confidence' => $parsed['confidence'] ?? 'unknown',
                'notes' => $parsed['notes'] ?? null,
                'raw_response' => $content,
                'error' => null,
            ];

        } catch (\Exception $e) {
            Log::error('DrawingComparisonService error', [
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'summary' => null,
                'changes' => [],
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Get image as base64 data URL from S3 key.
     * Optionally resizes the image to fit within max dimensions for AI analysis.
     *
     * @param  string  $s3Key  S3 key for the image
     * @param  int  $maxDimension  Max width/height in pixels (0 = no resize)
     */
    public function getImageDataUrl(string $s3Key, int $maxDimension = 2048): ?string
    {
        try {
            $contents = Storage::disk('s3')->get($s3Key);
            if (! $contents) {
                return null;
            }

            // Resize image if needed for AI analysis
            if ($maxDimension > 0) {
                $contents = $this->resizeImageForAI($contents, $maxDimension);
                if (! $contents) {
                    return null;
                }
            }

            // Detect mime type (will be image/jpeg after resize)
            $finfo = new \finfo(FILEINFO_MIME_TYPE);
            $mimeType = $finfo->buffer($contents) ?: 'image/jpeg';

            $base64Data = base64_encode($contents);
            $contentSize = strlen($contents);

            // Free the raw contents before creating the final string
            unset($contents);

            Log::info('Image prepared for AI', [
                's3_key' => $s3Key,
                'mime_type' => $mimeType,
                'raw_size_kb' => round($contentSize / 1024),
                'base64_size_kb' => round(strlen($base64Data) / 1024),
            ]);

            return 'data:'.$mimeType.';base64,'.$base64Data;
        } catch (\Exception $e) {
            Log::error('Failed to get image data URL', [
                's3_key' => $s3Key,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Resize image to fit within max dimensions while maintaining aspect ratio.
     * Returns JPEG for smaller file size.
     * Memory-optimized: frees original data as soon as possible.
     */
    private function resizeImageForAI(string $imageData, int $maxDimension): ?string
    {
        try {
            // Check image dimensions first without loading full image
            $imageInfo = @getimagesizefromstring($imageData);
            if (! $imageInfo) {
                Log::warning('Failed to get image info for resizing');

                return $imageData;
            }

            $originalWidth = $imageInfo[0];
            $originalHeight = $imageInfo[1];

            // Check if resize is needed
            if ($originalWidth <= $maxDimension && $originalHeight <= $maxDimension) {
                Log::info('Image already within size limits, no resize needed', [
                    'dimensions' => "{$originalWidth}x{$originalHeight}",
                ]);

                return $imageData;
            }

            // Calculate new dimensions maintaining aspect ratio
            if ($originalWidth > $originalHeight) {
                $newWidth = $maxDimension;
                $newHeight = (int) ($originalHeight * ($maxDimension / $originalWidth));
            } else {
                $newHeight = $maxDimension;
                $newWidth = (int) ($originalWidth * ($maxDimension / $originalHeight));
            }

            Log::info('Resizing image for AI analysis', [
                'original' => "{$originalWidth}x{$originalHeight}",
                'new' => "{$newWidth}x{$newHeight}",
                'original_size_mb' => round(strlen($imageData) / 1024 / 1024, 2),
            ]);

            // Load original image
            $image = @imagecreatefromstring($imageData);

            // Free original data immediately after creating GD resource
            unset($imageData);

            if (! $image) {
                Log::warning('Failed to create image from string for resizing');

                return null;
            }

            // Create resized image
            $resized = imagecreatetruecolor($newWidth, $newHeight);

            // White background (better for construction drawings)
            $white = imagecolorallocate($resized, 255, 255, 255);
            imagefill($resized, 0, 0, $white);

            // High quality resizing
            imagecopyresampled(
                $resized, $image,
                0, 0, 0, 0,
                $newWidth, $newHeight,
                $originalWidth, $originalHeight
            );

            // Free original image immediately
            imagedestroy($image);

            // Output as JPEG for smaller file size (good for AI analysis)
            ob_start();
            imagejpeg($resized, null, 80); // 80% quality - good balance for drawings
            $output = ob_get_clean();

            imagedestroy($resized);

            Log::info('Image resized successfully', [
                'output_size_kb' => round(strlen($output) / 1024),
            ]);

            return $output;
        } catch (\Exception $e) {
            Log::error('Failed to resize image', ['error' => $e->getMessage()]);

            return $imageData; // Return original on error
        }
    }

    /**
     * Parse JSON from GPT response (handles markdown code blocks).
     */
    private function parseJsonResponse(string $content): ?array
    {
        // Try to extract JSON from markdown code block
        if (preg_match('/```json\s*([\s\S]*?)\s*```/', $content, $matches)) {
            $jsonStr = $matches[1];
        } elseif (preg_match('/```\s*([\s\S]*?)\s*```/', $content, $matches)) {
            $jsonStr = $matches[1];
        } else {
            // Try parsing the whole content as JSON
            $jsonStr = $content;
        }

        $decoded = json_decode(trim($jsonStr), true);
        if (json_last_error() === JSON_ERROR_NONE) {
            return $decoded;
        }

        Log::warning('Failed to parse JSON response', [
            'error' => json_last_error_msg(),
            'content_preview' => substr($content, 0, 500),
        ]);

        return null;
    }

    /**
     * Normalize AI change payloads to ensure coordinates are present and bounded.
     *
     * @param  array<int, array<string, mixed>>  $changes
     * @return array<int, array<string, mixed>>
     */
    private function normalizeChanges(array $changes): array
    {
        return collect($changes)
            ->map(function ($change) {
                $coords = $change['coordinates'] ?? $change['bbox'] ?? null;
                if (is_array($coords)) {
                    $normalized = $this->normalizeCoordinates($coords);
                    if ($normalized) {
                        $change['coordinates'] = $normalized;
                    }
                }

                return $change;
            })
            ->values()
            ->all();
    }

    /**
     * Normalize coordinate structures coming back from the model.
     *
     * Ensures values are between 0-1 and converts percentages to decimals.
     * Note: We now instruct the AI to provide CENTER coordinates directly,
     * so we no longer need to adjust x/y based on width/height.
     */
    private function normalizeCoordinates(array $coords): ?array
    {
        $x = $coords['x'] ?? $coords['left'] ?? null;
        $y = $coords['y'] ?? $coords['top'] ?? null;
        $width = $coords['width'] ?? $coords['w'] ?? null;
        $height = $coords['height'] ?? $coords['h'] ?? null;

        if (! is_numeric($x) || ! is_numeric($y)) {
            return null;
        }

        $x = (float) $x;
        $y = (float) $y;
        $width = is_numeric($width) ? (float) $width : null;
        $height = is_numeric($height) ? (float) $height : null;

        // Convert percentage style values to decimals
        if ($x > 1 || $y > 1) {
            if ($x <= 100 && $y <= 100) {
                $x = $x / 100;
                $y = $y / 100;
            }
        }
        if ($width !== null && $width > 1 && $width <= 100) {
            $width = $width / 100;
        }
        if ($height !== null && $height > 1 && $height <= 100) {
            $height = $height / 100;
        }

        // Clamp to [0, 1]
        $x = max(0, min(1, $x));
        $y = max(0, min(1, $y));
        if ($width !== null) {
            $width = max(0, min(1, $width));
        }
        if ($height !== null) {
            $height = max(0, min(1, $height));
        }

        // NOTE: We now instruct the AI to provide CENTER coordinates directly.
        // Previously we added width/2 and height/2 to convert from top-left corner,
        // but this caused double-centering issues. The AI prompt now explicitly
        // asks for center coordinates, so no adjustment is needed here.

        return [
            'page' => isset($coords['page']) && is_numeric($coords['page'])
                ? max(1, (int) $coords['page'])
                : 1,
            'x' => $x,
            'y' => $y,
            'width' => $width,
            'height' => $height,
            'reference' => $coords['reference'] ?? 'image_2',
        ];
    }

    /**
     * Get full resolution image as base64 data URL (no resizing).
     * Used for Pass 2 cropping where we need original detail.
     */
    public function getImageDataUrlFullRes(string $s3Key): ?string
    {
        try {
            $contents = Storage::disk('s3')->get($s3Key);
            if (! $contents) {
                return null;
            }

            $finfo = new \finfo(FILEINFO_MIME_TYPE);
            $mimeType = $finfo->buffer($contents) ?: 'image/png';

            $base64Data = base64_encode($contents);

            Log::info('Full resolution image loaded', [
                's3_key' => $s3Key,
                'size_kb' => round(strlen($contents) / 1024),
            ]);

            return 'data:'.$mimeType.';base64,'.$base64Data;
        } catch (\Exception $e) {
            Log::error('Failed to get full res image', [
                's3_key' => $s3Key,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Get raw image data from S3 (for cropping operations).
     */
    public function getRawImageData(string $s3Key): ?string
    {
        try {
            return Storage::disk('s3')->get($s3Key);
        } catch (\Exception $e) {
            Log::error('Failed to get raw image data', [
                's3_key' => $s3Key,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Crop a region from an image based on normalized bounding box.
     *
     * @param  string  $imageData  Raw image data
     * @param  array  $boundingBox  Normalized coords: x, y (center), width, height (0-1 range)
     * @param  float  $paddingPercent  Extra padding around the box (0.1 = 10%)
     * @return string|null Cropped image as base64 data URL
     */
    public function cropImageRegion(string $imageData, array $boundingBox, float $paddingPercent = 0.1): ?string
    {
        try {
            $imageInfo = @getimagesizefromstring($imageData);
            if (! $imageInfo) {
                Log::warning('Failed to get image info for cropping');

                return null;
            }

            $imgWidth = $imageInfo[0];
            $imgHeight = $imageInfo[1];

            // Extract normalized coordinates (center-based)
            $centerX = $boundingBox['x'] ?? 0.5;
            $centerY = $boundingBox['y'] ?? 0.5;
            $boxWidth = $boundingBox['width'] ?? 0.2;
            $boxHeight = $boundingBox['height'] ?? 0.2;

            // Add padding
            $boxWidth = min(1, $boxWidth * (1 + $paddingPercent * 2));
            $boxHeight = min(1, $boxHeight * (1 + $paddingPercent * 2));

            // Convert to pixel coordinates
            $cropWidth = (int) ($boxWidth * $imgWidth);
            $cropHeight = (int) ($boxHeight * $imgHeight);
            $cropX = (int) (($centerX - $boxWidth / 2) * $imgWidth);
            $cropY = (int) (($centerY - $boxHeight / 2) * $imgHeight);

            // Clamp to image bounds
            $cropX = max(0, min($imgWidth - $cropWidth, $cropX));
            $cropY = max(0, min($imgHeight - $cropHeight, $cropY));
            $cropWidth = min($cropWidth, $imgWidth - $cropX);
            $cropHeight = min($cropHeight, $imgHeight - $cropY);

            // Ensure minimum size
            $cropWidth = max(100, $cropWidth);
            $cropHeight = max(100, $cropHeight);

            Log::info('Cropping image region', [
                'image_size' => "{$imgWidth}x{$imgHeight}",
                'crop_region' => "x:{$cropX}, y:{$cropY}, w:{$cropWidth}, h:{$cropHeight}",
                'normalized_box' => $boundingBox,
            ]);

            // Create image from data
            $image = @imagecreatefromstring($imageData);
            if (! $image) {
                Log::warning('Failed to create image for cropping');

                return null;
            }

            // Create cropped image
            $cropped = imagecreatetruecolor($cropWidth, $cropHeight);
            $white = imagecolorallocate($cropped, 255, 255, 255);
            imagefill($cropped, 0, 0, $white);

            imagecopy(
                $cropped, $image,
                0, 0,
                $cropX, $cropY,
                $cropWidth, $cropHeight
            );

            imagedestroy($image);
            $image = null; // Help GC

            // Output as JPEG for smaller file size (90% quality is sufficient for AI)
            ob_start();
            imagejpeg($cropped, null, 90);
            $output = ob_get_clean();

            imagedestroy($cropped);
            $cropped = null; // Help GC

            $result = 'data:image/jpeg;base64,'.base64_encode($output);
            unset($output); // Free output buffer

            return $result;
        } catch (\Exception $e) {
            Log::error('Failed to crop image region', ['error' => $e->getMessage()]);

            return null;
        }
    }

    /**
     * Two-pass comparison: overview first, then zoom into change areas.
     *
     * @param  string  $imageA  Resized image A (for Pass 1)
     * @param  string  $imageB  Resized image B (for Pass 1)
     * @param  string|null  $rawImageA  Full resolution raw image data A (for Pass 2 cropping)
     * @param  string|null  $rawImageB  Full resolution raw image data B (for Pass 2 cropping)
     * @param  string  $context  Trade context
     * @param  string|null  $additionalPrompt  User instructions
     */
    public function compareRevisionsWithZoom(
        string $imageA,
        string $imageB,
        ?string $rawImageA,
        ?string $rawImageB,
        string $context = '',
        ?string $additionalPrompt = null
    ): array {
        if (! $this->apiKey) {
            return [
                'success' => false,
                'summary' => null,
                'changes' => [],
                'error' => 'OpenAI API key not configured',
            ];
        }

        // ========== PASS 1: Location Detection ==========
        Log::info('Starting two-pass comparison - Pass 1 (location detection)');

        $pass1Result = $this->runPass1LocationDetection($imageA, $imageB, $context);

        if (! $pass1Result['success']) {
            return $pass1Result;
        }

        $areasOfChange = $pass1Result['areas_of_change'] ?? [];

        if (empty($areasOfChange)) {
            Log::info('Pass 1 found no areas of change');

            return [
                'success' => true,
                'summary' => $pass1Result['summary'] ?? 'No significant changes detected between revisions.',
                'changes' => [],
                'change_count' => 0,
                'confidence' => $pass1Result['confidence'] ?? 'high',
                'notes' => 'Two-pass analysis completed. No areas required detail zoom.',
                'error' => null,
            ];
        }

        // ========== PASS 2: Detail Analysis ==========
        Log::info('Starting Pass 2 (detail analysis)', ['areas_count' => count($areasOfChange)]);

        // If we don't have raw images, fall back to single-pass result
        if (! $rawImageA || ! $rawImageB) {
            Log::warning('No raw images for Pass 2, using Pass 1 results only');

            return $this->convertPass1ToFinalResult($pass1Result, $additionalPrompt);
        }

        $detailedChanges = [];

        foreach ($areasOfChange as $index => $area) {
            $boundingBox = $area['bounding_box'] ?? null;
            if (! $boundingBox) {
                Log::warning('Area missing bounding box, skipping', ['area_id' => $area['area_id'] ?? $index]);

                continue;
            }

            // Crop the regions from both images
            $croppedA = $this->cropImageRegion($rawImageA, $boundingBox, 0.15);
            $croppedB = $this->cropImageRegion($rawImageB, $boundingBox, 0.15);

            if (! $croppedA || ! $croppedB) {
                Log::warning('Failed to crop region, using Pass 1 data', ['area_id' => $area['area_id'] ?? $index]);
                $detailedChanges[] = $this->convertAreaToChange($area, $boundingBox);

                continue;
            }

            // Run detail analysis on cropped region
            $detailResult = $this->runPass2DetailAnalysis(
                $croppedA,
                $croppedB,
                $area,
                $context,
                $additionalPrompt
            );

            if ($detailResult['success'] && ! empty($detailResult['change'])) {
                $change = $detailResult['change'];
                // Use the bounding box center as the final coordinate
                $change['coordinates'] = [
                    'page' => 1,
                    'x' => $boundingBox['x'],
                    'y' => $boundingBox['y'],
                    'width' => $boundingBox['width'],
                    'height' => $boundingBox['height'],
                    'reference' => 'image_2',
                ];
                $detailedChanges[] = $change;
            } else {
                // Fall back to Pass 1 data
                $detailedChanges[] = $this->convertAreaToChange($area, $boundingBox);
            }
        }

        return [
            'success' => true,
            'summary' => $pass1Result['summary'] ?? null,
            'changes' => $detailedChanges,
            'change_count' => count($detailedChanges),
            'confidence' => $pass1Result['confidence'] ?? 'medium',
            'notes' => 'Two-pass analysis completed with detail zoom on '.count($areasOfChange).' areas.',
            'error' => null,
        ];
    }

    /**
     * Pass 1: Detect locations of changes (overview).
     */
    private function runPass1LocationDetection(string $imageA, string $imageB, string $context): array
    {
        $tradeContext = $context ?: 'walls and ceilings construction drawings';

        $prompt = <<<PROMPT
You are analyzing two construction drawing revisions to LOCATE areas of change for a {$tradeContext} subcontractor.

Your goal is to identify WHERE changes occurred. Look for:
- Areas with different line work between the two images
- Dimensional changes
- Added or removed elements
- Revision clouds or delta markers
- Any visible differences

Return a JSON with change LOCATIONS:
{
    "summary": "Brief summary of overall changes",
    "areas_of_change": [
        {
            "area_id": 1,
            "location_description": "Brief description (e.g., 'Near gridline C-4', 'Upper right bathroom')",
            "bounding_box": {
                "x": 0.3,
                "y": 0.5,
                "width": 0.2,
                "height": 0.15
            },
            "change_type_hint": "dimension|addition|removal|modification|annotation"
        }
    ],
    "total_areas": number,
    "confidence": "low|medium|high"
}

COORDINATE INSTRUCTIONS:
- x, y are the CENTER of the change area (0-1 range, 0=left/top, 1=right/bottom)
- width, height define the bounding box size (0-1 range)
- Make bounding boxes GENEROUS - include extra context around the change
- It's better to include too much area than miss detail

Focus on finding ALL areas that look different between the images.
PROMPT;

        try {
            $response = Http::withToken($this->apiKey)
                ->timeout(90)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => $this->model,
                    'messages' => [
                        [
                            'role' => 'user',
                            'content' => [
                                ['type' => 'text', 'text' => $prompt],
                                ['type' => 'image_url', 'image_url' => ['url' => $imageA, 'detail' => 'high']],
                                ['type' => 'image_url', 'image_url' => ['url' => $imageB, 'detail' => 'high']],
                            ],
                        ],
                    ],
                    'max_tokens' => 2048,
                    'temperature' => 0.1,
                ]);

            if (! $response->successful()) {
                Log::error('Pass 1 API failed', ['status' => $response->status()]);

                return ['success' => false, 'error' => 'Pass 1 API error: '.$response->status()];
            }

            $data = $response->json();
            $content = $data['choices'][0]['message']['content'] ?? '';

            Log::info('Pass 1 response received', [
                'content_length' => strlen($content),
                'usage' => $data['usage'] ?? null,
            ]);

            $parsed = $this->parseJsonResponse($content);

            if (! $parsed) {
                return ['success' => false, 'error' => 'Failed to parse Pass 1 response'];
            }

            return [
                'success' => true,
                'summary' => $parsed['summary'] ?? null,
                'areas_of_change' => $parsed['areas_of_change'] ?? [],
                'confidence' => $parsed['confidence'] ?? 'medium',
            ];

        } catch (\Exception $e) {
            Log::error('Pass 1 error', ['error' => $e->getMessage()]);

            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Pass 2: Analyze cropped region in detail.
     */
    private function runPass2DetailAnalysis(
        string $croppedA,
        string $croppedB,
        array $areaHint,
        string $context,
        ?string $additionalPrompt
    ): array {
        $tradeContext = $context ?: 'walls and ceilings';
        $hintText = $areaHint['location_description'] ?? 'a specific area';
        $changeTypeHint = $areaHint['change_type_hint'] ?? 'modification';

        $additionalInstructions = $additionalPrompt
            ? "\n\nADDITIONAL USER INSTRUCTIONS:\n{$additionalPrompt}\n"
            : '';

        $prompt = <<<PROMPT
You are analyzing a ZOOMED-IN CROPPED SECTION of a construction drawing showing a change area.

This area was identified as having a potential {$changeTypeHint} near: {$hintText}

CRITICAL: Read ALL text labels visible in these cropped images:
- Room names/numbers (e.g., "PWDR PD2" = Powder Room, "BR" = Bathroom, "CONF" = Conference)
- Dimensions and measurements
- Specification notes
- Grid line references

For {$tradeContext} scope, analyze:
1. What specifically changed between the two images?
2. What room/area is this? (READ THE LABEL, don't guess)
3. Impact on walls and ceilings work
4. Is this a potential change order?
{$additionalInstructions}
Return detailed analysis as JSON:
{
    "type": "dimension|addition|removal|modification|annotation|specification",
    "description": "Detailed description including specific room name READ from the drawing",
    "room_name": "The actual room label from the drawing (e.g., 'PWDR PD2', 'CONF 101')",
    "location": "Specific location with room name and any grid references visible",
    "impact": "low|medium|high",
    "potential_change_order": true or false,
    "reason": "Why this might require a change order (if applicable)",
    "confidence": "low|medium|high"
}

Be specific and accurate. If you cannot clearly read labels, say so.
PROMPT;

        try {
            $response = Http::withToken($this->apiKey)
                ->timeout(60)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => $this->model,
                    'messages' => [
                        [
                            'role' => 'user',
                            'content' => [
                                ['type' => 'text', 'text' => $prompt],
                                ['type' => 'image_url', 'image_url' => ['url' => $croppedA, 'detail' => 'high']],
                                ['type' => 'image_url', 'image_url' => ['url' => $croppedB, 'detail' => 'high']],
                            ],
                        ],
                    ],
                    'max_tokens' => 1024,
                    'temperature' => 0.1,
                ]);

            if (! $response->successful()) {
                Log::warning('Pass 2 API failed for area', ['hint' => $hintText]);

                return ['success' => false];
            }

            $data = $response->json();
            $content = $data['choices'][0]['message']['content'] ?? '';

            Log::info('Pass 2 response for area', [
                'hint' => $hintText,
                'usage' => $data['usage'] ?? null,
            ]);

            $parsed = $this->parseJsonResponse($content);

            if (! $parsed) {
                return ['success' => false];
            }

            // Build location from room_name if available
            $location = $parsed['location'] ?? $parsed['room_name'] ?? $hintText;
            if (! empty($parsed['room_name']) && strpos($location, $parsed['room_name']) === false) {
                $location = $parsed['room_name'].' - '.$location;
            }

            return [
                'success' => true,
                'change' => [
                    'type' => $parsed['type'] ?? $areaHint['change_type_hint'] ?? 'modification',
                    'description' => $parsed['description'] ?? 'Change detected in '.$hintText,
                    'location' => $location,
                    'impact' => $parsed['impact'] ?? 'medium',
                    'potential_change_order' => $parsed['potential_change_order'] ?? false,
                    'reason' => $parsed['reason'] ?? null,
                ],
            ];

        } catch (\Exception $e) {
            Log::error('Pass 2 error', ['error' => $e->getMessage(), 'hint' => $hintText]);

            return ['success' => false];
        }
    }

    /**
     * Convert Pass 1 area to final change format (fallback).
     */
    private function convertAreaToChange(array $area, array $boundingBox): array
    {
        return [
            'type' => $area['change_type_hint'] ?? 'modification',
            'description' => 'Change detected: '.($area['location_description'] ?? 'unspecified area'),
            'location' => $area['location_description'] ?? 'Unknown location',
            'impact' => 'medium',
            'potential_change_order' => false,
            'reason' => null,
            'coordinates' => [
                'page' => 1,
                'x' => $boundingBox['x'] ?? 0.5,
                'y' => $boundingBox['y'] ?? 0.5,
                'width' => $boundingBox['width'] ?? 0.1,
                'height' => $boundingBox['height'] ?? 0.1,
                'reference' => 'image_2',
            ],
        ];
    }

    /**
     * Convert Pass 1 result to final format when Pass 2 can't run.
     */
    private function convertPass1ToFinalResult(array $pass1Result, ?string $additionalPrompt): array
    {
        $changes = [];
        foreach ($pass1Result['areas_of_change'] ?? [] as $area) {
            $boundingBox = $area['bounding_box'] ?? ['x' => 0.5, 'y' => 0.5, 'width' => 0.1, 'height' => 0.1];
            $changes[] = $this->convertAreaToChange($area, $boundingBox);
        }

        return [
            'success' => true,
            'summary' => $pass1Result['summary'] ?? null,
            'changes' => $changes,
            'change_count' => count($changes),
            'confidence' => $pass1Result['confidence'] ?? 'low',
            'notes' => 'Single-pass analysis (no full resolution images available for detail zoom).',
            'error' => null,
        ];
    }

    /**
     * Hybrid comparison: CV for detection + AI for classification.
     *
     * This approach uses:
     * 1. OpenCV (Python service) for deterministic, pixel-accurate change detection
     * 2. GPT-4o only to classify and describe the changes found by CV
     *
     * This provides accurate locations (from CV) with intelligent descriptions (from AI).
     *
     * @param  string  $imageA  Base64 image A (older revision)
     * @param  string  $imageB  Base64 image B (newer revision)
     * @param  string|null  $rawImageA  Raw image data A for high-res cropping
     * @param  string|null  $rawImageB  Raw image data B for high-res cropping
     * @param  string  $context  Trade context
     * @param  string|null  $additionalPrompt  Additional user instructions
     */
    public function compareRevisionsHybrid(
        string $imageA,
        string $imageB,
        ?string $rawImageA,
        ?string $rawImageB,
        string $context = '',
        ?string $additionalPrompt = null
    ): array {
        // Check if CV service is available
        $cvService = new CVDrawingComparisonService;

        if (! config('services.cv_comparison.enabled', true) || ! $cvService->isHealthy()) {
            Log::warning('CV service not available, falling back to AI-only comparison');

            return $this->compareRevisionsWithZoom($imageA, $imageB, $rawImageA, $rawImageB, $context, $additionalPrompt);
        }

        try {
            // CV-only detection (no automatic AI classification)
            Log::info('CV comparison: Starting detection');

            $cvResult = $cvService->compare($imageA, $imageB, [
                'diff_threshold' => 25,
                'min_contour_area' => 400,
                'dilate_iterations' => 3,
            ]);

            if (! $cvResult['success']) {
                Log::warning('CV detection failed, falling back to AI-only', [
                    'error' => $cvResult['error'] ?? 'Unknown error',
                ]);

                return $this->compareRevisionsWithZoom($imageA, $imageB, $rawImageA, $rawImageB, $context, $additionalPrompt);
            }

            $cvRegions = $cvResult['regions'] ?? [];
            $alignmentInfo = $cvResult['alignment'] ?? [];

            Log::info('CV detection complete', [
                'regions_found' => count($cvRegions),
                'alignment_success' => $alignmentInfo['success'] ?? false,
                'inliers' => $alignmentInfo['inliers'] ?? 0,
            ]);

            if (empty($cvRegions)) {
                return [
                    'success' => true,
                    'summary' => 'No significant changes detected between revisions.',
                    'changes' => [],
                    'change_count' => 0,
                    'confidence' => 'high',
                    'notes' => 'CV-based analysis found no pixel differences above threshold.',
                    'method' => 'cv_only',
                    'cv_alignment' => $alignmentInfo,
                    'diff_image' => $cvResult['diff_image'] ?? null,
                    'visualization' => $cvResult['visualization'] ?? null,
                    'error' => null,
                ];
            }

            // Convert CV regions to changes (no AI, just CV data)
            $changes = [];
            foreach ($cvRegions as $region) {
                $boundingBox = $region['bounding_box'] ?? null;
                if (! $boundingBox) {
                    continue;
                }

                $areaPercent = $region['area_percent'] ?? 0;
                $changes[] = [
                    'type' => 'modification',
                    'description' => 'Change detected (area: '.number_format($areaPercent, 2).'% of drawing)',
                    'location' => 'Region #'.($region['region_id'] ?? count($changes) + 1),
                    'impact' => $areaPercent > 2 ? 'high' : ($areaPercent > 0.5 ? 'medium' : 'low'),
                    'potential_change_order' => $areaPercent > 1,
                    'reason' => null,
                    'coordinates' => [
                        'page' => 1,
                        'x' => $boundingBox['x'],
                        'y' => $boundingBox['y'],
                        'width' => $boundingBox['width'],
                        'height' => $boundingBox['height'],
                        'reference' => 'image_2',
                    ],
                    'pixel_coords' => $region['pixel_coords'] ?? null,
                    'area_percent' => $areaPercent,
                    'source' => 'cv_detection',
                ];
            }

            // Simple summary without AI
            $highImpact = count(array_filter($changes, fn ($c) => $c['impact'] === 'high'));
            $mediumImpact = count(array_filter($changes, fn ($c) => $c['impact'] === 'medium'));
            $summary = count($changes).' change(s) detected';
            if ($highImpact > 0) {
                $summary .= " ({$highImpact} high impact)";
            } elseif ($mediumImpact > 0) {
                $summary .= " ({$mediumImpact} medium impact)";
            }

            return [
                'success' => true,
                'summary' => $summary,
                'changes' => $changes,
                'change_count' => count($changes),
                'confidence' => 'high',
                'notes' => 'CV-only detection. Use "Describe with AI" on individual changes for detailed analysis.',
                'method' => 'cv_only',
                'cv_alignment' => $alignmentInfo,
                'diff_image' => $cvResult['diff_image'] ?? null,
                'visualization' => $cvResult['visualization'] ?? null,
                'error' => null,
            ];

        } catch (\Exception $e) {
            Log::error('CV comparison error', ['error' => $e->getMessage()]);

            return $this->compareRevisionsWithZoom($imageA, $imageB, $rawImageA, $rawImageB, $context, $additionalPrompt);
        }
    }

    /**
     * Describe a specific observation/region using AI (on-demand).
     *
     * @param  string  $imagePathA  S3 path to image A
     * @param  string  $imagePathB  S3 path to image B
     * @param  array  $boundingBox  Normalized bounding box [x, y, width, height]
     * @param  string  $context  Trade context
     * @return array AI description result
     */
    public function describeRegionWithAI(
        string $imagePathA,
        string $imagePathB,
        array $boundingBox,
        string $context = ''
    ): array {
        if (! $this->apiKey) {
            return [
                'success' => false,
                'error' => 'OpenAI API key not configured.',
            ];
        }

        // Temporarily increase memory limit for image processing
        $originalMemoryLimit = ini_get('memory_limit');
        ini_set('memory_limit', '1G');

        try {
            // Skip cropping to avoid memory issues with large images
            // Instead, send full resized images and tell AI where to look
            $imageA = $this->getImageDataUrl($imagePathA, 1536);
            if (! $imageA) {
                ini_set('memory_limit', $originalMemoryLimit);

                return [
                    'success' => false,
                    'error' => 'Failed to load image A from storage.',
                ];
            }

            $imageB = $this->getImageDataUrl($imagePathB, 1536);
            if (! $imageB) {
                unset($imageA);
                ini_set('memory_limit', $originalMemoryLimit);

                return [
                    'success' => false,
                    'error' => 'Failed to load image B from storage.',
                ];
            }

            $tradeContext = $context ?: 'walls and ceilings';

            // Convert bounding box to percentage for the prompt
            $centerX = round($boundingBox['x'] * 100);
            $centerY = round($boundingBox['y'] * 100);
            $width = round(($boundingBox['width'] ?? 0.15) * 100);
            $height = round(($boundingBox['height'] ?? 0.15) * 100);

            $prompt = <<<PROMPT
You are analyzing TWO construction drawing revisions where a change was detected by computer vision.

FOCUS AREA: The change is located at approximately {$centerX}% from left, {$centerY}% from top.
The region of interest spans roughly {$width}% wide by {$height}% tall around that center point.

CRITICAL: Look at that specific area and read ALL visible text labels:
- Room names (e.g., "PWDR" = Powder Room, "BR" = Bathroom, "ELEC" = Electrical Room)
- Dimensions and measurements
- Specification notes
- Grid references

For {$tradeContext} scope, analyze:
1. What specifically changed in that region? (Be precise)
2. What room/area is this? (READ the label, don't guess)
3. Impact to walls and ceilings work
4. Potential for change order

Return JSON:
{
    "type": "dimension|addition|removal|modification|annotation|specification",
    "description": "Specific description of what changed, including room name READ from drawing",
    "room_name": "Actual room label from drawing (e.g., 'PWDR PD2')",
    "location": "Room name + grid reference if visible",
    "impact": "low|medium|high",
    "potential_change_order": true or false,
    "reason": "Why this might require a change order (if applicable)"
}

If you cannot read labels clearly, describe what you CAN see and say labels are unclear.
PROMPT;

            $response = Http::withToken($this->apiKey)
                ->timeout(60)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => $this->model,
                    'messages' => [
                        [
                            'role' => 'user',
                            'content' => [
                                ['type' => 'text', 'text' => $prompt],
                                ['type' => 'image_url', 'image_url' => ['url' => $imageA, 'detail' => 'high']],
                                ['type' => 'image_url', 'image_url' => ['url' => $imageB, 'detail' => 'high']],
                            ],
                        ],
                    ],
                    'max_tokens' => 800,
                    'temperature' => 0.1,
                ]);

            // Free images after sending
            unset($imageA, $imageB);

            if (! $response->successful()) {
                Log::warning('AI describe failed', ['status' => $response->status()]);
                ini_set('memory_limit', $originalMemoryLimit);

                return [
                    'success' => false,
                    'error' => 'AI request failed.',
                ];
            }

            $data = $response->json();
            $content = $data['choices'][0]['message']['content'] ?? '';
            $parsed = $this->parseJsonResponse($content);

            if (! $parsed) {
                ini_set('memory_limit', $originalMemoryLimit);

                return [
                    'success' => false,
                    'error' => 'Failed to parse AI response.',
                    'raw_response' => $content,
                ];
            }

            ini_set('memory_limit', $originalMemoryLimit);

            return [
                'success' => true,
                'type' => $parsed['type'] ?? 'modification',
                'description' => $parsed['description'] ?? 'Change detected',
                'room_name' => $parsed['room_name'] ?? null,
                'location' => $parsed['location'] ?? $parsed['room_name'] ?? null,
                'impact' => $parsed['impact'] ?? 'medium',
                'potential_change_order' => $parsed['potential_change_order'] ?? false,
                'reason' => $parsed['reason'] ?? null,
            ];

        } catch (\Exception $e) {
            ini_set('memory_limit', $originalMemoryLimit);
            Log::error('AI describe error', ['error' => $e->getMessage()]);

            return [
                'success' => false,
                'error' => 'Failed to analyze region: '.$e->getMessage(),
            ];
        }
    }

    /**
     * Classify a CV-detected region using AI.
     *
     * @param  array  $region  CV region data with bounding_box and pixel_coords
     * @param  string|null  $rawImageA  Raw image data for cropping
     * @param  string|null  $rawImageB  Raw image data for cropping
     * @param  string  $context  Trade context
     * @param  string|null  $additionalPrompt  Additional instructions
     * @return array Classified change data
     */
    private function classifyRegionWithAI(
        array $region,
        ?string $rawImageA,
        ?string $rawImageB,
        string $context,
        ?string $additionalPrompt
    ): array {
        $boundingBox = $region['bounding_box'];
        $pixelCoords = $region['pixel_coords'] ?? null;
        $areaPercent = $region['area_percent'] ?? 0;

        // Default change structure using CV coordinates
        $defaultChange = [
            'type' => 'modification',
            'description' => "Change detected in region #{$region['region_id']} (area: {$areaPercent}% of drawing)",
            'location' => 'Region '.($region['region_id'] ?? 'unknown'),
            'impact' => $areaPercent > 2 ? 'high' : ($areaPercent > 0.5 ? 'medium' : 'low'),
            'potential_change_order' => $areaPercent > 1,
            'reason' => null,
            'coordinates' => [
                'page' => 1,
                'x' => $boundingBox['x'],
                'y' => $boundingBox['y'],
                'width' => $boundingBox['width'],
                'height' => $boundingBox['height'],
                'reference' => 'image_2',
            ],
            'pixel_coords' => $pixelCoords,
            'area_percent' => $areaPercent,
            'source' => 'cv_detection',
        ];

        // If no raw images for cropping, return default
        if (! $rawImageA || ! $rawImageB || ! $this->apiKey) {
            return $defaultChange;
        }

        try {
            // Crop the regions for AI analysis
            $croppedA = $this->cropImageRegion($rawImageA, $boundingBox, 0.2);
            $croppedB = $this->cropImageRegion($rawImageB, $boundingBox, 0.2);

            if (! $croppedA || ! $croppedB) {
                return $defaultChange;
            }

            $tradeContext = $context ?: 'walls and ceilings';
            $additionalInstructions = $additionalPrompt
                ? "\n\nADDITIONAL USER INSTRUCTIONS:\n{$additionalPrompt}\n"
                : '';

            $prompt = <<<PROMPT
You are analyzing a CROPPED SECTION of a construction drawing where a change was ALREADY DETECTED by computer vision.

The CV system found pixel differences in this area. Your job is to DESCRIBE and CLASSIFY what changed.

CRITICAL: Read ALL visible text labels:
- Room names (e.g., "PWDR" = Powder Room, "BR" = Bathroom, "ELEC" = Electrical Room)
- Dimensions and measurements
- Specification notes
- Grid references

For {$tradeContext} scope, analyze:
1. What specifically changed? (Be precise)
2. What room/area is this? (READ the label, don't guess)
3. Impact to walls and ceilings work
4. Potential for change order
{$additionalInstructions}
Return JSON:
{
    "type": "dimension|addition|removal|modification|annotation|specification",
    "description": "Specific description of what changed, including room name READ from drawing",
    "room_name": "Actual room label from drawing (e.g., 'PWDR PD2')",
    "location": "Room name + grid reference if visible",
    "impact": "low|medium|high",
    "potential_change_order": true or false,
    "reason": "Why this might require a change order (if applicable)"
}

If you cannot read labels clearly, describe what you CAN see and say labels are unclear.
PROMPT;

            $response = Http::withToken($this->apiKey)
                ->timeout(45)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => $this->model,
                    'messages' => [
                        [
                            'role' => 'user',
                            'content' => [
                                ['type' => 'text', 'text' => $prompt],
                                ['type' => 'image_url', 'image_url' => ['url' => $croppedA, 'detail' => 'high']],
                                ['type' => 'image_url', 'image_url' => ['url' => $croppedB, 'detail' => 'high']],
                            ],
                        ],
                    ],
                    'max_tokens' => 800,
                    'temperature' => 0.1,
                ]);

            if (! $response->successful()) {
                Log::warning('AI classification failed for region', ['region_id' => $region['region_id']]);

                return $defaultChange;
            }

            $data = $response->json();
            $content = $data['choices'][0]['message']['content'] ?? '';
            $parsed = $this->parseJsonResponse($content);

            if (! $parsed) {
                return $defaultChange;
            }

            // Build location string
            $location = $parsed['location'] ?? $parsed['room_name'] ?? 'Unknown';
            if (! empty($parsed['room_name']) && strpos($location, $parsed['room_name']) === false) {
                $location = $parsed['room_name'].' - '.$location;
            }

            return [
                'type' => $parsed['type'] ?? 'modification',
                'description' => $parsed['description'] ?? $defaultChange['description'],
                'location' => $location,
                'impact' => $parsed['impact'] ?? $defaultChange['impact'],
                'potential_change_order' => $parsed['potential_change_order'] ?? $defaultChange['potential_change_order'],
                'reason' => $parsed['reason'] ?? null,
                'coordinates' => $defaultChange['coordinates'], // Always use CV coordinates
                'pixel_coords' => $pixelCoords,
                'area_percent' => $areaPercent,
                'source' => 'hybrid_cv_ai',
            ];

        } catch (\Exception $e) {
            Log::error('AI classification error', [
                'region_id' => $region['region_id'],
                'error' => $e->getMessage(),
            ]);

            return $defaultChange;
        }
    }

    /**
     * Generate an overall summary of changes using AI.
     */
    private function generateSummaryWithAI(array $changes, string $context): string
    {
        if (empty($changes)) {
            return 'No significant changes detected between revisions.';
        }

        if (! $this->apiKey) {
            return count($changes).' change(s) detected between revisions.';
        }

        try {
            $changesList = collect($changes)->map(function ($c) {
                return "- {$c['type']}: {$c['description']} at {$c['location']}";
            })->implode("\n");

            $tradeContext = $context ?: 'walls and ceilings';

            $prompt = <<<PROMPT
Summarize these construction drawing changes for a {$tradeContext} subcontractor in 1-2 sentences:

{$changesList}

Focus on the most impactful changes for walls and ceilings scope.
Return only the summary text, no JSON.
PROMPT;

            $response = Http::withToken($this->apiKey)
                ->timeout(30)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => $this->model,
                    'messages' => [
                        ['role' => 'user', 'content' => $prompt],
                    ],
                    'max_tokens' => 200,
                    'temperature' => 0.3,
                ]);

            if ($response->successful()) {
                $data = $response->json();

                return trim($data['choices'][0]['message']['content'] ?? '') ?: count($changes).' change(s) detected.';
            }
        } catch (\Exception $e) {
            Log::warning('Summary generation failed', ['error' => $e->getMessage()]);
        }

        return count($changes).' change(s) detected between revisions.';
    }
}
