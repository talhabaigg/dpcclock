<?php

namespace App\Services;

use App\Models\Drawing;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class DrawingMetadataService
{
    private const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

    private const DEFAULT_MODEL = 'gpt-4o'; // Vision-capable model

    /**
     * Extract metadata from a drawing using AI vision
     */
    public function extractMetadata(Drawing $drawing): array
    {
        try {
            // Get the thumbnail or first page image
            $imagePath = $this->getDrawingImage($drawing);

            if (! $imagePath) {
                return [
                    'success' => false,
                    'error' => 'Could not get drawing image for analysis',
                ];
            }

            // Convert to base64
            $imageData = base64_encode(file_get_contents($imagePath));
            $mimeType = $this->getMimeType($imagePath);

            // Call OpenAI Vision API
            $response = $this->callOpenAIVision($imageData, $mimeType);

            if (! $response['success']) {
                return $response;
            }

            // Parse and validate the extracted data
            $metadata = $this->parseAIResponse($response['data']);

            Log::info('DrawingMetadataService: AI extraction complete', [
                'drawing_id' => $drawing->id,
                'metadata' => $metadata,
            ]);

            // Store raw AI response and update drawing with extracted data
            $drawingUpdates = [
                'ai_extracted_metadata' => [
                    'raw_response' => $response['data'],
                    'parsed' => $metadata,
                    'extracted_at' => now()->toIso8601String(),
                    'model' => self::DEFAULT_MODEL,
                ],
            ];

            $confidence = $metadata['confidence'] ?? 0;

            // Update drawing title if AI extracted one and confidence is high enough
            if (! empty($metadata['title']) && $confidence >= 70) {
                $drawingUpdates['title'] = $metadata['title'];
            }

            // Update sheet_number directly on drawing
            if (! empty($metadata['sheet_number'])) {
                $drawingUpdates['sheet_number'] = $metadata['sheet_number'];
            }

            // Update discipline if found
            if (! empty($metadata['discipline'])) {
                $drawingUpdates['discipline'] = $metadata['discipline'];
            }

            // Update revision info
            if (! empty($metadata['revision'])) {
                $drawingUpdates['revision_number'] = $metadata['revision'];
            }
            if (! empty($metadata['revision_date'])) {
                $drawingUpdates['revision_date'] = $metadata['revision_date'];
            }

            $drawing->update($drawingUpdates);

            Log::info('DrawingMetadataService: Updated drawing metadata', [
                'drawing_id' => $drawing->id,
                'sheet_number' => $metadata['sheet_number'] ?? null,
                'title' => $metadata['title'] ?? null,
            ]);

            return [
                'success' => true,
                'metadata' => $metadata,
                'confidence' => $metadata['confidence'] ?? null,
            ];

        } catch (\Exception $e) {
            Log::error('AI metadata extraction failed', [
                'drawing_id' => $drawing->id,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Get image for AI analysis - crops to title block region for better accuracy
     */
    private function getDrawingImage(Drawing $drawing): ?string
    {
        $fullImagePath = null;

        Log::info('DrawingMetadataService: Getting image for drawing', [
            'drawing_id' => $drawing->id,
            'file_path' => $drawing->file_path,
            'thumbnail_path' => $drawing->thumbnail_path,
        ]);

        // Try thumbnail first
        if ($drawing->thumbnail_path && Storage::disk('public')->exists($drawing->thumbnail_path)) {
            $fullImagePath = Storage::disk('public')->path($drawing->thumbnail_path);
            Log::info('DrawingMetadataService: Using existing thumbnail', ['path' => $fullImagePath]);
        } else {
            // Fall back to converting PDF first page
            $filePath = Storage::disk('public')->path($drawing->file_path);
            $processingService = app(DrawingProcessingService::class);

            Log::info('DrawingMetadataService: Generating thumbnail from PDF', ['pdf_path' => $filePath]);

            // Use the processing service to convert
            $result = $processingService->generateThumbnail($drawing, $filePath);

            if ($result['success'] && $drawing->thumbnail_path) {
                $fullImagePath = Storage::disk('public')->path($drawing->thumbnail_path);
                Log::info('DrawingMetadataService: Generated thumbnail', ['path' => $fullImagePath]);
            } else {
                Log::warning('DrawingMetadataService: Failed to generate thumbnail', ['result' => $result]);
            }
        }

        if (! $fullImagePath || ! file_exists($fullImagePath)) {
            Log::error('DrawingMetadataService: No image available for AI analysis');

            return null;
        }

        // Crop to title block region (bottom-right corner) for better AI text recognition
        return $this->cropToTitleBlock($fullImagePath, $drawing->id);
    }

    /**
     * Crop image to title block region (bottom-right corner)
     * Title blocks are typically in the bottom-right 25-30% of the drawing
     */
    private function cropToTitleBlock(string $imagePath, int $drawingId): ?string
    {
        // Include file modification time and crop version in cache key to bust cache when file or crop params change
        $cropVersion = 'v2'; // Increment when crop dimensions change
        $fileHash = md5($imagePath.filemtime($imagePath).$cropVersion);
        $croppedPath = sys_get_temp_dir().'/drawing_titleblock_'.$drawingId.'_'.$fileHash.'.png';

        // If already cropped recently, use cached version
        if (file_exists($croppedPath) && filemtime($croppedPath) > time() - 300) {
            Log::debug('Using cached cropped title block', ['path' => $croppedPath]);

            return $croppedPath;
        }

        $imageInfo = @getimagesize($imagePath);
        if (! $imageInfo) {
            Log::warning('Could not get image size for cropping', ['path' => $imagePath]);

            return $imagePath; // Fall back to full image
        }

        [$width, $height, $type] = $imageInfo;

        // Load source image
        $source = match ($type) {
            IMAGETYPE_PNG => imagecreatefrompng($imagePath),
            IMAGETYPE_JPEG => imagecreatefromjpeg($imagePath),
            IMAGETYPE_GIF => imagecreatefromgif($imagePath),
            default => null,
        };

        if (! $source) {
            Log::warning('Could not load image for cropping', ['path' => $imagePath, 'type' => $type]);

            return $imagePath;
        }

        // Title block is typically in bottom-right corner
        // Crop to bottom 25% height and right 55% width to capture the full title block
        // Increased from 40%x35% to ensure Issue/Rev field is captured
        $cropWidth = (int) ($width * 0.55);
        $cropHeight = (int) ($height * 0.25);
        $cropX = $width - $cropWidth;
        $cropY = $height - $cropHeight;

        // Create cropped image
        $cropped = imagecreatetruecolor($cropWidth, $cropHeight);

        // Preserve transparency for PNG
        if ($type === IMAGETYPE_PNG) {
            imagealphablending($cropped, false);
            imagesavealpha($cropped, true);
        }

        // Copy the title block region
        imagecopy($cropped, $source, 0, 0, $cropX, $cropY, $cropWidth, $cropHeight);

        // Save cropped image
        $result = imagepng($cropped, $croppedPath, 6);

        imagedestroy($source);
        imagedestroy($cropped);

        if ($result) {
            Log::debug('Cropped title block image', [
                'drawing_id' => $drawingId,
                'original_size' => "{$width}x{$height}",
                'cropped_size' => "{$cropWidth}x{$cropHeight}",
                'cropped_path' => $croppedPath,
            ]);

            return $croppedPath;
        }

        return $imagePath; // Fall back to full image
    }

    /**
     * Call OpenAI Vision API to analyze the drawing
     */
    private function callOpenAIVision(string $imageBase64, string $mimeType): array
    {
        $apiKey = $this->getApiKey();

        $prompt = <<<'PROMPT'
This image shows the TITLE BLOCK REGION (bottom-right corner) of a construction/engineering drawing.

Carefully read ALL text visible in this title block and extract:

1. **Drawing Number / Sheet Number**: The unique drawing identifier (may be labeled as "Drawing Number", "Sheet Number", "Dwg No.", etc.). Examples: "A-101", "NTA-DRW-ARC-0135-GRF", "M-201"

2. **Drawing Title / Sheet Title**: READ THE ENTIRE TITLE FIELD CHARACTER BY CHARACTER. Construction drawings commonly have prefixes that indicate the drawing type:
   - "RCP - GROUND FLOOR PLAN" (RCP = Reflected Ceiling Plan)
   - "FFL - FIRST FLOOR LAYOUT" (FFL = Finished Floor Level)
   - "SEC - SECTION A-A" (SEC = Section)
   - "EL - EAST ELEVATION" (EL = Elevation)
   - "DET - DETAIL 01" (DET = Detail)
   You MUST capture the ENTIRE title including these prefixes. If the title block shows "RCP - GROUND FLOOR PLAN", return exactly "RCP - GROUND FLOOR PLAN", NOT "GROUND FLOOR PLAN".

3. **Revision / Issue**: CRITICAL - Look for a box or field labeled "Issue:" or "Issue" - this contains a number like 1, 2, 3, 4, 5, 6, 7, etc. This is usually in a small box near the drawing number. Also check for "Revision", "Rev", "Rev No." fields. Examples: "7", "6", "A", "B"
4. **Revision Date**: The date of the current revision
5. **Discipline**: The engineering discipline (Architectural, Structural, Mechanical, Electrical, Plumbing, Civil, Fire, etc.)
6. **Project Name**: If visible
7. **Scale**: If shown (e.g., "1:100", "1/4" = 1'-0"", "1:200")

Return your response as JSON in this exact format:
{
  "sheet_number": "<exact text from drawing number field>",
  "title": "<EXACT COMPLETE TEXT from title field - include ALL prefixes like RCP, FFL, SEC, EL, DET etc>",
  "revision": "<from Issue or Rev field>",
  "revision_date": "<from date field or null>",
  "discipline": "<from drawing type>",
  "project_name": "<from project field or null>",
  "scale": "<from scale field or null>",
  "confidence": <0-100>,
  "notes": "<your observations>"
}

CRITICAL INSTRUCTIONS:
- READ and TRANSCRIBE the actual text EXACTLY as written. Do NOT paraphrase, summarize, or simplify.
- For TITLE: This is the most important field. Include EVERY character including prefixes (RCP, FFL, SEC, EL, DET, etc.), dashes, and spaces EXACTLY as shown.
- Common mistake: Returning "GROUND FLOOR PLAN" when the actual title is "RCP - GROUND FLOOR PLAN". The prefix "RCP -" is PART of the title and MUST be included.
- For revision/issue: CAREFULLY look for a small box labeled "Issue:" followed by a number. Read this number EXACTLY as shown. Common values are 1, 2, 3, 4, 5, 6, 7, 8, etc. Do NOT confuse this with other numbers on the drawing.
- If text is unclear or unreadable, use null and note it - do NOT make up values
- Drawing numbers are often long codes like "NTA-DRW-ARC-0135-GRF"
- The confidence score (0-100) should reflect how certain you are about the extracted data
PROMPT;

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer '.$apiKey,
                'Content-Type' => 'application/json',
            ])->timeout(60)->post(self::OPENAI_API_URL, [
                'model' => self::DEFAULT_MODEL,
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
                                    'url' => "data:{$mimeType};base64,{$imageBase64}",
                                    'detail' => 'high', // Use high detail for better text recognition
                                ],
                            ],
                        ],
                    ],
                ],
                'max_tokens' => 1000,
                'temperature' => 0.1, // Low temperature for more consistent extraction
            ]);

            if (! $response->successful()) {
                Log::error('OpenAI Vision API error', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return [
                    'success' => false,
                    'error' => 'OpenAI API request failed: '.$response->status(),
                ];
            }

            $data = $response->json();
            $content = $data['choices'][0]['message']['content'] ?? null;

            if (! $content) {
                return [
                    'success' => false,
                    'error' => 'No content in API response',
                ];
            }

            return [
                'success' => true,
                'data' => $content,
                'usage' => $data['usage'] ?? null,
            ];

        } catch (\Exception $e) {
            Log::error('OpenAI Vision API exception', ['error' => $e->getMessage()]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Parse the AI response JSON
     */
    private function parseAIResponse(string $content): array
    {
        // Try to extract JSON from the response
        $jsonMatch = preg_match('/\{[\s\S]*\}/', $content, $matches);

        if (! $jsonMatch) {
            Log::warning('Could not find JSON in AI response', ['content' => $content]);

            return [
                'confidence' => 0,
                'notes' => 'Could not parse AI response',
                'raw' => $content,
            ];
        }

        $json = json_decode($matches[0], true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            Log::warning('Invalid JSON in AI response', [
                'content' => $matches[0],
                'error' => json_last_error_msg(),
            ]);

            return [
                'confidence' => 0,
                'notes' => 'Invalid JSON in AI response',
                'raw' => $content,
            ];
        }

        // Normalize the data
        return [
            'sheet_number' => $this->cleanString($json['sheet_number'] ?? null),
            'title' => $this->cleanString($json['title'] ?? null),
            'revision' => $this->cleanString($json['revision'] ?? null),
            'revision_date' => $this->parseDate($json['revision_date'] ?? null),
            'discipline' => $this->cleanString($json['discipline'] ?? null),
            'project_name' => $this->cleanString($json['project_name'] ?? null),
            'scale' => $this->cleanString($json['scale'] ?? null),
            'confidence' => (int) ($json['confidence'] ?? 0),
            'notes' => $json['notes'] ?? null,
        ];
    }

    /**
     * Confirm AI-extracted metadata (user verification)
     */
    public function confirmMetadata(Drawing $drawing, array $confirmedData): bool
    {
        try {
            $updates = array_filter([
                'sheet_number' => $confirmedData['sheet_number'] ?? null,
                'title' => $confirmedData['title'] ?? null,
                'discipline' => $confirmedData['discipline'] ?? null,
                'revision_number' => $confirmedData['revision'] ?? null,
                'revision_date' => $confirmedData['revision_date'] ?? null,
                'metadata_confirmed' => true,
                'status' => Drawing::STATUS_ACTIVE,
            ]);

            $drawing->update($updates);

            return true;

        } catch (\Exception $e) {
            Log::error('Failed to confirm metadata', [
                'drawing_id' => $drawing->id,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Get OpenAI API key
     */
    private function getApiKey(): string
    {
        $key = config('services.openai.api_key') ?: env('OPENAI_API_KEY') ?: env('VITE_OPEN_AI_API_KEY');

        if (! $key) {
            throw new \RuntimeException('OpenAI API key is not configured');
        }

        return $key;
    }

    /**
     * Get MIME type of file
     */
    private function getMimeType(string $path): string
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
     * Clean and normalize string values
     */
    private function cleanString(?string $value): ?string
    {
        if ($value === null || $value === '' || strtolower($value) === 'null') {
            return null;
        }

        return trim($value);
    }

    /**
     * Parse date string to Y-m-d format
     */
    private function parseDate(?string $value): ?string
    {
        if (empty($value) || strtolower($value) === 'null') {
            return null;
        }

        try {
            $date = new \DateTime($value);

            return $date->format('Y-m-d');
        } catch (\Exception $e) {
            return null;
        }
    }
}
