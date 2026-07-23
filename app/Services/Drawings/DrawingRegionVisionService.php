<?php

namespace App\Services\Drawings;

use App\Ai\Agents\DrawingRegionVisionAgent;
use Illuminate\Support\Facades\Log;
use Laravel\Ai\Enums\Lab;
use Laravel\Ai\Files\LocalImage;

/**
 * Describes each detected change region by looking at it.
 *
 * The regions arriving here already carry a guarantee that something differs —
 * that is what the raster pass established. This turns "area 7, 86 x 38 mm"
 * into "the partition between the store and the corridor was removed", which is
 * the difference between a list of places to go look and an answer.
 *
 * Cost is bounded deliberately: regions are ranked by size, only the largest
 * are read, and the rest keep their factual "changed area" row. A sheet with
 * 200 tiny regions must not turn into 200 model calls.
 */
class DrawingRegionVisionService
{
    public function __construct(
        private readonly DrawingRegionCropper $cropper,
        private readonly DrawingRasterizer $rasterizer,
    ) {}

    public function isAvailable(): bool
    {
        return config('drawings.comparison.vision_enabled', true)
            && $this->rasterizer->isAvailable();
    }

    /**
     * Read as many regions as the budget allows.
     *
     * @param  list<array{x: float, y: float, w: float, h: float, cells: int}>  $regions
     * @return array{verdicts: array<int, array<string, mixed>>, input_tokens: int, output_tokens: int}
     *                                                                                                  Verdicts are keyed by the region's index in the supplied list, so regions
     *                                                                                                  that were skipped or failed simply have no entry.
     */
    public function describe(
        string $oldPdfPath,
        string $newPdfPath,
        array $regions,
        float $pageWidth,
        float $pageHeight,
    ): array {
        $empty = ['verdicts' => [], 'input_tokens' => 0, 'output_tokens' => 0];

        if (! $this->isAvailable() || $regions === []) {
            return $empty;
        }

        $model = (string) config('drawings.comparison.vision_model')
            ?: (string) config('drawings.comparison.model');
        $provider = str_starts_with($model, 'claude') ? Lab::Anthropic : Lab::OpenAI;
        $timeout = (int) config('drawings.comparison.timeout', 120);
        $limit = (int) config('drawings.comparison.max_regions_for_vision', 25);

        // Largest first: area on the sheet is the best cheap proxy for how much
        // changed, and it means a truncated budget spends on the big changes.
        $order = array_keys($regions);
        usort($order, fn (int $a, int $b) => ($regions[$b]['w'] * $regions[$b]['h']) <=> ($regions[$a]['w'] * $regions[$a]['h']));
        $order = array_slice($order, 0, $limit);

        $verdicts = [];
        $inputTokens = 0;
        $outputTokens = 0;

        // Rasterize each sheet once up front. Every crop is then a cheap cut
        // from that image rather than another full-page render of the PDF.
        $oldPage = $this->cropper->prepare($oldPdfPath);
        $newPage = $this->cropper->prepare($newPdfPath);

        if ($oldPage === null || $newPage === null) {
            $this->cropper->release($oldPage);
            $this->cropper->release($newPage);

            return $empty;
        }

        try {
            foreach ($order as $index) {
                $result = $this->describeRegion(
                    $oldPage,
                    $newPage,
                    $regions[$index],
                    $pageWidth,
                    $pageHeight,
                    $provider,
                    $model,
                    $timeout,
                );

                if ($result === null) {
                    continue;
                }

                $verdicts[$index] = $result['verdict'];
                $inputTokens += $result['input_tokens'];
                $outputTokens += $result['output_tokens'];
            }
        } finally {
            $this->cropper->release($oldPage);
            $this->cropper->release($newPage);
        }

        return [
            'verdicts' => $verdicts,
            'input_tokens' => $inputTokens,
            'output_tokens' => $outputTokens,
        ];
    }

    /**
     * @param  array{x: float, y: float, w: float, h: float}  $region
     * @return array{verdict: array<string, mixed>, input_tokens: int, output_tokens: int}|null
     */
    private function describeRegion(
        string $oldPage,
        string $newPage,
        array $region,
        float $pageWidth,
        float $pageHeight,
        Lab $provider,
        string $model,
        int $timeout,
    ): ?array {
        $oldCrop = null;
        $newCrop = null;

        try {
            $oldCrop = $this->cropper->crop($oldPage, $region, $pageWidth, $pageHeight);
            $newCrop = $this->cropper->crop($newPage, $region, $pageWidth, $pageHeight);

            if ($oldCrop === null || $newCrop === null) {
                return null;
            }

            $response = DrawingRegionVisionAgent::make()->prompt(
                prompt: 'The first image is the OLD revision of this area; the second is the NEW revision. Describe what changed.',
                attachments: [
                    new LocalImage($oldCrop, 'image/png'),
                    new LocalImage($newCrop, 'image/png'),
                ],
                provider: $provider,
                model: $model,
                timeout: $timeout,
            );

            return [
                'verdict' => $response->toArray(),
                'input_tokens' => $response->usage->promptTokens,
                'output_tokens' => $response->usage->completionTokens,
            ];
        } catch (\Throwable $e) {
            // One unreadable region must not sink the rest. It keeps its plain
            // "changed area" row, which is still true and still locatable.
            Log::warning('Region vision read failed', [
                'model' => $model,
                'error' => $e->getMessage(),
            ]);

            return null;
        } finally {
            foreach ([$oldCrop, $newCrop] as $path) {
                if ($path !== null && file_exists($path)) {
                    @unlink($path);
                }
            }
        }
    }
}
