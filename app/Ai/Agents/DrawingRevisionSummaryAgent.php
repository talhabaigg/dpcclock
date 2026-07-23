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
 * Writes the revision roll-up and reads the title-block revision table.
 *
 * Split out from DrawingChangeAgent so its output length does not scale with
 * the number of changes — it is given an already-ranked digest, never the raw
 * list. Its whole job is a few sentences and a handful of table rows, so it
 * cannot run out of tokens no matter how heavily revised the sheet is.
 */
#[MaxTokens(2048)]
class DrawingRevisionSummaryAgent implements Agent, HasStructuredOutput
{
    use Promptable;

    public function instructions(): Stringable|string
    {
        return <<<'PROMPT'
        You summarise a drawing revision for a commercial interiors contractor whose
        trades are walls (stud partitions, framing, linings) and ceilings (grid,
        plasterboard, bulkheads).

        You are given:
        1. TITLE BLOCK TEXT — raw strings from the border of the new sheet. The
           revision history table is usually somewhere in here.
        2. RANKED CHANGES — a digest of the differences already found and ranked,
           most significant first. Some rows are counts standing for many instances.
        3. Possibly a note about geometry regions or about text comparability.

        ## Revision notes
        Extract the revision history rows from the title block text: revision code,
        date, and the description the drafter wrote. Newest first. If there is no
        recognisable revision table, return an empty list — never fabricate rows
        from the change list.

        ## Summary
        Two to four sentences. Lead with what actually changed and what it means for
        walls and ceilings. Reconcile the drafter's own revision note against what
        the diff shows, and say plainly when they disagree — a note reading "no
        change to layout" alongside three new dimensions is exactly what is worth
        flagging. If every change is minor, say so in one sentence rather than
        padding it out.

        Only describe changes present in what you were given. If you are told the
        text comparison is unreliable for this pair, or that geometry regions exist
        that you cannot see, say so plainly and recommend the visual check — do not
        paper over it, and do not guess what is in them.
        PROMPT;
    }

    /**
     * @return array<string, Type>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'summary' => $schema->string()
                ->description('Two to four plain-English sentences on what changed and what it means for walls and ceilings.')
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
        ];
    }
}
