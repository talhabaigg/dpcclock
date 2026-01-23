<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

/**
 * Service for validating and normalizing extracted drawing metadata.
 *
 * Provides deterministic validation rules (no LLM) for:
 * - Drawing numbers (various formats)
 * - Revisions (letter, numeric, or prefixed)
 * - Titles (minimum length, not garbage)
 */
class DrawingMetadataValidationService
{
    /**
     * Confidence thresholds for extraction validation.
     * These are configurable via config/services.php or environment variables.
     */
    private float $confidenceNumber;
    private float $confidenceTitle;
    private float $confidenceRevision;

    public function __construct()
    {
        // Lower thresholds to allow valid extractions with moderate confidence
        // Template-based extraction often has lower Textract confidence but better accuracy
        // Note: Textract can return low confidence even for correct values, especially for
        // drawing numbers with special formatting (dashes, mixed alphanumeric)
        $this->confidenceNumber = (float) config('services.textract.confidence_number', 0.20);
        $this->confidenceTitle = (float) config('services.textract.confidence_title', 0.40);
        $this->confidenceRevision = (float) config('services.textract.confidence_revision', 0.50);
    }

    /**
     * Validate all extracted fields and determine if extraction passes.
     *
     * @param array $fields Extracted fields with text and confidence
     * @param bool $skipStrictChecks When true, use relaxed validation for user-mapped fields
     * @return array{
     *     passes: bool,
     *     drawing_number: array{value: string|null, valid: bool, confidence: float, errors: array},
     *     drawing_title: array{value: string|null, valid: bool, confidence: float, errors: array},
     *     revision: array{value: string|null, valid: bool, confidence: float, errors: array},
     *     overall_errors: array
     * }
     */
    public function validate(array $fields, bool $skipStrictChecks = false): array
    {
        // When skipStrictChecks is true, we use relaxed validation because:
        // - The user has explicitly mapped these fields via the UI
        // - We trust the user's selections over pattern matching
        // - We just need to verify we got some readable text
        if ($skipStrictChecks) {
            return $this->validateRelaxed($fields);
        }

        $numberResult = $this->validateDrawingNumber($fields['drawing_number'] ?? []);
        $titleResult = $this->validateTitle($fields['drawing_title'] ?? []);
        $revisionResult = $this->validateRevision($fields['revision'] ?? []);

        // Determine overall pass/fail
        // Must have valid drawing_number AND (valid title OR valid revision)
        $passes = $numberResult['valid'] &&
                  $numberResult['confidence'] >= $this->confidenceNumber &&
                  ($titleResult['valid'] || $revisionResult['valid']);

        // Allow pass with slightly lower confidence if validation is strong
        if (!$passes && $numberResult['valid'] && $numberResult['confidence'] >= ($this->confidenceNumber - 0.10)) {
            if (($titleResult['valid'] && $titleResult['confidence'] >= $this->confidenceTitle) ||
                ($revisionResult['valid'] && $revisionResult['confidence'] >= $this->confidenceRevision)) {
                $passes = true;
            }
        }

        $overallErrors = [];
        if (!$numberResult['valid']) {
            $overallErrors[] = 'Invalid or missing drawing number';
        }
        if (!$titleResult['valid'] && !$revisionResult['valid']) {
            $overallErrors[] = 'Both title and revision are invalid or missing';
        }

        return [
            'passes' => $passes,
            'drawing_number' => $numberResult,
            'drawing_title' => $titleResult,
            'revision' => $revisionResult,
            'overall_errors' => $overallErrors,
        ];
    }

    /**
     * Relaxed validation for user-mapped fields.
     *
     * When a user has explicitly mapped fields via the UI, we trust their selections
     * and just verify we got some readable text. We skip pattern matching and confidence
     * thresholds since the user has confirmed the locations are correct.
     *
     * @param array $fields Extracted fields with text and confidence
     * @return array Validation result
     */
    private function validateRelaxed(array $fields): array
    {
        $results = [];
        $overallErrors = [];

        foreach (['drawing_number', 'drawing_title', 'revision'] as $fieldName) {
            $field = $fields[$fieldName] ?? [];
            $text = trim($field['text'] ?? '');
            $confidence = (float) ($field['confidence'] ?? 0);

            if ($text === '') {
                $results[$fieldName] = [
                    'value' => null,
                    'valid' => false,
                    'confidence' => $confidence,
                    'errors' => [ucfirst(str_replace('_', ' ', $fieldName)) . ' is empty'],
                ];
            } else {
                // Normalize whitespace
                $normalized = preg_replace('/\s+/', ' ', $text);
                $normalized = trim($normalized);

                // Strip common label prefixes that may have been captured with padding
                if ($fieldName === 'drawing_title') {
                    // Remove common title labels: "Drawing", "Title:", "Drawing Title:", etc.
                    $normalized = preg_replace('/^(DRAWING\s*TITLE|DRAWING|TITLE|DWG\s*TITLE|DWG)\s*[:.]?\s*/i', '', $normalized);
                    $normalized = trim($normalized);
                }

                if ($fieldName === 'drawing_number') {
                    // Remove common number labels: "Drawing No.", "DWG #", "Sheet No.", etc.
                    $normalized = preg_replace('/^(DRAWING\s*NO|DRAWING\s*NUMBER|DWG\s*NO|DWG\s*#|SHEET\s*NO|SHEET\s*#|NO|#)\s*[:.]?\s*/i', '', $normalized);
                    $normalized = trim($normalized);
                }

                // For revision, strip common prefixes and trailing issue/sheet numbers
                if ($fieldName === 'revision') {
                    // Remove common prefixes: "REV:", "REVISION:", "ISSUE:", etc.
                    $normalized = preg_replace('/^(ISSUE|REV|REVISION|R)\s*[:.]?\s*/i', '', $normalized);
                    $normalized = strtoupper(trim($normalized));

                    // If result is like "F 001" or "A 123", extract just the revision part
                    // Common formats: "F 001" (revision F, issue 001), "A - 02" (revision A, sheet 02)
                    if (preg_match('/^([A-Z]{1,2})\s+[\d\-]+/', $normalized, $matches)) {
                        $normalized = $matches[1];
                    }
                }

                $results[$fieldName] = [
                    'value' => $normalized,
                    'valid' => true, // Trust user's mapping
                    'confidence' => $confidence,
                    'errors' => [],
                ];
            }
        }

        // Pass if we have at least a drawing number
        $passes = $results['drawing_number']['valid'] ?? false;

        if (!$passes) {
            $overallErrors[] = 'Missing drawing number';
        }

        Log::info('Relaxed validation result (user-mapped fields)', [
            'drawing_number' => $results['drawing_number']['value'] ?? null,
            'drawing_title' => $results['drawing_title']['value'] ?? null,
            'revision' => $results['revision']['value'] ?? null,
            'passes' => $passes,
        ]);

        return [
            'passes' => $passes,
            'drawing_number' => $results['drawing_number'],
            'drawing_title' => $results['drawing_title'],
            'revision' => $results['revision'],
            'overall_errors' => $overallErrors,
        ];
    }

    /**
     * Validate and normalize a drawing number.
     *
     * Accepts patterns like:
     * - A-101, M-201, E-301 (discipline-number)
     * - DWG-001, DRW-123 (prefixed)
     * - 12345, 12345-A (numeric with optional suffix)
     * - SK01, SK-01 (sketch numbers)
     * - ABC 1234, ABC1234-01 (alphanumeric)
     *
     * @param array $field {text: string, confidence: float}
     * @return array{value: string|null, valid: bool, confidence: float, errors: array}
     */
    public function validateDrawingNumber(array $field): array
    {
        $text = trim($field['text'] ?? '');
        $confidence = (float) ($field['confidence'] ?? 0);
        $errors = [];

        if ($text === '') {
            return [
                'value' => null,
                'valid' => false,
                'confidence' => $confidence,
                'errors' => ['Drawing number is empty'],
            ];
        }

        // Normalize: remove extra whitespace
        $normalized = preg_replace('/\s+/', ' ', $text);
        $normalized = trim($normalized);

        // Reject obviously invalid values
        if (strlen($normalized) < 2) {
            $errors[] = 'Drawing number too short (< 2 chars)';
        }

        if (strtoupper($normalized) === 'N/A' || strtoupper($normalized) === 'NA') {
            $errors[] = 'Drawing number is N/A';
        }

        // Reject common sheet sizes (A0, A1, A2, A3, A4, B0, B1, etc.)
        $sheetSizes = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'B0', 'B1', 'B2', 'B3', 'B4', 'B5',
                       'ANSI A', 'ANSI B', 'ANSI C', 'ANSI D', 'ANSI E', 'ARCH A', 'ARCH B',
                       'ARCH C', 'ARCH D', 'ARCH E', 'ARCH E1'];
        if (in_array(strtoupper($normalized), $sheetSizes)) {
            $errors[] = 'Value appears to be a sheet size, not a drawing number';
        }

        // Check against valid patterns
        $validPatterns = [
            // Discipline-number: A-101, M-201.1, E-301-A
            '/^[A-Z]{0,4}-?\d{1,4}[A-Z0-9\-\.]*$/i',
            // Alphanumeric with optional separator: ABC 1234, ABC1234-01
            '/^[A-Z]{1,6}\s?\d{1,6}(\-\d{1,6})?$/i',
            // DWG/DRW prefix: DWG-001, DRW123
            '/^(DWG|DRW|SK|SH|SHEET)\s?[-]?\s?\d{1,6}[A-Z]?$/i',
            // Pure numeric with optional suffix: 12345, 12345-A
            '/^\d{2,6}(\-?[A-Z0-9]{1,4})?$/i',
            // Sheet format: SHEET 01, SH-01
            '/^(SHEET|SH)\s?[-]?\s?\d{1,4}$/i',
            // Complex architectural format: NTA-DRW-ARC-1730-3001, ABC-DRW-001-A
            '/^[A-Z]{2,6}[\-][A-Z]{2,4}[\-][A-Z0-9\-]{3,20}$/i',
            // General alphanumeric with dashes: XXX-YYY-ZZZ, 123-456-789
            '/^[A-Z0-9]{2,6}[\-][A-Z0-9]{2,6}([\-][A-Z0-9]{2,10}){0,4}$/i',
        ];

        $matchesPattern = false;
        foreach ($validPatterns as $pattern) {
            if (preg_match($pattern, $normalized)) {
                $matchesPattern = true;
                break;
            }
        }

        if (!$matchesPattern && empty($errors)) {
            // Log for pattern improvement but don't reject outright
            Log::info('Drawing number format not recognized', ['value' => $normalized]);
            // Still accept if confidence is good - patterns may need expansion
        }

        $valid = empty($errors) && $confidence >= $this->confidenceNumber;

        return [
            'value' => empty($errors) ? $normalized : null,
            'valid' => $valid,
            'confidence' => $confidence,
            'errors' => $errors,
        ];
    }

    /**
     * Validate and normalize a drawing title.
     *
     * Requirements:
     * - Minimum 3 characters
     * - Not purely numeric
     * - Not same as drawing number (would indicate extraction error)
     *
     * @param array $field {text: string, confidence: float}
     * @param string|null $drawingNumber For duplicate detection
     * @return array{value: string|null, valid: bool, confidence: float, errors: array}
     */
    public function validateTitle(array $field, ?string $drawingNumber = null): array
    {
        $text = trim($field['text'] ?? '');
        $confidence = (float) ($field['confidence'] ?? 0);
        $errors = [];

        if ($text === '') {
            return [
                'value' => null,
                'valid' => false,
                'confidence' => $confidence,
                'errors' => ['Title is empty'],
            ];
        }

        // Normalize: collapse whitespace, trim
        $normalized = preg_replace('/\s+/', ' ', $text);
        $normalized = trim($normalized);

        // Check minimum length
        if (strlen($normalized) < 3) {
            $errors[] = 'Title too short (< 3 chars)';
        }

        // Reject purely numeric titles
        if (preg_match('/^\d+$/', $normalized)) {
            $errors[] = 'Title is purely numeric';
        }

        // Reject if same as drawing number (likely extraction error)
        if ($drawingNumber !== null &&
            strtoupper($normalized) === strtoupper($drawingNumber)) {
            $errors[] = 'Title matches drawing number';
        }

        // Reject common garbage values
        $garbage = ['N/A', 'NA', 'NONE', 'TBD', 'TBC', '-', '--', '...'];
        if (in_array(strtoupper($normalized), $garbage)) {
            $errors[] = 'Title is a placeholder value';
        }

        $valid = empty($errors) && $confidence >= $this->confidenceTitle;

        return [
            'value' => empty($errors) ? $normalized : null,
            'valid' => $valid,
            'confidence' => $confidence,
            'errors' => $errors,
        ];
    }

    /**
     * Validate and normalize a revision.
     *
     * Accepts formats:
     * - Single letter: A, B, C
     * - Numeric: 1, 2, 01, 02
     * - Prefixed: P1, P2 (preliminary), C (for construction)
     * - With prefix to strip: REV A, REVISION 2, REV: B
     *
     * @param array $field {text: string, confidence: float}
     * @return array{value: string|null, valid: bool, confidence: float, errors: array}
     */
    public function validateRevision(array $field): array
    {
        $text = trim($field['text'] ?? '');
        $confidence = (float) ($field['confidence'] ?? 0);
        $errors = [];

        if ($text === '') {
            return [
                'value' => null,
                'valid' => false,
                'confidence' => $confidence,
                'errors' => ['Revision is empty'],
            ];
        }

        // Normalize: remove common prefixes
        $normalized = $text;
        $normalized = preg_replace('/^(REV|REVISION|R)\s*[:.]?\s*/i', '', $normalized);
        $normalized = trim($normalized);

        // Uppercase for consistency
        $normalized = strtoupper($normalized);

        // Reject common garbage/placeholder values
        $garbage = ['-', '--', '---', 'N/A', 'NA', 'NONE', 'TBD', 'TBC', '...', '.', '–', '—'];
        if (in_array($normalized, $garbage) || in_array(strtoupper($normalized), $garbage)) {
            $errors[] = 'Revision is a placeholder value';
        }

        // Valid revision patterns
        $validPatterns = [
            // Single or double letter: A, B, AA, AB
            '/^[A-Z]{1,2}$/',
            // Numeric: 1, 01, 001
            '/^\d{1,3}$/',
            // Letter + number: A1, B2, P01
            '/^[A-Z]\d{0,2}$/',
            // Preliminary: P1, P01
            '/^P\d{1,2}$/',
            // Construction: C, C1
            '/^C\d?$/',
            // For construction: FC, FC1
            '/^FC\d?$/',
        ];

        $matchesPattern = false;
        foreach ($validPatterns as $pattern) {
            if (preg_match($pattern, $normalized)) {
                $matchesPattern = true;
                break;
            }
        }

        if (!$matchesPattern) {
            $errors[] = 'Revision format not recognized';
        }

        $valid = empty($errors) && $confidence >= $this->confidenceRevision;

        return [
            'value' => empty($errors) ? $normalized : null,
            'valid' => $valid,
            'confidence' => $confidence,
            'errors' => $errors,
        ];
    }

    /**
     * Calculate a weighted overall confidence score.
     *
     * @param array $validationResult Result from validate()
     * @return float Weighted confidence 0-1
     */
    public function calculateOverallConfidence(array $validationResult): float
    {
        // Weights for each field
        $weights = [
            'drawing_number' => 0.50,
            'drawing_title' => 0.30,
            'revision' => 0.20,
        ];

        $totalWeight = 0;
        $weightedSum = 0;

        foreach ($weights as $field => $weight) {
            if (isset($validationResult[$field]) && $validationResult[$field]['valid']) {
                $weightedSum += $validationResult[$field]['confidence'] * $weight;
                $totalWeight += $weight;
            }
        }

        return $totalWeight > 0 ? $weightedSum / $totalWeight : 0;
    }

    /**
     * Get current confidence thresholds (for UI display).
     */
    public function getThresholds(): array
    {
        return [
            'drawing_number' => $this->confidenceNumber,
            'drawing_title' => $this->confidenceTitle,
            'revision' => $this->confidenceRevision,
        ];
    }
}
