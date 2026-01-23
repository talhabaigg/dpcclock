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
     * @param string $imageA Base64 or URL of first revision (older)
     * @param string $imageB Base64 or URL of second revision (newer)
     * @param string $context Optional context about the drawings (e.g., "walls and ceilings")
     * @param string|null $additionalPrompt Optional additional instructions for refinement
     * @return array{success: bool, summary: string|null, changes: array, error: string|null}
     */
    public function compareRevisions(string $imageA, string $imageB, string $context = '', ?string $additionalPrompt = null): array
    {
        if (!$this->apiKey) {
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
You are an expert construction drawing analyst specializing in {$tradeContext}.

I'm showing you two revisions of the same construction drawing:
- IMAGE 1 (first image): The OLDER revision (e.g., Revision B)
- IMAGE 2 (second image): The NEWER revision (e.g., Revision C)

Please analyze these drawings and identify ALL changes between the revisions.

Focus on:
1. Dimensional changes (measurements, distances)
2. Added or removed elements (walls, doors, windows, fixtures, annotations)
3. Material or specification changes (noted in text)
4. Layout modifications
5. Annotation/note changes
6. Any revision clouds or change markers visible on the drawing
{$additionalInstructions}
Provide your response in this JSON format:
{
    "summary": "Brief 1-2 sentence summary of the overall changes",
    "change_count": number,
    "changes": [
        {
            "type": "dimension|addition|removal|modification|annotation|specification",
            "description": "What changed",
            "location": "Where on the drawing (e.g., 'top left', 'near door D1', 'grid line A-3')",
            "impact": "low|medium|high",
            "potential_change_order": true/false,
            "reason": "Why this might require a change order (if applicable)"
        }
    ],
    "confidence": "low|medium|high",
    "notes": "Any additional observations or uncertainties"
}

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

            if (!$response->successful()) {
                Log::error('OpenAI comparison failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                return [
                    'success' => false,
                    'summary' => null,
                    'changes' => [],
                    'error' => 'OpenAI API error: ' . $response->status(),
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

            if (!$parsed) {
                return [
                    'success' => true,
                    'summary' => $content, // Return raw text if JSON parsing fails
                    'changes' => [],
                    'raw_response' => $content,
                    'error' => null,
                ];
            }

            return [
                'success' => true,
                'summary' => $parsed['summary'] ?? null,
                'changes' => $parsed['changes'] ?? [],
                'change_count' => $parsed['change_count'] ?? count($parsed['changes'] ?? []),
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
     * @param string $s3Key S3 key for the image
     * @param int $maxDimension Max width/height in pixels (0 = no resize)
     */
    public function getImageDataUrl(string $s3Key, int $maxDimension = 1536): ?string
    {
        try {
            $contents = Storage::disk('s3')->get($s3Key);
            if (!$contents) {
                return null;
            }

            // Resize image if needed for AI analysis
            if ($maxDimension > 0) {
                $contents = $this->resizeImageForAI($contents, $maxDimension);
                if (!$contents) {
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

            return 'data:' . $mimeType . ';base64,' . $base64Data;
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
            if (!$imageInfo) {
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

            if (!$image) {
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
}
