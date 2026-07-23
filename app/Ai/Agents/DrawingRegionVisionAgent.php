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
 * Reads one changed region of a drawing, before and after.
 *
 * This is the only place in the pipeline where a model is asked what changed
 * rather than to interpret something already found — and it is safe here
 * precisely because the question has been narrowed to a single small crop that
 * pixel comparison already proved contains a difference. The model is not
 * hunting; it is describing a difference known to exist.
 */
#[MaxTokens(1024)]
class DrawingRegionVisionAgent implements Agent, HasStructuredOutput
{
    use Promptable;

    public function instructions(): Stringable|string
    {
        return <<<'PROMPT'
        You are reading one small area of a construction drawing for a commercial
        interiors contractor. The trades are walls (stud partitions, framing,
        linings) and ceilings (grid, plasterboard, bulkheads).

        You are given exactly two images of the SAME area of the SAME sheet:
        the first is the OLD revision, the second is the NEW revision. A pixel
        comparison has already established that something in this area differs —
        your job is to say what.

        ## Rules
        - Compare the two images and describe the difference you can actually see.
        - If you cannot tell what changed, say so and give a low confidence. That is
          a useful answer. Inventing a plausible-sounding wall change is not.
        - Ignore differences that are only line weight, anti-aliasing, or a slight
          shift of the whole crop — those are rendering artefacts, not design changes.
        - TWENTY WORDS MAXIMUM. This is a list someone scans, not prose. State the
          change and stop. "Partition between store and corridor removed" is a
          complete answer; the reader can open the image for the rest.
        - Name the thing the way a site foreman would ("the partition on the north
          side of the corridor", never "the line at coordinates 340,120").
        - Do not describe the whole drawing, restate the room, or explain your
          reasoning. Only the difference.

        ## Significance
        - high   — changes what gets built or ordered: walls added, removed or
                   relocated, partition type changed, ceiling height or grid layout
                   changed, room boundaries moved.
        - medium — likely to matter but needs confirming: tags or labels changed,
                   dimensions revised, a symbol added or removed.
        - low    — drafting or presentation only: revision clouds, hatching,
                   linework tidied, text nudged, north points, notes reformatted.

        ## Confidence
        0 to 1, and be honest. Small crops of dense drawings are often genuinely
        ambiguous. Below 0.4 means "I can see something differs but not what".
        PROMPT;
    }

    /**
     * @return array<string, Type>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'element' => $schema->string()
                ->description('What changed, in drawing vocabulary: "partition wall", "door", "ceiling grid", "dimension", "room tag", "revision cloud", or "unclear".')
                ->required(),

            'description' => $schema->string()
                ->description('What changed, in 20 words or fewer. A scannable line, not a sentence of prose.')
                ->required(),

            'trade_impact' => $schema->array()
                ->description('Trades whose scope or quantity is affected. Empty when the change is drafting-only.')
                ->items($schema->string()->enum(['walls', 'ceilings', 'other']))
                ->required(),

            'significance' => $schema->string()
                ->description('high = changes what gets built; medium = needs confirming; low = drafting only.')
                ->enum(['high', 'medium', 'low'])
                ->required(),

            'confidence' => $schema->number()
                ->description('0 to 1. Below 0.4 means the difference is visible but not identifiable.')
                ->required(),
        ];
    }
}
