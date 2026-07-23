<?php

namespace App\Ai\Agents;

use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\JsonSchema\Types\Type;
use Laravel\Ai\Attributes\MaxTokens;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Promptable;
use Stringable;

/**
 * Interprets an already-computed drawing revision diff.
 *
 * This agent is deliberately not asked to *find* the changes — the text-layer
 * diff has already done that exactly, with coordinates. Handing a model two
 * dense A1 sheets and asking "what changed" produces confident fiction. Given a
 * concrete list of before/after strings it is instead doing what it is good at:
 * naming the element, saying what the change means for the trades, and ranking
 * what matters.
 *
 * It also parses the title-block revision table, which is the drafter's own
 * account of the revision and the closest thing to ground truth on the sheet.
 */
// No #[Temperature] — sampling parameters are rejected on Opus 4.7+ and return
// a 400. Determinism comes from the prompt and the structured-output schema.
#[MaxTokens(8192)]
class DrawingChangeAgent implements Agent, HasStructuredOutput
{
    use Promptable;

    public function instructions(): Stringable|string
    {
        return <<<'PROMPT'
        You interpret revision differences on construction drawings for a commercial
        interiors contractor. The trades on this job are walls (stud partitions,
        framing, linings) and ceilings (grid, plasterboard, bulkheads). Everything
        else is context.

        You are given two things:
        1. TITLE BLOCK TEXT — raw strings lifted from the border of the new sheet.
           Somewhere in here is usually the revision history table.
        2. CHANGES — an exact, pre-computed list of text differences between the old
           and new revision, each with an index and a position on the sheet.

        ## Rules
        - The CHANGES list is ground truth. Do not invent changes that are not in it,
          and do not claim a change was not made just because it seems minor.
        - Interpret every change you are given. Return one entry per index.
        - `element` is what the text labels, in the drawing's own vocabulary: "room
          name", "door tag", "dimension", "ceiling height", "general note",
          "partition type", "drawing number", "revision stamp", etc.
        - `description` is one plain sentence a site foreman would understand. Say
          what changed, not that something changed. "Ceiling height in Meeting Room
          2.04 raised from 2700 to 2850" — not "a dimension was modified".
        - `trade_impact` lists only trades whose scope or quantity is actually
          affected. Use "walls", "ceilings", or "other". An empty list is correct and
          expected for drafting-only edits.
        - `significance` is the judgement that makes this list usable:
          - high   — changes what gets built or ordered: added/removed walls, changed
                     partition types, changed ceiling heights or grid layout, room
                     boundary changes.
          - medium — likely to matter but needs confirming: renamed rooms, changed
                     door or window tags, revised general notes with scope wording.
          - low    — drafting or admin only: revision stamps, dates, sheet numbers,
                     issue status, north points, scale bars, drafter initials, text
                     nudged a few millimetres.
          Most changes on a typical revision are low. Do not inflate.
        - `confidence` is 0 to 1. Be honest — a bare number with no unit is genuinely
          ambiguous, and saying so is more useful than guessing.

        ## Revision notes
        Extract the revision history rows from the title block text: revision code,
        date, and the description the drafter wrote. Return them newest first. If the
        title block text contains no recognisable revision table, return an empty
        list — do not fabricate rows from the change list.

        ## Summary
        Two to four sentences. Lead with what actually changed on this sheet and what
        it means for walls and ceilings. If the drafter's own revision note is
        present, reconcile it with what the diff shows and say plainly when they
        disagree — a note reading "no change to layout" alongside three new
        dimensions is exactly the thing worth flagging. If every change is low
        significance, say so in one sentence rather than padding.
        PROMPT;
    }

    /**
     * @return array<string, Type>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'summary' => $schema->string()
                ->description('Two to four plain-English sentences on what changed in this revision and what it means for walls and ceilings.')
                ->required(),

            'revision_notes' => $schema->array()
                ->description('Revision history rows read from the title block, newest first. Empty if the sheet has no readable revision table.')
                ->items($schema->object([
                    'revision' => $schema->string()
                        ->description('Revision code exactly as printed, e.g. "C" or "P3".'),
                    'date' => $schema->string()
                        ->description('Date as printed on the sheet. Empty string if absent.'),
                    'description' => $schema->string()
                        ->description('What the drafter wrote this revision was for.'),
                ]))
                ->required(),

            'changes' => $schema->array()
                ->description('One entry per index in the supplied CHANGES list.')
                ->items($schema->object([
                    'index' => $schema->integer()
                        ->description('The index of the change being interpreted, copied from the input.'),
                    'element' => $schema->string()
                        ->description('What the changed text labels, e.g. "room name", "dimension", "door tag".'),
                    'description' => $schema->string()
                        ->description('One sentence a site foreman would understand, stating what changed.'),
                    'trade_impact' => $schema->array()
                        ->description('Affected trades. Empty when the change is drafting-only.')
                        ->items($schema->string()->enum(['walls', 'ceilings', 'other'])),
                    'significance' => $schema->string()
                        ->description('high = changes what gets built or ordered; medium = needs confirming; low = drafting or admin only.')
                        ->enum(['high', 'medium', 'low']),
                    'confidence' => $schema->number()
                        ->description('0 to 1. How sure you are of this interpretation.'),
                ]))
                ->required(),
        ];
    }
}
