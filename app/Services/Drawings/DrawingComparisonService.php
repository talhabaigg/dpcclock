<?php

namespace App\Services\Drawings;

use App\Ai\Agents\DrawingChangeAgent;
use App\Models\Drawing;
use App\Models\DrawingChangeItem;
use App\Models\DrawingComparison;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Laravel\Ai\Enums\Lab;

/**
 * Orchestrates Phase 1 revision change detection: text-layer diff plus an LLM
 * pass that interprets and ranks the differences.
 *
 * A comparison is keyed on the revision pair, which never changes once both
 * drawings exist — so a completed run is cached permanently and the AI cost is
 * paid once per pair, ever.
 */
class DrawingComparisonService
{
    public function __construct(
        private readonly PdfTextExtractor $extractor,
        private readonly DrawingTextDiffService $differ,
        private readonly DrawingRasterDiffService $rasterDiffer,
        private readonly DrawingRasterizer $rasterizer,
    ) {}

    /**
     * Find the cached comparison for a revision pair, or create a pending one.
     *
     * Never re-runs a completed pair. A previously failed pair is reset to
     * pending so a retry is possible without a new row.
     */
    public function findOrCreate(Drawing $old, Drawing $new, ?int $userId = null): DrawingComparison
    {
        $comparison = DrawingComparison::firstOrCreate(
            ['old_drawing_id' => $old->id, 'new_drawing_id' => $new->id],
            ['status' => DrawingComparison::STATUS_PENDING, 'created_by' => $userId],
        );

        if ($comparison->status === DrawingComparison::STATUS_FAILED) {
            $comparison->update([
                'status' => DrawingComparison::STATUS_PENDING,
                'error' => null,
            ]);
        }

        return $comparison;
    }

    /**
     * Run the analysis. Safe to call on an already-complete comparison — it
     * returns immediately rather than re-billing the model.
     */
    public function analyze(DrawingComparison $comparison): DrawingComparison
    {
        if ($comparison->status === DrawingComparison::STATUS_COMPLETE) {
            return $comparison;
        }

        $comparison->update(['status' => DrawingComparison::STATUS_RUNNING, 'error' => null]);

        $oldSource = null;
        $newSource = null;

        try {
            $comparison->loadMissing(['oldDrawing', 'newDrawing']);

            // Open both sources once. Text extraction, the page-box probe and
            // rasterizing all need the same local file; downloading it per step
            // would triple the S3 traffic on every comparison.
            $oldSource = DrawingSourceFile::open($comparison->oldDrawing);
            $newSource = DrawingSourceFile::open($comparison->newDrawing);

            if ($oldSource === null || $newSource === null) {
                return tap($comparison)->update([
                    'status' => DrawingComparison::STATUS_COMPLETE,
                    'methods' => [],
                    'summary' => 'The source file for one or both revisions could not be read, so they cannot be compared.',
                    'revision_notes' => [],
                    'changes_total' => 0,
                    'changes_high' => 0,
                    'analyzed_at' => now(),
                ]);
            }

            $oldText = $this->extractor->extractFromPath($oldSource->path);
            $newText = $this->extractor->extractFromPath($newSource->path);
            $pageBox = $this->rasterizer->probePageBox($newSource->path);

            $changes = $oldText !== null && $newText !== null
                ? $this->differ->diff($oldText, $newText)
                : [];

            $titleBlock = $newText !== null ? $this->titleBlockText($newText) : '';

            // Text coordinates are only usable when they line up with the real
            // page; raster regions always are.
            $textLocatable = $newText !== null && $pageBox !== null
                && $this->textCoordinatesUsable($newText, $pageBox[0], $pageBox[1]);

            $regions = $this->rasterRegions($oldSource, $newSource, $pageBox);

            if ($changes === [] && $regions === [] && $titleBlock === '') {
                return tap($comparison)->update([
                    'status' => DrawingComparison::STATUS_COMPLETE,
                    'methods' => [],
                    'summary' => $oldText === null || $newText === null
                        ? 'No text layer was found on one or both revisions and no geometry differences were detected. This usually means the drawing is a scan rather than a CAD-generated PDF.'
                        : 'No differences were detected between these two revisions.',
                    'revision_notes' => [],
                    'changes_total' => 0,
                    'changes_high' => 0,
                    'analyzed_at' => now(),
                ]);
            }

            $interpretation = $this->interpret($changes, $titleBlock, count($regions));

            $this->persist($comparison, $changes, $regions, $interpretation, $textLocatable);

            return $comparison->fresh(['items']);
        } catch (\Throwable $e) {
            Log::error('Drawing comparison failed', [
                'comparison_id' => $comparison->id,
                'error' => $e->getMessage(),
            ]);

            $comparison->update([
                'status' => DrawingComparison::STATUS_FAILED,
                'error' => $e->getMessage(),
            ]);

            return $comparison;
        } finally {
            $oldSource?->close();
            $newSource?->close();
        }
    }

    /**
     * Geometry change regions, or an empty list when the raster pass is
     * unavailable or turned off. Never fatal — the text diff stands alone.
     *
     * @return list<array{x: float, y: float, w: float, h: float, cells: int}>
     */
    private function rasterRegions(DrawingSourceFile $old, DrawingSourceFile $new, ?array $pageBox): array
    {
        if ($pageBox === null || ! config('drawings.comparison.raster_enabled', true)) {
            return [];
        }

        if (! $this->rasterDiffer->isAvailable()) {
            return [];
        }

        try {
            $result = $this->rasterDiffer->diff($old->path, $new->path, $pageBox[0], $pageBox[1]);
        } catch (\Throwable $e) {
            Log::warning('Raster comparison failed; keeping text results', ['error' => $e->getMessage()]);

            return [];
        }

        return $result['regions'] ?? [];
    }

    /**
     * Ask the model to interpret the diff and read the revision table.
     *
     * @param  list<array<string, mixed>>  $changes
     * @return array{structured: array<string, mixed>, model: string, input_tokens: int, output_tokens: int}|null
     */
    private function interpret(array $changes, string $titleBlock, int $regionCount = 0): ?array
    {
        if (! config('drawings.comparison.enabled', true)) {
            return null;
        }

        $model = (string) config('drawings.comparison.model');
        $provider = str_starts_with($model, 'claude') ? Lab::Anthropic : Lab::OpenAI;
        $limit = (int) config('drawings.comparison.max_changes_for_ai', 120);

        $sent = array_slice($changes, 0, $limit);

        $lines = [];
        foreach ($sent as $index => $change) {
            $lines[] = sprintf(
                '%d. [%s] old=%s new=%s at (%.0f, %.0f)',
                $index,
                $change['change_type'],
                $this->quote($change['text_old']),
                $this->quote($change['text_new']),
                $change['x'],
                $change['y'],
            );
        }

        $truncated = count($changes) > count($sent)
            ? sprintf("\n(%d further changes were found but are not listed here.)", count($changes) - count($sent))
            : '';

        // The geometry count is context for the summary only. The model has not
        // seen these regions, so it is told to count them, not describe them —
        // describing unseen geometry is exactly the hallucination this design
        // avoids.
        $geometry = $regionCount > 0
            ? "\n\nGEOMETRY REGIONS: a pixel comparison found {$regionCount} area(s) of the sheet where drawn content changed. Some of these will be the text changes above; others are line work with no text attached. You have not seen them — state only that they exist and need a visual check, and never describe what is in them."
            : '';

        $prompt = "TITLE BLOCK TEXT:\n"
            .($titleBlock !== '' ? $titleBlock : '(none readable)')
            ."\n\nCHANGES:\n"
            .($lines !== [] ? implode("\n", $lines) : '(no text differences found)')
            .$truncated
            .$geometry;

        try {
            $response = DrawingChangeAgent::make()->prompt(
                prompt: $prompt,
                provider: $provider,
                model: $model,
                timeout: (int) config('drawings.comparison.timeout', 120),
            );

            return [
                'structured' => $response->toArray(),
                'model' => $model,
                'input_tokens' => $response->usage->promptTokens,
                'output_tokens' => $response->usage->completionTokens,
            ];
        } catch (\Throwable $e) {
            // A failed interpretation must not lose the diff. The raw changes
            // are still exact and still worth showing, just without ranking.
            Log::warning('Drawing change interpretation failed; keeping raw diff', [
                'model' => $model,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Write the diff and its interpretation, replacing any previous attempt.
     *
     * @param  list<array<string, mixed>>  $changes
     * @param  list<array<string, mixed>>  $regions
     * @param  array<string, mixed>|null  $interpretation
     */
    private function persist(
        DrawingComparison $comparison,
        array $changes,
        array $regions,
        ?array $interpretation,
        bool $textLocatable = false,
    ): void {
        $structured = $interpretation['structured'] ?? [];

        // Index the model's per-change entries so they can be matched back to
        // the diff rows they describe.
        $byIndex = [];
        foreach ($structured['changes'] ?? [] as $entry) {
            if (isset($entry['index']) && is_numeric($entry['index'])) {
                $byIndex[(int) $entry['index']] = $entry;
            }
        }

        DB::transaction(function () use ($comparison, $changes, $regions, $structured, $byIndex, $interpretation, $textLocatable) {
            $comparison->items()->delete();

            $high = 0;
            $rows = [];
            $now = now();

            foreach ($changes as $index => $change) {
                $entry = $byIndex[$index] ?? null;
                $significance = $entry['significance'] ?? null;

                if ($significance === 'high') {
                    $high++;
                }

                $rows[] = [
                    'drawing_comparison_id' => $comparison->id,
                    'source' => DrawingChangeItem::SOURCE_TEXT_LAYER,
                    'change_type' => $change['change_type'],
                    'text_old' => $change['text_old'],
                    'text_new' => $change['text_new'],
                    'page_number' => $change['page_number'],
                    'x' => $change['x'],
                    'y' => $change['y'],
                    'w' => $change['w'],
                    'h' => $change['h'],
                    'locatable' => $textLocatable,
                    'element' => $entry['element'] ?? null,
                    'description' => $entry['description'] ?? null,
                    'trade_impact' => isset($entry['trade_impact'])
                        ? json_encode(array_values((array) $entry['trade_impact']))
                        : null,
                    'significance' => $significance,
                    'confidence' => isset($entry['confidence']) ? (float) $entry['confidence'] : null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            // Geometry regions. No description is written for these: nothing
            // has looked at them yet, and inventing one would be exactly the
            // fabrication this design exists to avoid. They carry a position
            // and a size, which is enough to go and look. Phase 3's vision pass
            // over these crops is what fills in the description.
            foreach ($regions as $region) {
                $rows[] = [
                    'drawing_comparison_id' => $comparison->id,
                    'source' => DrawingChangeItem::SOURCE_RASTER,
                    'change_type' => DrawingChangeItem::TYPE_MODIFIED,
                    'text_old' => null,
                    'text_new' => null,
                    'page_number' => 1,
                    'x' => $region['x'],
                    'y' => $region['y'],
                    'w' => $region['w'],
                    'h' => $region['h'],
                    // Measured off the rendered page, so always a true position.
                    'locatable' => true,
                    'element' => 'changed area',
                    'description' => null,
                    'trade_impact' => null,
                    'significance' => null,
                    'confidence' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            foreach (array_chunk($rows, 500) as $chunk) {
                DrawingChangeItem::insert($chunk);
            }

            $methods = [];
            if ($changes !== []) {
                $methods[] = 'text_layer';
            }
            if (! empty($structured['revision_notes'])) {
                $methods[] = 'title_block';
            }
            if ($regions !== []) {
                $methods[] = 'raster';
            }

            $comparison->update([
                'status' => DrawingComparison::STATUS_COMPLETE,
                'methods' => $methods,
                'coordinates_reliable' => $textLocatable,
                'summary' => $structured['summary'] ?? $this->fallbackSummary($changes, count($regions)),
                'revision_notes' => $structured['revision_notes'] ?? [],
                'changes_total' => count($changes) + count($regions),
                'changes_high' => $high,
                'model' => $interpretation['model'] ?? null,
                'input_tokens' => $interpretation['input_tokens'] ?? null,
                'output_tokens' => $interpretation['output_tokens'] ?? null,
                'analyzed_at' => now(),
            ]);
        });
    }

    /**
     * Whether extracted text coordinates line up with the sheet's real page box.
     *
     * The PHP text parser does not resolve transforms on content nested inside
     * form XObjects, which CAD exporters use heavily. When that happens the
     * coordinates are internally consistent — so the diff and its registration
     * are unaffected — but they are not positions on the page, and offering to
     * zoom to one would send the user somewhere arbitrary. Checking the
     * extracted extent against the actual page box catches it.
     *
     * @param  array{min_x: float, min_y: float, max_x: float, max_y: float}  $extraction
     */
    private function textCoordinatesUsable(array $extraction, float $pageWidth, float $pageHeight): bool
    {
        if ($pageWidth <= 0 || $pageHeight <= 0) {
            return false;
        }

        // Allow a little slack for text whose estimated width overhangs the
        // trim edge, but nothing like the multiples seen when the transform is
        // unresolved.
        $marginX = $pageWidth * 0.1;
        $marginY = $pageHeight * 0.1;

        return $extraction['min_x'] >= -$marginX
            && $extraction['min_y'] >= -$marginY
            && $extraction['max_x'] <= $pageWidth + $marginX
            && $extraction['max_y'] <= $pageHeight + $marginY;
    }

    /**
     * Pull the strings that live in the sheet border, where the title block and
     * its revision table sit under every drafting standard in use here.
     *
     * Geometry rather than pattern matching, because revision tables have no
     * consistent wording — but they are always in the border.
     *
     * @param  array{items: list<array<string, mixed>>, min_x: float, min_y: float, page_width: float, page_height: float}  $extraction
     */
    private function titleBlockText(array $extraction): string
    {
        $width = $extraction['page_width'] ?? 0;
        $height = $extraction['page_height'] ?? 0;

        if ($width <= 0 || $height <= 0) {
            return '';
        }

        // Bands are measured from the content's actual origin, which is not
        // necessarily (0, 0) — CAD exports often sit in a translated user space.
        $minX = $extraction['min_x'] ?? 0;
        $minY = $extraction['min_y'] ?? 0;

        $rightBand = $minX + $width * 0.72;
        $bottomBand = $minY + $height * 0.18;

        $items = array_filter(
            $extraction['items'],
            fn (array $item) => $item['x'] >= $rightBand || $item['y'] <= $bottomBand,
        );

        // Reading order: top of the sheet down, then left to right. PDF y grows
        // upward, hence the descending sort.
        usort($items, function (array $a, array $b) {
            $rowDelta = $b['y'] <=> $a['y'];

            // Treat anything within a line height as the same row so a table
            // row reads as one line rather than being split by sub-point jitter.
            if (abs($a['y'] - $b['y']) < 4) {
                return $a['x'] <=> $b['x'];
            }

            return $rowDelta;
        });

        $lines = [];
        $currentY = null;
        $current = [];

        foreach (array_slice($items, 0, 400) as $item) {
            if ($currentY !== null && abs($item['y'] - $currentY) >= 4) {
                $lines[] = implode(' ', $current);
                $current = [];
            }

            $current[] = $item['text'];
            $currentY = $item['y'];
        }

        if ($current !== []) {
            $lines[] = implode(' ', $current);
        }

        return trim(implode("\n", $lines));
    }

    /**
     * Summary used when the interpretation call was skipped or failed. States
     * only what the diff itself proves.
     *
     * @param  list<array<string, mixed>>  $changes
     */
    private function fallbackSummary(array $changes, int $regionCount = 0): string
    {
        $geometry = $regionCount > 0
            ? sprintf(' %d area%s of the sheet also changed geometrically.', $regionCount, $regionCount === 1 ? '' : 's')
            : '';

        if ($changes === []) {
            return $regionCount > 0
                ? sprintf('No text differences were found, but %d area%s of the sheet changed geometrically. Open each to see what changed.', $regionCount, $regionCount === 1 ? '' : 's')
                : 'No differences were found between these two revisions.';
        }

        $counts = array_count_values(array_column($changes, 'change_type'));
        $parts = [];

        foreach (['added' => 'added', 'removed' => 'removed', 'modified' => 'changed', 'moved' => 'moved'] as $key => $label) {
            if (! empty($counts[$key])) {
                $parts[] = "{$counts[$key]} {$label}";
            }
        }

        return sprintf(
            '%d text differences found (%s).%s Automatic interpretation was unavailable, so these are unranked.',
            count($changes),
            implode(', ', $parts),
            $geometry,
        );
    }

    private function quote(?string $value): string
    {
        return $value === null ? '—' : '"'.str_replace('"', "'", $value).'"';
    }
}
