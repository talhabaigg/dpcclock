<?php

namespace App\Services;

use Aws\Exception\AwsException;
use Aws\Textract\TextractClient;
use Illuminate\Support\Facades\Log;

/**
 * Service for extracting metadata from drawing images using AWS Textract.
 *
 * Uses Textract's QUERIES feature to ask specific questions about drawing metadata
 * (drawing number, title, revision) and parses the responses with confidence scores.
 */
class TextractService
{
    private TextractClient $client;

    /**
     * Textract queries with aliases for extracting drawing metadata.
     * Multiple queries for each field increase chances of successful extraction.
     */
    private const QUERIES = [
        ['alias' => 'drawing_number', 'text' => 'What is the drawing number in the title block?'],
        ['alias' => 'dwg_no', 'text' => 'What is the DWG NO or drawing number?'],
        ['alias' => 'drawing_title', 'text' => 'What is the drawing title in the title block?'],
        ['alias' => 'title', 'text' => 'What is the title or description of this drawing?'],
        ['alias' => 'revision', 'text' => 'What is the revision letter or number in the title block?'],
        ['alias' => 'issue', 'text' => 'What is the issue or revision?'],
    ];

    public function __construct()
    {
        $this->client = new TextractClient([
            'version' => 'latest',
            'region' => config('services.textract.region', config('filesystems.disks.s3.region', 'ap-southeast-2')),
            'credentials' => [
                'key' => config('services.textract.key', config('filesystems.disks.s3.key')),
                'secret' => config('services.textract.secret', config('filesystems.disks.s3.secret')),
            ],
        ]);
    }

    /**
     * Extract metadata from an image stored in S3.
     *
     * @param  string  $s3Key  The S3 key of the image to analyze
     * @param  string|null  $bucket  The S3 bucket (defaults to config)
     * @return array{success: bool, fields: array, raw: array, error?: string}
     */
    public function extractFromS3(string $s3Key, ?string $bucket = null): array
    {
        $bucket = $bucket ?? config('filesystems.disks.s3.bucket');

        try {
            $result = $this->client->analyzeDocument([
                'Document' => [
                    'S3Object' => [
                        'Bucket' => $bucket,
                        'Name' => $s3Key,
                    ],
                ],
                'FeatureTypes' => ['QUERIES'],
                'QueriesConfig' => [
                    'Queries' => array_map(fn ($q) => [
                        'Text' => $q['text'],
                        'Alias' => $q['alias'],
                    ], self::QUERIES),
                ],
            ]);

            return $this->parseTextractResponse($result->toArray());

        } catch (AwsException $e) {
            Log::error('Textract extraction failed', [
                's3_key' => $s3Key,
                'error' => $e->getMessage(),
                'code' => $e->getAwsErrorCode(),
            ]);

            return [
                'success' => false,
                'fields' => [],
                'raw' => [],
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Extract metadata from image bytes (for local/cropped images).
     *
     * @param  string  $imageBytes  Raw image data
     * @return array{success: bool, fields: array, raw: array, error?: string}
     */
    public function extractFromBytes(string $imageBytes): array
    {
        try {
            $result = $this->client->analyzeDocument([
                'Document' => [
                    'Bytes' => $imageBytes,
                ],
                'FeatureTypes' => ['QUERIES'],
                'QueriesConfig' => [
                    'Queries' => array_map(fn ($q) => [
                        'Text' => $q['text'],
                        'Alias' => $q['alias'],
                    ], self::QUERIES),
                ],
            ]);

            return $this->parseTextractResponse($result->toArray());

        } catch (AwsException $e) {
            Log::error('Textract extraction from bytes failed', [
                'error' => $e->getMessage(),
                'code' => $e->getAwsErrorCode(),
            ]);

            return [
                'success' => false,
                'fields' => [],
                'raw' => [],
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Parse Textract response and extract field values with confidences.
     *
     * @param  array  $response  Raw Textract API response
     * @return array{success: bool, fields: array, raw: array}
     */
    private function parseTextractResponse(array $response): array
    {
        $blocks = $response['Blocks'] ?? [];
        $queryResults = [];

        // Build map of block IDs to blocks
        $blockMap = [];
        foreach ($blocks as $block) {
            $blockMap[$block['Id']] = $block;
        }

        // Find QUERY blocks and their QUERY_RESULT answers
        foreach ($blocks as $block) {
            if ($block['BlockType'] !== 'QUERY') {
                continue;
            }

            $alias = $block['Query']['Alias'] ?? null;
            if (! $alias) {
                continue;
            }

            // Find the QUERY_RESULT relationship
            $relationships = $block['Relationships'] ?? [];
            foreach ($relationships as $rel) {
                if ($rel['Type'] !== 'ANSWER') {
                    continue;
                }

                foreach ($rel['Ids'] as $answerId) {
                    $answerBlock = $blockMap[$answerId] ?? null;
                    if ($answerBlock && $answerBlock['BlockType'] === 'QUERY_RESULT') {
                        $geometry = $answerBlock['Geometry'] ?? null;
                        $boundingBox = null;

                        // Extract bounding box if available (normalized 0-1 coordinates)
                        if ($geometry && isset($geometry['BoundingBox'])) {
                            $bb = $geometry['BoundingBox'];
                            $boundingBox = [
                                'left' => $bb['Left'] ?? 0,
                                'top' => $bb['Top'] ?? 0,
                                'width' => $bb['Width'] ?? 0,
                                'height' => $bb['Height'] ?? 0,
                            ];
                        }

                        $queryResults[$alias] = [
                            'text' => $answerBlock['Text'] ?? '',
                            'confidence' => ($answerBlock['Confidence'] ?? 0) / 100, // Convert to 0-1
                            'boundingBox' => $boundingBox,
                        ];
                    }
                }
            }
        }

        // Map query results to standardized fields
        $fields = $this->mapQueryResultsToFields($queryResults);

        return [
            'success' => true,
            'fields' => $fields,
            'raw' => $queryResults,
        ];
    }

    /**
     * Map multiple query aliases to standardized field names.
     * Prefers primary aliases and falls back to secondary ones.
     *
     * @param  array  $queryResults  Results keyed by alias
     * @return array{drawing_number: array, drawing_title: array, revision: array}
     */
    private function mapQueryResultsToFields(array $queryResults): array
    {
        return [
            'drawing_number' => $this->selectBestAnswer(
                $queryResults,
                ['drawing_number', 'dwg_no'],
                'drawing_number'
            ),
            'drawing_title' => $this->selectBestAnswer(
                $queryResults,
                ['drawing_title', 'title'],
                'drawing_title'
            ),
            'revision' => $this->selectBestAnswer(
                $queryResults,
                ['revision', 'issue'],
                'revision'
            ),
        ];
    }

    /**
     * Select the best answer from multiple aliases.
     * Prefers results with higher confidence scores.
     *
     * @param  array  $results  All query results
     * @param  array  $aliases  Aliases to try in preference order
     * @param  string  $fieldName  Field name for logging
     * @return array{text: string, confidence: float, source_alias: string, boundingBox: array|null}
     */
    private function selectBestAnswer(array $results, array $aliases, string $fieldName): array
    {
        $candidates = [];

        foreach ($aliases as $alias) {
            if (! isset($results[$alias])) {
                continue;
            }

            $result = $results[$alias];
            $text = trim($result['text'] ?? '');

            // Skip empty results
            if ($text === '') {
                continue;
            }

            $candidates[] = [
                'text' => $text,
                'confidence' => $result['confidence'] ?? 0.0,
                'alias' => $alias,
                'boundingBox' => $result['boundingBox'] ?? null,
            ];
        }

        if (empty($candidates)) {
            return [
                'text' => '',
                'confidence' => 0.0,
                'source_alias' => $aliases[0],
                'boundingBox' => null,
            ];
        }

        // Sort by confidence descending, then prefer primary alias
        usort($candidates, function ($a, $b) use ($aliases) {
            // If confidence difference is significant (>10%), prefer higher confidence
            if (abs($a['confidence'] - $b['confidence']) > 0.1) {
                return $b['confidence'] <=> $a['confidence'];
            }

            // Otherwise prefer primary alias order
            return array_search($a['alias'], $aliases) <=> array_search($b['alias'], $aliases);
        });

        $best = $candidates[0];

        return [
            'text' => $best['text'],
            'confidence' => $best['confidence'],
            'source_alias' => $best['alias'],
            'boundingBox' => $best['boundingBox'],
        ];
    }

    /**
     * Get the configured Textract queries.
     */
    public static function getQueries(): array
    {
        return self::QUERIES;
    }

    /**
     * Detect all text blocks in an image (for field mapping UI).
     *
     * Uses Textract's detectDocumentText to find all LINE blocks with their
     * bounding boxes. This allows users to select which text corresponds to
     * which field when the query-based extraction has low confidence.
     *
     * @param  string  $imageBytes  Raw image data
     * @return array{success: bool, text_blocks: array, error?: string}
     */
    public function detectAllText(string $imageBytes): array
    {
        try {
            Log::info('Textract detectAllText called', [
                'image_size' => strlen($imageBytes),
            ]);

            $result = $this->client->detectDocumentText([
                'Document' => [
                    'Bytes' => $imageBytes,
                ],
            ]);

            $blocks = $result->get('Blocks') ?? [];
            $textBlocks = [];

            Log::info('Textract detectDocumentText response', [
                'total_blocks' => count($blocks),
                'block_types' => array_count_values(array_column($blocks, 'BlockType')),
            ]);

            foreach ($blocks as $block) {
                // We want LINE blocks (full lines of text)
                if ($block['BlockType'] !== 'LINE') {
                    continue;
                }

                $text = trim($block['Text'] ?? '');
                if ($text === '') {
                    continue;
                }

                $geometry = $block['Geometry'] ?? null;
                $boundingBox = null;

                if ($geometry && isset($geometry['BoundingBox'])) {
                    $bb = $geometry['BoundingBox'];
                    $boundingBox = [
                        'x' => $bb['Left'] ?? 0,
                        'y' => $bb['Top'] ?? 0,
                        'w' => $bb['Width'] ?? 0,
                        'h' => $bb['Height'] ?? 0,
                    ];
                }

                $textBlocks[] = [
                    'id' => $block['Id'],
                    'text' => $text,
                    'confidence' => ($block['Confidence'] ?? 0) / 100,
                    'boundingBox' => $boundingBox,
                ];
            }

            // Sort by position (top to bottom, left to right)
            usort($textBlocks, function ($a, $b) {
                $aY = $a['boundingBox']['y'] ?? 0;
                $bY = $b['boundingBox']['y'] ?? 0;
                $yDiff = abs($aY - $bY);

                // If on roughly the same line (within 2% vertical), sort by X
                if ($yDiff < 0.02) {
                    $aX = $a['boundingBox']['x'] ?? 0;
                    $bX = $b['boundingBox']['x'] ?? 0;

                    return $aX <=> $bX;
                }

                return $aY <=> $bY;
            });

            return [
                'success' => true,
                'text_blocks' => $textBlocks,
            ];

        } catch (AwsException $e) {
            Log::error('Textract detectDocumentText failed', [
                'error' => $e->getMessage(),
                'code' => $e->getAwsErrorCode(),
            ]);

            return [
                'success' => false,
                'text_blocks' => [],
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Extract ALL text from a user-drawn field region.
     *
     * Unlike extractFromRegion which tries to pick the best text block,
     * this method joins all text found in the region. This is appropriate
     * when the user has drawn the exact area they want - we trust their selection.
     *
     * @param  string  $imageBytes  Cropped image data (already cropped to field region)
     * @return array{success: bool, text: string, confidence: float, error?: string}
     */
    public function extractAllTextFromRegion(string $imageBytes): array
    {
        try {
            $result = $this->client->detectDocumentText([
                'Document' => [
                    'Bytes' => $imageBytes,
                ],
            ]);

            $blocks = $result->get('Blocks') ?? [];
            $textParts = [];
            $totalConfidence = 0;
            $count = 0;

            // Collect both LINE and WORD blocks
            $lineBlocks = [];
            $wordBlocks = [];

            foreach ($blocks as $block) {
                $text = trim($block['Text'] ?? '');
                if ($text === '') {
                    continue;
                }

                $bb = $block['Geometry']['BoundingBox'] ?? null;
                $blockData = [
                    'text' => $text,
                    'confidence' => ($block['Confidence'] ?? 0) / 100,
                    'y' => $bb['Top'] ?? 0,
                    'x' => $bb['Left'] ?? 0,
                ];

                if ($block['BlockType'] === 'LINE') {
                    $lineBlocks[] = $blockData;
                } elseif ($block['BlockType'] === 'WORD') {
                    $wordBlocks[] = $blockData;
                }
            }

            // Sort LINE blocks by position (top to bottom, left to right)
            usort($lineBlocks, function ($a, $b) {
                $yDiff = abs($a['y'] - $b['y']);
                if ($yDiff < 0.05) { // Same line (within 5% vertical)
                    return $a['x'] <=> $b['x'];
                }

                return $a['y'] <=> $b['y'];
            });

            foreach ($lineBlocks as $block) {
                $textParts[] = $block['text'];
                $totalConfidence += $block['confidence'];
                $count++;
            }

            $combinedText = implode(' ', $textParts);
            $avgConfidence = $count > 0 ? $totalConfidence / $count : 0;

            // Fallback: if LINE result looks like just a label (Issue:, Rev:, etc.)
            // look for single-character WORD blocks that might be the revision letter
            $looksLikeJustLabel = preg_match('/^(ISSUE|REV|REVISION|R)\s*[:.]?\s*$/i', $combinedText);
            if ($looksLikeJustLabel && ! empty($wordBlocks)) {
                // Find single-character words that look like revision letters
                $revisionLetters = [];
                foreach ($wordBlocks as $word) {
                    // Single uppercase letter or digit
                    if (preg_match('/^[A-Z0-9]$/i', $word['text'])) {
                        $revisionLetters[] = $word;
                    }
                }

                if (! empty($revisionLetters)) {
                    // Pick the one with highest confidence or rightmost position
                    usort($revisionLetters, fn ($a, $b) => $b['x'] <=> $a['x']);
                    $revLetter = $revisionLetters[0];

                    Log::info('extractAllTextFromRegion: Found revision letter in WORD blocks', [
                        'label_text' => $combinedText,
                        'found_letter' => $revLetter['text'],
                        'all_words' => array_map(fn ($w) => $w['text'], $wordBlocks),
                    ]);

                    $combinedText = $combinedText.' '.$revLetter['text'];
                    $totalConfidence += $revLetter['confidence'];
                    $count++;
                    $avgConfidence = $totalConfidence / $count;
                }
            }

            Log::info('extractAllTextFromRegion result', [
                'line_count' => count($lineBlocks),
                'word_count' => count($wordBlocks),
                'text' => $combinedText,
                'confidence' => $avgConfidence,
            ]);

            return [
                'success' => true,
                'text' => $combinedText,
                'confidence' => $avgConfidence,
            ];

        } catch (AwsException $e) {
            Log::error('extractAllTextFromRegion failed', [
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'text' => '',
                'confidence' => 0,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Extract text from a specific region of an image.
     *
     * Used when field mappings are defined - the image bytes are already cropped
     * to the padded field region. We detect text and return the most centrally
     * located text block (since padding expands equally on all sides, the original
     * mapped text should be near the center).
     *
     * @param  string  $imageBytes  Cropped image data (already cropped to field region)
     * @param  array  $region  Normalized region info (for logging)
     * @return array{success: bool, text: string, confidence: float, error?: string}
     *
     * @deprecated Use extractAllTextFromRegion instead for user-drawn regions
     */
    public function extractFromRegion(string $imageBytes, array $region): array
    {
        try {
            $result = $this->client->detectDocumentText([
                'Document' => [
                    'Bytes' => $imageBytes,
                ],
            ]);

            $blocks = $result->get('Blocks') ?? [];
            $textBlocks = [];

            foreach ($blocks as $block) {
                if ($block['BlockType'] !== 'LINE') {
                    continue;
                }

                $text = trim($block['Text'] ?? '');
                if ($text === '') {
                    continue;
                }

                $bb = $block['Geometry']['BoundingBox'] ?? null;
                $centerX = 0.5;
                $centerY = 0.5;

                if ($bb) {
                    $centerX = ($bb['Left'] ?? 0) + (($bb['Width'] ?? 0) / 2);
                    $centerY = ($bb['Top'] ?? 0) + (($bb['Height'] ?? 0) / 2);
                }

                // Calculate distance from center of image (0.5, 0.5)
                // The original mapped text should be closest to center after padding
                $distFromCenter = sqrt(pow($centerX - 0.5, 2) + pow($centerY - 0.5, 2));

                $textBlocks[] = [
                    'text' => $text,
                    'confidence' => ($block['Confidence'] ?? 0) / 100,
                    'distFromCenter' => $distFromCenter,
                    'centerX' => $centerX,
                    'centerY' => $centerY,
                ];
            }

            if (empty($textBlocks)) {
                return [
                    'success' => true,
                    'text' => '',
                    'confidence' => 0,
                ];
            }

            // If only one text block, use it
            if (count($textBlocks) === 1) {
                return [
                    'success' => true,
                    'text' => $textBlocks[0]['text'],
                    'confidence' => $textBlocks[0]['confidence'],
                ];
            }

            // Multiple text blocks - pick the one closest to center
            usort($textBlocks, fn ($a, $b) => $a['distFromCenter'] <=> $b['distFromCenter']);

            $selected = $textBlocks[0];

            Log::info('extractFromRegion: Multiple text blocks found, selected most central', [
                'total_blocks' => count($textBlocks),
                'selected_text' => $selected['text'],
                'selected_dist' => $selected['distFromCenter'],
                'all_texts' => array_map(fn ($b) => [
                    'text' => $b['text'],
                    'dist' => round($b['distFromCenter'], 3),
                ], $textBlocks),
            ]);

            return [
                'success' => true,
                'text' => $selected['text'],
                'confidence' => $selected['confidence'],
            ];

        } catch (AwsException $e) {
            return [
                'success' => false,
                'text' => '',
                'confidence' => 0,
                'error' => $e->getMessage(),
            ];
        }
    }
}
