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
        $this->confidenceNumber = (float) config('services.textract.confidence_number', 0.50);
        $this->confidenceTitle = (float) config('services.textract.confidence_title', 0.40);
        $this->confidenceRevision = (float) config('services.textract.confidence_revision', 0.50);
    }

    /**
     * Validate all extracted fields and determine if extraction passes.
     *
     * @param array $fields Extracted fields with text and confidence
     * @return array{
     *     passes: bool,
     *     drawing_number: array{value: string|null, valid: bool, confidence: float, errors: array},
     *     drawing_title: array{value: string|null, valid: bool, confidence: float, errors: array},
     *     revision: array{value: string|null, valid: bool, confidence: float, errors: array},
     *     overall_errors: array
     * }
     */
    public function validate(array $fields): array
    {
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
