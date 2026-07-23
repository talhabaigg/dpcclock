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
     * Above this many instances of the same label, individual instances stop
     * being distinguishable and only the population is reported.
     */
    private const LOW_MULTIPLICITY = 3;

    /**
     * Points within which two dimension/tag edits are treated as the same area
     * of revision. Roughly a 5m square of building at 1:100 on A1.
     */
    private const CLUSTER_RADIUS = 150.0;

    /** Below this many low-information edits, listing them individually is fine. */
    private const CLUSTER_MIN_MEMBERS = 6;

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

        [$moved, $unmatchedOld, $unmatchedNew, $aggregates] = $this->matchByText($oldItems, $newItems);

        $changes = array_merge($moved, $aggregates);

        foreach ($this->pairEdits($unmatchedOld, $unmatchedNew) as $change) {
            $changes[] = $change;
        }

        return $this->clusterLowInformation($changes);
    }

    /**
     * Collapse dimension and tag churn into one row per area of the sheet.
     *
     * A partition revision legitimately changes dozens of dimensions. Listing
     * them individually — "2492 removed, 3176 added, 2633 removed" — is
     * technically accurate and useless: the values only mean anything while
     * you are looking at that spot on the drawing, where the drawing already
     * tells you. What a reader needs is "dimensions were revised here". On the
     * sheet that prompted this, 83 of 155 remaining rows were four-digit
     * dimensions.
     *
     * Text carrying actual meaning — room names, notes, partition types — is
     * never clustered; those stay as individual rows.
     *
     * @param  list<array<string, mixed>>  $changes
     * @return list<array<string, mixed>>
     */
    private function clusterLowInformation(array $changes): array
    {
        $keep = [];
        $cluster = [];

        foreach ($changes as $change) {
            $isPopulationRow = $change['count_old'] !== null;
            $isAddOrRemove = in_array($change['change_type'], ['added', 'removed'], true);
            $text = (string) ($change['text_new'] ?? $change['text_old'] ?? '');

            if (! $isPopulationRow && $isAddOrRemove && $this->isLowInformation($text)) {
                $cluster[] = $change;

                continue;
            }

            $keep[] = $change;
        }

        if (count($cluster) < self::CLUSTER_MIN_MEMBERS) {
            // Too few to be churn; individual rows are more informative.
            return array_merge($keep, $cluster);
        }

        foreach ($this->groupByProximity($cluster) as $group) {
            $keep[] = $this->clusterRow($group);
        }

        return $keep;
    }

    /**
     * Whether a string carries meaning on its own. Pure numbers are dimensions;
     * one- to three-character strings are grid, door and type tags.
     */
    private function isLowInformation(string $text): bool
    {
        $trimmed = trim($text);

        if ($trimmed === '') {
            return true;
        }

        return preg_match('/^[\d.,\-\/ ]+$/', $trimmed) === 1 || mb_strlen($trimmed) <= 3;
    }

    /**
     * Greedy spatial grouping by bounding-box gap, run to a fixed point.
     *
     * @param  list<array<string, mixed>>  $changes
     * @return list<list<array<string, mixed>>>
     */
    private function groupByProximity(array $changes): array
    {
        $groups = array_map(fn (array $c) => [
            'members' => [$c],
            'x0' => $c['x'], 'y0' => $c['y'],
            'x1' => $c['x'] + $c['w'], 'y1' => $c['y'] + $c['h'],
        ], $changes);

        $merged = true;

        while ($merged) {
            $merged = false;

            for ($i = 0; $i < count($groups) && ! $merged; $i++) {
                for ($j = $i + 1; $j < count($groups); $j++) {
                    $a = $groups[$i];
                    $b = $groups[$j];

                    $gapX = max(0, max($a['x0'], $b['x0']) - min($a['x1'], $b['x1']));
                    $gapY = max(0, max($a['y0'], $b['y0']) - min($a['y1'], $b['y1']));

                    if ($gapX > self::CLUSTER_RADIUS || $gapY > self::CLUSTER_RADIUS) {
                        continue;
                    }

                    $groups[$i] = [
                        'members' => array_merge($a['members'], $b['members']),
                        'x0' => min($a['x0'], $b['x0']), 'y0' => min($a['y0'], $b['y0']),
                        'x1' => max($a['x1'], $b['x1']), 'y1' => max($a['y1'], $b['y1']),
                    ];

                    array_splice($groups, $j, 1);
                    $merged = true;
                    break;
                }
            }
        }

        return array_map(fn (array $g) => $g['members'], $groups);
    }

    /**
     * One row standing in for a cluster of dimension or tag churn.
     *
     * @param  list<array<string, mixed>>  $group
     * @return array<string, mixed>
     */
    private function clusterRow(array $group): array
    {
        $removed = 0;
        $added = 0;
        $allNumeric = true;

        foreach ($group as $change) {
            if ($change['change_type'] === 'added') {
                $added++;
            } else {
                $removed++;
            }

            $text = trim((string) ($change['text_new'] ?? $change['text_old'] ?? ''));

            if (preg_match('/^[\d.,\-\/ ]+$/', $text) !== 1) {
                $allNumeric = false;
            }
        }

        $x0 = min(array_column($group, 'x'));
        $y0 = min(array_column($group, 'y'));
        $x1 = max(array_map(fn (array $c) => $c['x'] + $c['w'], $group));
        $y1 = max(array_map(fn (array $c) => $c['y'] + $c['h'], $group));

        return [
            'change_type' => $added > 0 && $removed > 0 ? 'modified' : ($added > 0 ? 'added' : 'removed'),
            'text_old' => null,
            'text_new' => null,
            'count_old' => $removed,
            'count_new' => $added,
            'element_hint' => $allNumeric ? 'dimensions' : 'tags and dimensions',
            'page_number' => (int) ($group[0]['page_number'] ?? 1),
            'x' => (float) $x0,
            'y' => (float) $y0,
            'w' => (float) ($x1 - $x0),
            'h' => (float) ($y1 - $y0),
        ];
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
        $aggregates = [];

        $keys = array_unique(array_merge(array_keys($oldByText), array_keys($newByText)));

        foreach ($keys as $key) {
            $oldGroup = $oldByText[$key] ?? [];
            $newGroup = $newByText[$key] ?? [];
            $oldCount = count($oldGroup);
            $newCount = count($newGroup);

            $multiplicity = max($oldCount, $newCount);

            // A label appearing once per sheet has an identity: it is *that*
            // room name, *that* note. A label appearing twenty-six times —
            // grid bubbles, door tags, partition types — does not. There is no
            // fact of the matter about which "C" became which "C", so
            // reporting per instance manufactures changes: on a real sheet
            // that produced 401 "added" rows, 264 of them three characters or
            // shorter. For those, the only honest statement is the population.
            if ($multiplicity > self::LOW_MULTIPLICITY) {
                if ($oldCount !== $newCount) {
                    $aggregates[] = $this->countChange($key, $oldGroup, $newGroup);
                }

                // Equal counts: instances were reshuffled at most. Nothing to say.
                continue;
            }

            if ($multiplicity === 1) {
                $this->matchUnique($oldGroup, $newGroup, $moved, $unmatchedOld, $unmatchedNew);

                continue;
            }

            // A handful of instances. Which one moved is still ambiguous, so
            // movement stays unreported, but an appearance or disappearance is
            // specific enough to be worth surfacing — this is what keeps a
            // dimension edit reading as "2400 changed to 2700" when 2700
            // happens to occur elsewhere on the sheet too.
            $this->matchFewInstances($oldGroup, $newGroup, $unmatchedOld, $unmatchedNew);
        }

        return [$moved, $unmatchedOld, $unmatchedNew, $aggregates];
    }

    /**
     * Handle a label that occurs at most once on each sheet, where individual
     * identity is meaningful.
     *
     * @param  list<array<string, mixed>>  $oldGroup
     * @param  list<array<string, mixed>>  $newGroup
     * @param  list<array<string, mixed>>  $moved
     * @param  list<array<string, mixed>>  $unmatchedOld
     * @param  list<array<string, mixed>>  $unmatchedNew
     */
    private function matchUnique(
        array $oldGroup,
        array $newGroup,
        array &$moved,
        array &$unmatchedOld,
        array &$unmatchedNew,
    ): void {
        $oldItem = $oldGroup[0] ?? null;
        $newItem = $newGroup[0] ?? null;

        if ($oldItem !== null && $newItem !== null) {
            if ($this->distance($oldItem, $newItem) > self::MOVE_TOLERANCE) {
                $moved[] = $this->change('moved', $oldItem, $newItem);
            }

            // Within tolerance: unchanged. Emit nothing — silence here is the
            // whole point, otherwise every label on the sheet reports.
            return;
        }

        if ($oldItem !== null) {
            $unmatchedOld[] = $oldItem;

            return;
        }

        if ($newItem !== null) {
            $unmatchedNew[] = $newItem;
        }
    }

    /**
     * Handle a label with a small number of instances: pair them up by
     * proximity and pass whatever is left over on as an appearance or a
     * disappearance. Movement is deliberately not reported — with more than one
     * instance there is no telling which one moved.
     *
     * @param  list<array<string, mixed>>  $oldGroup
     * @param  list<array<string, mixed>>  $newGroup
     * @param  list<array<string, mixed>>  $unmatchedOld
     * @param  list<array<string, mixed>>  $unmatchedNew
     */
    private function matchFewInstances(
        array $oldGroup,
        array $newGroup,
        array &$unmatchedOld,
        array &$unmatchedNew,
    ): void {
        // Greedy nearest-neighbour. Optimal assignment would need Hungarian;
        // greedy is right whenever copies of a label sit further apart than
        // they moved, which on a plan they do.
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

            unset($newGroup[$bestIndex]);
        }

        foreach ($newGroup as $item) {
            $unmatchedNew[] = $item;
        }
    }

    /**
     * One row describing how the population of a repeated label changed.
     *
     * Anchored on the bounding box of every instance on the busier sheet — the
     * instances themselves are scattered, so framing where the label lives is
     * the most specific claim the data supports.
     *
     * @param  list<array<string, mixed>>  $oldGroup
     * @param  list<array<string, mixed>>  $newGroup
     * @return array<string, mixed>
     */
    private function countChange(string $label, array $oldGroup, array $newGroup): array
    {
        $oldCount = count($oldGroup);
        $newCount = count($newGroup);
        $anchorGroup = $newCount >= $oldCount ? $newGroup : $oldGroup;

        $minX = min(array_column($anchorGroup, 'x'));
        $minY = min(array_column($anchorGroup, 'y'));
        $maxX = max(array_map(fn (array $i) => $i['x'] + $i['w'], $anchorGroup));
        $maxY = max(array_map(fn (array $i) => $i['y'] + $i['h'], $anchorGroup));

        $text = $anchorGroup[0]['text'] ?? $label;

        return [
            'change_type' => $newCount > $oldCount ? 'added' : 'removed',
            'text_old' => $oldCount > 0 ? $text : null,
            'text_new' => $newCount > 0 ? $text : null,
            'count_old' => $oldCount,
            'count_new' => $newCount,
            'element_hint' => null,
            'page_number' => (int) ($anchorGroup[0]['page'] ?? 1),
            'x' => (float) $minX,
            'y' => (float) $minY,
            'w' => (float) ($maxX - $minX),
            'h' => (float) ($maxY - $minY),
        ];
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
            // Only population changes carry counts; a single-instance change
            // reports itself, not a tally.
            'count_old' => null,
            'count_new' => null,
            'element_hint' => null,
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
