<?php

namespace App\Services\Drawings;

/**
 * Diffs the text layers of two drawing revisions.
 *
 * The hard part is not finding differing strings — it is not reporting the
 * thousands of strings that only *look* different because the sheet was
 * re-plotted a few points off. So the first thing this does is register the two
 * text layers against each other (median offset of confidently-matched labels)
 * and subtract that offset before anything is called moved. Skip that step and
 * a clean revision reads as "everything changed".
 */
class DrawingTextDiffService
{
    /**
     * Points of residual displacement tolerated after registration. Below this
     * a label is in the same place; above it, it genuinely moved.
     */
    private const MOVE_TOLERANCE = 4.0;

    /**
     * Points within which an added and a removed string are close enough to be
     * the same label edited, rather than two unrelated changes.
     */
    private const EDIT_RADIUS = 30.0;

    /**
     * How alike two strings must be (0-1) to read as an edit of one label
     * rather than an unrelated add plus remove. 0.5 pairs "2400"/"2700" and
     * "RM 1.01"/"RM 1.02" while leaving genuinely different notes apart.
     */
    private const EDIT_SIMILARITY = 0.5;

    /**
     * @param  array{items: list<array<string, mixed>>}  $old
     * @param  array{items: list<array<string, mixed>>}  $new
     * @return list<array{change_type: string, text_old: ?string, text_new: ?string, page_number: int, x: float, y: float, w: float, h: float}>
     */
    public function diff(array $old, array $new): array
    {
        $oldItems = $old['items'] ?? [];
        $newItems = $new['items'] ?? [];

        if ($oldItems === [] || $newItems === []) {
            return [];
        }

        [$offsetX, $offsetY] = $this->estimateOffset($oldItems, $newItems);

        // Shift the old layer onto the new one so every later comparison is
        // between registered coordinates.
        foreach ($oldItems as $index => $item) {
            $oldItems[$index]['x'] = $item['x'] + $offsetX;
            $oldItems[$index]['y'] = $item['y'] + $offsetY;
        }

        [$moved, $unmatchedOld, $unmatchedNew] = $this->matchByText($oldItems, $newItems);

        $changes = $moved;

        foreach ($this->pairEdits($unmatchedOld, $unmatchedNew) as $change) {
            $changes[] = $change;
        }

        return $changes;
    }

    /**
     * Median translation between the two text layers.
     *
     * Only labels whose normalized text appears exactly once on each sheet are
     * used — those are unambiguous anchors. The median (not the mean) keeps a
     * handful of genuinely-relocated labels from dragging the estimate.
     *
     * @return array{0: float, 1: float}
     */
    private function estimateOffset(array $oldItems, array $newItems): array
    {
        $oldUnique = $this->uniqueByText($oldItems);
        $newUnique = $this->uniqueByText($newItems);

        $deltaX = [];
        $deltaY = [];

        foreach ($oldUnique as $key => $oldItem) {
            if (! isset($newUnique[$key])) {
                continue;
            }

            $deltaX[] = $newUnique[$key]['x'] - $oldItem['x'];
            $deltaY[] = $newUnique[$key]['y'] - $oldItem['y'];
        }

        // Too few anchors to trust a registration; assume the sheets already
        // align rather than shifting everything by a guess.
        if (count($deltaX) < 5) {
            return [0.0, 0.0];
        }

        return [$this->median($deltaX), $this->median($deltaY)];
    }

    /**
     * Index items by normalized text, keeping only texts that occur exactly
     * once. Repeated labels ("FFL", "1:100") cannot anchor a registration.
     *
     * @return array<string, array<string, mixed>>
     */
    private function uniqueByText(array $items): array
    {
        $byText = [];

        foreach ($items as $item) {
            $key = $this->normalize($item['text']);

            if ($key === '') {
                continue;
            }

            // Mark duplicates rather than dropping immediately, so the second
            // occurrence also disqualifies the first.
            $byText[$key][] = $item;
        }

        return array_map(
            fn (array $group) => $group[0],
            array_filter($byText, fn (array $group) => count($group) === 1)
        );
    }

    /**
     * Pair items whose text matches exactly, nearest-first, and classify what
     * is left over.
     *
     * @return array{0: list<array<string, mixed>>, 1: list<array<string, mixed>>, 2: list<array<string, mixed>>}
     */
    private function matchByText(array $oldItems, array $newItems): array
    {
        $oldByText = [];
        foreach ($oldItems as $item) {
            $oldByText[$this->normalize($item['text'])][] = $item;
        }

        $newByText = [];
        foreach ($newItems as $item) {
            $newByText[$this->normalize($item['text'])][] = $item;
        }

        $moved = [];
        $unmatchedOld = [];
        $unmatchedNew = [];

        foreach ($oldByText as $key => $oldGroup) {
            $newGroup = $newByText[$key] ?? [];

            // Only a label that appears exactly once on each sheet has an
            // identity we can track. Grid bubbles, level markers and repeated
            // dimensions occur dozens of times; pairing them by proximity picks
            // an arbitrary partner and reports a move that never happened. On a
            // real sheet that noise swamped every genuine change, so ambiguous
            // labels are matched (to keep them out of added/removed) but their
            // displacement is never reported.
            $trackable = count($oldGroup) === 1 && count($newGroup) === 1;

            // Greedy nearest-neighbour within the same text. Optimal assignment
            // would need Hungarian; greedy is correct whenever copies of the
            // same label are further apart than they moved, which on a plan
            // they always are.
            foreach ($oldGroup as $oldItem) {
                $bestIndex = null;
                $bestDistance = null;

                foreach ($newGroup as $index => $candidate) {
                    $distance = $this->distance($oldItem, $candidate);

                    if ($bestDistance === null || $distance < $bestDistance) {
                        $bestDistance = $distance;
                        $bestIndex = $index;
                    }
                }

                if ($bestIndex === null) {
                    $unmatchedOld[] = $oldItem;

                    continue;
                }

                $match = $newGroup[$bestIndex];
                unset($newGroup[$bestIndex]);

                if ($trackable && $bestDistance > self::MOVE_TOLERANCE) {
                    $moved[] = $this->change('moved', $oldItem, $match);
                }
                // Within tolerance, or not uniquely identifiable: unchanged.
                // Emit nothing — silence here is the whole point, otherwise
                // every label on the sheet reports.
            }

            $newByText[$key] = $newGroup;
        }

        foreach ($newByText as $remaining) {
            foreach ($remaining as $item) {
                $unmatchedNew[] = $item;
            }
        }

        return [$moved, $unmatchedOld, $unmatchedNew];
    }

    /**
     * Turn spatially-close, textually-similar add/remove pairs into single
     * "modified" entries. A dimension changing 2400 -> 2700 is one change to a
     * reader, not two.
     *
     * @return list<array<string, mixed>>
     */
    private function pairEdits(array $unmatchedOld, array $unmatchedNew): array
    {
        $changes = [];
        $consumedNew = [];

        foreach ($unmatchedOld as $oldItem) {
            $bestIndex = null;
            $bestScore = null;

            foreach ($unmatchedNew as $index => $candidate) {
                if (isset($consumedNew[$index])) {
                    continue;
                }

                $distance = $this->distance($oldItem, $candidate);

                if ($distance > self::EDIT_RADIUS) {
                    continue;
                }

                $similarity = $this->similarity($oldItem['text'], $candidate['text']);

                if ($similarity < self::EDIT_SIMILARITY) {
                    continue;
                }

                // Prefer the most similar text; break ties by proximity.
                $score = $similarity - ($distance / self::EDIT_RADIUS) * 0.1;

                if ($bestScore === null || $score > $bestScore) {
                    $bestScore = $score;
                    $bestIndex = $index;
                }
            }

            if ($bestIndex === null) {
                $changes[] = $this->change('removed', $oldItem, null);

                continue;
            }

            $consumedNew[$bestIndex] = true;
            $changes[] = $this->change('modified', $oldItem, $unmatchedNew[$bestIndex]);
        }

        foreach ($unmatchedNew as $index => $item) {
            if (isset($consumedNew[$index])) {
                continue;
            }

            $changes[] = $this->change('added', null, $item);
        }

        return $changes;
    }

    /**
     * Build a change row. Geometry comes from the new side when there is one,
     * so the viewer zooms to where the change now is rather than where it was.
     *
     * @return array<string, mixed>
     */
    private function change(string $type, ?array $oldItem, ?array $newItem): array
    {
        $anchor = $newItem ?? $oldItem;

        return [
            'change_type' => $type,
            'text_old' => $oldItem['text'] ?? null,
            'text_new' => $newItem['text'] ?? null,
            'page_number' => (int) ($anchor['page'] ?? 1),
            'x' => (float) $anchor['x'],
            'y' => (float) $anchor['y'],
            'w' => (float) $anchor['w'],
            'h' => (float) $anchor['h'],
        ];
    }

    /**
     * Case- and whitespace-insensitive key. CAD exports are inconsistent about
     * both between plots, and neither difference is a design change.
     */
    private function normalize(string $text): string
    {
        return mb_strtoupper(trim(preg_replace('/\s+/u', ' ', $text) ?? ''));
    }

    private function distance(array $a, array $b): float
    {
        return sqrt((($a['x'] - $b['x']) ** 2) + (($a['y'] - $b['y']) ** 2));
    }

    /**
     * 0-1 similarity, Levenshtein-based with a length guard so long notes are
     * not called similar just because they share a prefix.
     */
    private function similarity(string $a, string $b): float
    {
        $a = $this->normalize($a);
        $b = $this->normalize($b);

        if ($a === '' || $b === '') {
            return 0.0;
        }

        if ($a === $b) {
            return 1.0;
        }

        $longest = max(mb_strlen($a), mb_strlen($b));

        // levenshtein() is byte-based and caps at 255 bytes; long notes fall
        // back to similar_text(), which has no such limit.
        if (strlen($a) > 255 || strlen($b) > 255) {
            similar_text($a, $b, $percent);

            return $percent / 100;
        }

        return 1 - (levenshtein($a, $b) / $longest);
    }

    /**
     * @param  list<float>  $values
     */
    private function median(array $values): float
    {
        sort($values);
        $count = count($values);
        $middle = intdiv($count, 2);

        return $count % 2 === 0
            ? ($values[$middle - 1] + $values[$middle]) / 2
            : $values[$middle];
    }
}
