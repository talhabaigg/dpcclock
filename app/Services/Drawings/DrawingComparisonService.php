<?php

namespace App\Services\Drawings;

use App\Ai\Agents\DrawingChangeAgent;
use App\Ai\Agents\DrawingRevisionSummaryAgent;
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
    /**
     * Bump when detection changes in a way that would give a different answer.
     *
     * Comparisons are cached on the revision pair, which is correct while the
     * algorithm is fixed — and silently wrong the moment it improves, because
     * every sheet a user has already opened keeps serving the old result. A
     * stale row is re-run on next view.
     */
    public const PIPELINE_VERSION = 7;

    /**
     * Changes classified per model call. Keeps output length bounded no matter
     * how heavily revised the sheet is — see DrawingChangeAgent.
     */
    private const CLASSIFY_BATCH = 40;

    /**
     * Ratio of mean text-run lengths beyond which the two PDFs are considered
     * to tokenise text too differently to diff at token level.
     */
    private const TOKENISATION_TOLERANCE = 1.25;

    /**
     * Below this, a vision read is recorded but its description is discarded.
     * A guess presented in the same voice as a confident reading is worse than
     * no description at all.
     */
    private const MIN_VISION_CONFIDENCE = 0.4;

    public function __construct(
        private readonly PdfTextExtractor $extractor,
        private readonly DrawingTextDiffService $differ,
        private readonly DrawingRasterDiffService $rasterDiffer,
        private readonly DrawingRasterizer $rasterizer,
        private readonly DrawingRegionVisionService $vision,
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

        $stale = $comparison->status === DrawingComparison::STATUS_COMPLETE
            && (int) $comparison->pipeline_version !== self::PIPELINE_VERSION;

        if ($comparison->status === DrawingComparison::STATUS_FAILED || $stale) {
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
        if ($comparison->status === DrawingComparison::STATUS_COMPLETE
            && (int) $comparison->pipeline_version === self::PIPELINE_VERSION) {
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

            $textComparable = $oldText !== null && $newText !== null
                && $this->textIsComparable($oldText, $newText);

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

            // Read the regions before summarising, so the roll-up can talk
            // about what is actually in them rather than only counting them.
            $vision = $this->describeRegions($oldSource, $newSource, $regions, $pageBox);
            $regions = $this->applyVerdicts($regions, $vision['verdicts']);

            $interpretation = $this->interpret($changes, $titleBlock, $regions, $textComparable);

            $this->persist($comparison, $changes, $regions, $interpretation, $textLocatable, $textComparable, $vision, $pageBox);

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
     * Read the detected regions with the vision pass. Never fatal — a region
     * with no verdict keeps its factual "changed area" row.
     *
     * @param  list<array<string, mixed>>  $regions
     * @return array{verdicts: array<int, array<string, mixed>>, input_tokens: int, output_tokens: int}
     */
    private function describeRegions(
        DrawingSourceFile $old,
        DrawingSourceFile $new,
        array $regions,
        ?array $pageBox,
    ): array {
        $empty = ['verdicts' => [], 'input_tokens' => 0, 'output_tokens' => 0];

        if ($regions === [] || $pageBox === null || ! $this->vision->isAvailable()) {
            return $empty;
        }

        try {
            return $this->vision->describe($old->path, $new->path, $regions, $pageBox[0], $pageBox[1]);
        } catch (\Throwable $e) {
            Log::warning('Region vision pass failed; keeping undescribed regions', [
                'error' => $e->getMessage(),
            ]);

            return $empty;
        }
    }

    /**
     * Fold vision verdicts back onto their regions.
     *
     * @param  list<array<string, mixed>>  $regions
     * @param  array<int, array<string, mixed>>  $verdicts
     * @return list<array<string, mixed>>
     */
    private function applyVerdicts(array $regions, array $verdicts): array
    {
        foreach ($verdicts as $index => $verdict) {
            if (! isset($regions[$index])) {
                continue;
            }

            // A read the model itself flagged as barely legible is worse than
            // silence: it reads with the same authority as a confident one.
            // Keep the row, drop the claim.
            $confidence = isset($verdict['confidence']) ? (float) $verdict['confidence'] : 0.0;

            if ($confidence < self::MIN_VISION_CONFIDENCE) {
                $regions[$index]['confidence'] = $confidence;

                continue;
            }

            $regions[$index] = array_merge($regions[$index], [
                'element' => $verdict['element'] ?? null,
                'description' => $verdict['description'] ?? null,
                'trade_impact' => $verdict['trade_impact'] ?? [],
                'significance' => $verdict['significance'] ?? null,
                'confidence' => $confidence,
            ]);
        }

        return $regions;
    }

    /**
     * Whether the two PDFs break text into comparable runs.
     *
     * A PDF may emit "COMMS" as one run or as five, and CAD exporters differ —
     * two revisions of one sheet measured 836 runs (5% single character) versus
     * 1140 (16%). Diffing across that boundary manufactures changes: one pair
     * claimed the letter "C" went from 4 occurrences to 71. Reassembling runs
     * into lines would fix it properly, but needs real glyph advance widths,
     * and these sheets use CID fonts with no Widths table to read them from.
     * So the mismatch is detected and declared instead of papered over.
     *
     * @param  array{items: list<array<string, mixed>>}  $old
     * @param  array{items: list<array<string, mixed>>}  $new
     */
    private function textIsComparable(array $old, array $new): bool
    {
        $meanRun = function (array $extraction): float {
            $items = $extraction['items'];

            if ($items === []) {
                return 0.0;
            }

            $chars = array_sum(array_map(fn (array $i) => mb_strlen((string) $i['text']), $items));

            return $chars / count($items);
        };

        $oldMean = $meanRun($old);
        $newMean = $meanRun($new);

        if ($oldMean <= 0 || $newMean <= 0) {
            return false;
        }

        $ratio = max($oldMean, $newMean) / min($oldMean, $newMean);

        return $ratio <= self::TOKENISATION_TOLERANCE;
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
            $result = $this->rasterDiffer->diff(
                $old->path,
                $new->path,
                $pageBox[0],
                $pageBox[1],
                (bool) config('drawings.comparison.walls_only', true),
            );
        } catch (\Throwable $e) {
            Log::warning('Raster comparison failed; keeping text results', ['error' => $e->getMessage()]);

            return [];
        }

        return $result['regions'] ?? [];
    }

    /**
     * Rank the changes and write the roll-up.
     *
     * Two stages on purpose. Classification runs in bounded batches so a busy
     * sheet cannot exhaust the output budget mid-array; the summary then works
     * from an already-ranked digest, so its length never scales with the number
     * of changes. Doing both in one call is what previously left every row on a
     * 523-change sheet unranked.
     *
     * @param  list<array<string, mixed>>  $changes
     * @return array{structured: array<string, mixed>, model: string, input_tokens: int, output_tokens: int}|null
     */
    private function interpret(array $changes, string $titleBlock, array $regions, bool $textComparable): ?array
    {
        if (! config('drawings.comparison.enabled', true)) {
            return null;
        }

        $model = (string) config('drawings.comparison.model');
        $provider = str_starts_with($model, 'claude') ? Lab::Anthropic : Lab::OpenAI;
        $limit = (int) config('drawings.comparison.max_changes_for_ai', 160);
        $timeout = (int) config('drawings.comparison.timeout', 120);

        $sent = array_slice($changes, 0, $limit, true);

        $ranked = [];
        $inputTokens = 0;
        $outputTokens = 0;

        foreach (array_chunk($sent, self::CLASSIFY_BATCH, true) as $batch) {
            $lines = [];

            foreach ($batch as $index => $change) {
                $lines[] = $this->describeForModel($index, $change);
            }

            try {
                $response = DrawingChangeAgent::make()->prompt(
                    prompt: "CHANGES:\n".implode("\n", $lines),
                    provider: $provider,
                    model: $model,
                    timeout: $timeout,
                );

                $inputTokens += $response->usage->promptTokens;
                $outputTokens += $response->usage->completionTokens;

                foreach ($response->toArray()['changes'] ?? [] as $entry) {
                    if (isset($entry['index']) && is_numeric($entry['index'])) {
                        $ranked[(int) $entry['index']] = $entry;
                    }
                }
            } catch (\Throwable $e) {
                // One failed batch must not discard the others. The diff itself
                // is exact regardless; only ranking is lost for those rows.
                Log::warning('Drawing change classification batch failed', [
                    'model' => $model,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $summary = $this->summarise($changes, $ranked, $titleBlock, $regions, $textComparable, $provider, $model, $timeout);

        if ($summary !== null) {
            $inputTokens += $summary['input_tokens'];
            $outputTokens += $summary['output_tokens'];
        }

        if ($ranked === [] && $summary === null) {
            return null;
        }

        return [
            'structured' => [
                'changes' => $ranked,
                'summary' => $summary['structured']['summary'] ?? null,
                'revision_notes' => $summary['structured']['revision_notes'] ?? [],
            ],
            'model' => $model,
            'input_tokens' => $inputTokens,
            'output_tokens' => $outputTokens,
        ];
    }

    /**
     * Render one change for the model, distinguishing a specific edit from a
     * row that stands for many instances.
     *
     * @param  array<string, mixed>  $change
     */
    private function describeForModel(int $index, array $change): string
    {
        if ($change === []) {
            return "{$index}. (unavailable)";
        }

        $label = (string) ($change['text_new'] ?? $change['text_old'] ?? '');

        if (($change['element_hint'] ?? null) !== null) {
            return sprintf(
                '%d. [area] %d %s removed and %d added within one region at (%.0f, %.0f)',
                $index,
                (int) $change['count_old'],
                $change['element_hint'],
                (int) $change['count_new'],
                $change['x'],
                $change['y'],
            );
        }

        if (($change['count_old'] ?? null) !== null) {
            return sprintf(
                '%d. [count] %s appears %d times, was %d',
                $index,
                $this->quote($label),
                (int) $change['count_new'],
                (int) $change['count_old'],
            );
        }

        return sprintf(
            '%d. [%s] old=%s new=%s at (%.0f, %.0f)',
            $index,
            $change['change_type'],
            $this->quote($change['text_old']),
            $this->quote($change['text_new']),
            $change['x'],
            $change['y'],
        );
    }

    /**
     * Roll-up pass over the ranked results.
     *
     * @param  list<array<string, mixed>>  $changes
     * @param  array<int, array<string, mixed>>  $ranked
     * @return array{structured: array<string, mixed>, input_tokens: int, output_tokens: int}|null
     */
    private function summarise(
        array $changes,
        array $ranked,
        string $titleBlock,
        array $regions,
        bool $textComparable,
        Lab $provider,
        string $model,
        int $timeout,
    ): ?array {
        $order = ['high' => 0, 'medium' => 1, 'low' => 2];

        $digest = [];
        foreach ($ranked as $index => $entry) {
            $digest[] = [
                'rank' => $order[$entry['significance'] ?? ''] ?? 3,
                'line' => sprintf(
                    '- [%s] %s',
                    $entry['significance'] ?? 'unranked',
                    $entry['description'] ?? $this->describeForModel($index, $changes[$index] ?? []),
                ),
            ];
        }

        usort($digest, fn (array $a, array $b) => $a['rank'] <=> $b['rank']);

        // Only the most significant rows reach the summary. Feeding it every
        // low-significance drafting edit is what made output length scale with
        // the size of the revision.
        $lines = array_column(array_slice($digest, 0, 60), 'line');

        $geometry = $this->geometryBriefing($regions);

        $caveat = $textComparable
            ? ''
            : "\n\nTEXT COMPARABILITY: these two PDFs encode text into very differently sized runs, so the text differences above are unreliable for this pair and may include artefacts of the export rather than real design changes. Say this plainly and lean on the geometry regions instead.";

        $prompt = "TITLE BLOCK TEXT:\n"
            .($titleBlock !== '' ? $titleBlock : '(none readable)')
            ."\n\nRANKED CHANGES:\n"
            .($lines !== [] ? implode("\n", $lines) : '(none)')
            .$geometry
            .$caveat;

        try {
            $response = DrawingRevisionSummaryAgent::make()->prompt(
                prompt: $prompt,
                provider: $provider,
                model: $model,
                timeout: $timeout,
            );

            return [
                'structured' => $response->toArray(),
                'input_tokens' => $response->usage->promptTokens,
                'output_tokens' => $response->usage->completionTokens,
            ];
        } catch (\Throwable $e) {
            Log::warning('Drawing revision summary failed; keeping ranked changes', [
                'model' => $model,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * What to tell the summary about the geometry regions.
     *
     * Regions that were read are quoted; regions that were not are counted and
     * explicitly marked as unseen. The distinction matters — the summary is
     * allowed to state what was read and must not invent what was not.
     *
     * @param  list<array<string, mixed>>  $regions
     */
    private function geometryBriefing(array $regions): string
    {
        if ($regions === []) {
            return '';
        }

        $described = array_filter($regions, fn (array $r) => ($r['description'] ?? null) !== null);
        $unread = count($regions) - count($described);

        $briefing = "\n\nGEOMETRY REGIONS: a pixel comparison found ".count($regions).' area(s) where drawn content changed.';

        if ($described !== []) {
            $order = ['high' => 0, 'medium' => 1, 'low' => 2];
            usort($described, fn (array $a, array $b) => ($order[$a['significance'] ?? ''] ?? 3) <=> ($order[$b['significance'] ?? ''] ?? 3));

            $briefing .= " These were examined directly and are reliable:\n";

            foreach (array_slice($described, 0, 20) as $region) {
                $briefing .= sprintf("- [%s] %s\n", $region['significance'] ?? 'unranked', $region['description']);
            }
        }

        if ($unread > 0) {
            $briefing .= "\n{$unread} further area(s) were not examined. Say they exist and need a visual check; never describe what is in them.";
        }

        return $briefing;
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
        bool $textComparable = true,
        array $vision = [],
        ?array $pageBox = null,
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

        DB::transaction(function () use ($comparison, $changes, $regions, $structured, $byIndex, $interpretation, $textLocatable, $textComparable, $vision, $pageBox) {
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
                    'count_old' => $change['count_old'] ?? null,
                    'count_new' => $change['count_new'] ?? null,
                    'locatable' => $textLocatable,
                    // Fall back to the diff's own idea of what this row is, so
                    // an unranked row still says "dimensions" rather than nothing.
                    'element' => $entry['element'] ?? $change['element_hint'] ?? null,
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
                if (($region['significance'] ?? null) === 'high') {
                    $high++;
                }

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
                    'count_old' => null,
                    'count_new' => null,
                    // Populated when the vision pass read this region with
                    // enough confidence; otherwise it stays a plain, locatable
                    // "changed area" the user can go and look at.
                    'element' => $region['element'] ?? 'changed area',
                    'description' => $region['description'] ?? null,
                    'trade_impact' => isset($region['trade_impact'])
                        ? json_encode(array_values((array) $region['trade_impact']))
                        : null,
                    'significance' => $region['significance'] ?? null,
                    'confidence' => isset($region['confidence']) ? (float) $region['confidence'] : null,
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
            if (array_filter($regions, fn (array $r) => ($r['description'] ?? null) !== null) !== []) {
                $methods[] = 'vision';
            }

            $comparison->update([
                'status' => DrawingComparison::STATUS_COMPLETE,
                'methods' => $methods,
                'coordinates_reliable' => $textLocatable,
                'pipeline_version' => self::PIPELINE_VERSION,
                'text_comparable' => $textComparable,
                'page_width' => $pageBox[0] ?? null,
                'page_height' => $pageBox[1] ?? null,
                'summary' => $structured['summary'] ?? $this->fallbackSummary($changes, count($regions)),
                'revision_notes' => $structured['revision_notes'] ?? [],
                'changes_total' => count($changes) + count($regions),
                'changes_high' => $high,
                'model' => $interpretation['model'] ?? null,
                'input_tokens' => ($interpretation['input_tokens'] ?? 0) + ($vision['input_tokens'] ?? 0),
                'output_tokens' => ($interpretation['output_tokens'] ?? 0) + ($vision['output_tokens'] ?? 0),
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
