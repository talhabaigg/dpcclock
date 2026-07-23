<?php

namespace App\Services\Drawings;

use App\Models\Drawing;
use Illuminate\Support\Facades\Log;
use Smalot\PdfParser\Config;
use Smalot\PdfParser\Parser;

/**
 * Pulls the text layer out of a drawing PDF, with coordinates.
 *
 * CAD-authored PDFs (which is everything coming out of Aconex) are vector with
 * a real text layer: room names, door and window tags, dimensions, notes, and
 * the title-block revision table are all extractable strings, not pixels. That
 * makes a text diff exact and hallucination-free — no rasterizing, no vision
 * model, no registration step. It is the cheapest useful signal available and
 * runs entirely in PHP via smalot/pdfparser.
 *
 * It sees nothing about pure geometry (a wall that moved, a door that vanished
 * without its tag changing). That is what the later raster and vision phases
 * are for; this class deliberately does not try.
 */
class PdfTextExtractor
{
    /**
     * Text items below this many characters are almost always stray glyph runs
     * from the PDF's own drafting furniture (leader ticks, hatch labels) and
     * generate diff noise far out of proportion to their value.
     */
    private const MIN_LENGTH = 1;

    /**
     * Extract the text layer for a drawing.
     *
     * @return array{items: list<array{text: string, x: float, y: float, w: float, h: float, size: float, page: int}>, page_height: float, page_width: float}|null
     *                                                                                                                                                             Null when the source is missing, is not a PDF, or has no text layer at all
     *                                                                                                                                                             (a scanned raster sheet) — callers should treat that as "this method does
     *                                                                                                                                                             not apply", not as an error.
     */
    public function extract(Drawing $drawing): ?array
    {
        $source = DrawingSourceFile::open($drawing);

        if ($source === null) {
            return null;
        }

        try {
            return $this->extractFromPath($source->path);
        } finally {
            $source->close();
        }
    }

    /**
     * Extract from an already-local PDF. Used when the caller has the file open
     * for other work too (rasterizing), so it is not downloaded twice.
     *
     * @return array{items: list<array<string, mixed>>, min_x: float, min_y: float, max_x: float, max_y: float, page_width: float, page_height: float}|null
     */
    public function extractFromPath(string $path): ?array
    {
        try {
            $config = new Config;
            // Font id + size ride along in each data row; we need the size to
            // estimate a bounding box, since the text matrix only gives an origin.
            $config->setDataTmFontInfoHasToBeIncluded(true);

            $parser = new Parser([], $config);
            $document = $parser->parseFile($path);

            $items = [];
            // Real bounds, not an assumed 0-origin page. CAD exports routinely
            // place content in a translated user space — observed sheets carry
            // negative x — so deriving the extent from max() alone reports a
            // sheet several times its true width and throws off anything that
            // reasons about position on the page.
            $minX = null;
            $minY = null;
            $maxX = null;
            $maxY = null;

            foreach ($document->getPages() as $pageIndex => $page) {
                $pageNumber = $pageIndex + 1;

                // Drawings are one sheet per file in this system, but parse
                // defensively — a multi-page import would otherwise silently
                // collapse every page's coordinates onto each other.
                foreach ($page->getDataTm() as $row) {
                    $matrix = $row[0] ?? null;
                    $text = trim((string) ($row[1] ?? ''));
                    $size = (float) ($row[3] ?? 0);

                    if (! is_array($matrix) || $text === '' || mb_strlen($text) < self::MIN_LENGTH) {
                        continue;
                    }

                    $x = (float) ($matrix[4] ?? 0);
                    $y = (float) ($matrix[5] ?? 0);

                    // The text matrix scales the font, so the rendered size is
                    // the declared size times the vertical scale factor. Without
                    // this, text in a scaled block reports a wrong box.
                    $verticalScale = (float) ($matrix[3] ?? 1);
                    $horizontalScale = (float) ($matrix[0] ?? 1);
                    $renderedSize = $size > 0 ? $size * ($verticalScale ?: 1) : 0.0;

                    if ($renderedSize <= 0) {
                        // Fall back to a plausible drawing-note size so the box
                        // is never zero-area; the diff only uses it for
                        // proximity, so a rough value is fine.
                        $renderedSize = 8.0;
                    }

                    // 0.55em average advance is a reasonable approximation for
                    // the condensed sans faces CAD exports use. We only need the
                    // box for "are these two strings in the same place", not for
                    // rendering, so an estimate beats parsing font metrics.
                    $width = mb_strlen($text) * $renderedSize * 0.55 * ($horizontalScale ?: 1);

                    $items[] = [
                        'text' => $text,
                        'x' => $x,
                        'y' => $y,
                        'w' => $width,
                        'h' => $renderedSize,
                        'size' => $renderedSize,
                        'page' => $pageNumber,
                    ];

                    $minX = $minX === null ? $x : min($minX, $x);
                    $minY = $minY === null ? $y : min($minY, $y);
                    $maxX = $maxX === null ? $x + $width : max($maxX, $x + $width);
                    $maxY = $maxY === null ? $y + $renderedSize : max($maxY, $y + $renderedSize);
                }
            }

            if ($items === []) {
                return null;
            }

            return [
                'items' => $items,
                'min_x' => (float) $minX,
                'min_y' => (float) $minY,
                'max_x' => (float) $maxX,
                'max_y' => (float) $maxY,
                'page_width' => (float) $maxX - (float) $minX,
                'page_height' => (float) $maxY - (float) $minY,
            ];
        } catch (\Throwable $e) {
            Log::warning('PDF text extraction failed', [
                'path' => basename($path),
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }
}
