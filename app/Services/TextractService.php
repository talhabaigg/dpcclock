<?php

namespace App\Services;

use Aws\Textract\TextractClient;
use Aws\Exception\AwsException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

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
     * @param string $s3Key The S3 key of the image to analyze
     * @param string|null $bucket The S3 bucket (defaults to config)
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
                    'Queries' => array_map(fn($q) => [
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
     * @param string $imageBytes Raw image data
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
                    'Queries' => array_map(fn($q) => [
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
     * @param array $response Raw Textract API response
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
            if (!$alias) {
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
     * @param array $queryResults Results keyed by alias
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
     * @param array $results All query results
     * @param array $aliases Aliases to try in preference order
     * @param string $fieldName Field name for logging
     * @return array{text: string, confidence: float, source_alias: string, boundingBox: array|null}
     */
    private function selectBestAnswer(array $results, array $aliases, string $fieldName): array
    {
        $candidates = [];

        foreach ($aliases as $alias) {
            if (!isset($results[$alias])) {
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
}
