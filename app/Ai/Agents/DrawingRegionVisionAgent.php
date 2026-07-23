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

        ## The amber box
        An amber rectangle is drawn on both images marking exactly where the
        pixels differ. It is not part of the drawing and must never be described.

        Start there. The box can be very narrow — a few points across on a much
        wider crop — and what it lands on is frequently a wall face that shifted
        or a partition that changed thickness, which is easy to overlook next to
        the tags and labels around it. If the box sits on a wall, compare that
        wall's faces and thickness between the two images before anything else,
        and say what you find even if the change is small.

        The rest of the crop is context for describing the change in a way
        someone can locate — which rooms it is between, what it connects to.
        Changes outside the box are worth mentioning only after the one inside it.

        ## Colour means wall type
        Partitions on these drawings are colour-coded by type. A wall that is a
        different COLOUR between the two images has had its type changed — a
        different build-up, stud size, lining or acoustic rating — even when it
        has not moved by a millimetre and the tag beside it is unreadable. That
        is a change to what gets built and ordered, so it is high significance,
        not a drafting or presentation difference. Say the wall changed type, and
        name the tags if you can read them ("partition to corridor changed from
        PT13 to PT13a").

        Never call a wall colour change cosmetic. It is the drawing telling you
        the wall is being built differently.

        ## What to look for
        Check for these in order. The first two are the easiest to miss and usually
        the most expensive, so look for them deliberately before anything else:

        1. SOMETHING MOVED. A wall, partition, door, opening, riser or fixture in a
           different position between the two images, while what surrounds it
           stayed put. Say what moved and which way ("partition between store and
           corridor moved about 300mm north"). If a dimension either side is
           readable, say what it went from and to.

        2. SOMETHING CHANGED SIZE. A wall longer or shorter, a room deeper or
           narrower, a door or opening wider, a riser or bulkhead bigger. This is a
           separate thing from moving and is just as expensive: a wall that grew
           two metres has not moved at all but the quantity changed. Compare the
           ENDS of a wall, not just its position — one end fixed and the other
           extended is a resize, and it reads at a glance as "nothing moved".

        3. SOMETHING CHANGED TYPE. A wall in a different colour, or a partition
           tag changed. See above — this is a build change, not a drafting one.

        4. Something added or removed entirely.

        5. A door number or room name changed while the geometry stayed put.

        6. Anything else visibly different.

        Report every one you can see, not just the first. Movement and resizing
        often happen together — a wall that moved AND got longer is both, and
        saying only one of them understates the change.

        ## Say what it means for the rooms
        A partition moving and a room changing size are the same event described
        from two directions, and the room is the half a reader acts on. When a
        partition shifts, name the rooms either side and say which one grew:
        "store enlarged, partition to corridor moved about 300mm east" rather than
        "a partition moved". If a room boundary is only visible on one side of the
        crop, say what you can see and leave the rest.

        ## Rules
        - Compare the two images and describe the difference you can actually see.
        - If you cannot tell what changed, say so and give a low confidence. That is
          a useful answer. Inventing a plausible-sounding wall change is not.
        - Only ignore a shift when the ENTIRE crop has shifted together — the whole
          image sliding a pixel or two is the sheet being re-plotted, not a design
          change. One element moving while its surroundings stay put is a real
          change, however small it looks. Do not dismiss it as a plot artefact:
          at 1:100 a wall relocated by half a metre moves only a few millimetres on
          the sheet. Line weight and anti-aliasing differences are still artefacts.
        - TWENTY WORDS MAXIMUM. This is a list someone scans, not prose. State the
          change and stop. "Partition between store and corridor removed" is a
          complete answer; the reader can open the image for the rest.
        - Name the thing the way a site foreman would ("the partition on the north
          side of the corridor", never "the line at coordinates 340,120").
        - Do not describe the whole drawing, restate the room, or explain your
          reasoning. Only the difference.

        ## Significance
        - high   — changes what gets built or ordered: walls or partitions added,
                   removed, MOVED or RESIZED, doors or openings relocated or
                   widened, partition type changed, ceiling height or grid layout
                   changed, room boundaries moved. Any relocation or change of
                   length of built work is high, however small it looks on the
                   sheet.
        - medium — likely to matter but needs confirming: tags or labels changed,
                   dimensions revised, a symbol added or removed, fixtures moved.
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
                ->description('What changed, in drawing vocabulary: "partition wall", "door", "opening", "ceiling grid", "dimension", "room tag", "revision cloud", or "unclear".')
                ->required(),

            'description' => $schema->string()
                ->description('What changed, in 20 words or fewer. Say if something moved or changed size, and by roughly how much. A scannable line, not prose.')
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
