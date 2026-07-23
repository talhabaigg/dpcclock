<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Revision Change Detection
    |--------------------------------------------------------------------------
    |
    | Settings for automatic detection of what changed between two revisions of
    | a drawing. Phase 1 compares the PDF text layer (exact, no vision model)
    | and asks an LLM only to interpret and rank the differences it found.
    |
    */

    'comparison' => [

        // Master switch. With this off the comparison endpoints still serve
        // cached results but will not start new analyses.
        'enabled' => env('DRAWING_COMPARISON_ENABLED', true),

        // Model used to interpret the diff and parse the title-block revision
        // table. Provider is resolved from the id: anything starting with
        // "claude" goes to Anthropic, everything else to OpenAI — the same
        // convention RequisitionAgentController uses.
        'model' => env('DRAWING_COMPARISON_MODEL', 'claude-opus-4-8'),

        // Hard cap on how many raw diff rows are sent for interpretation. A
        // heavily revised sheet can produce hundreds; beyond this the roll-up
        // stops getting better and only gets more expensive. Rows past the cap
        // are still stored, just without an AI description.
        'max_changes_for_ai' => env('DRAWING_COMPARISON_MAX_CHANGES', 120),

        // Seconds to allow for the interpretation call.
        'timeout' => env('DRAWING_COMPARISON_TIMEOUT', 120),

        // Queue the analysis job runs on.
        'queue' => env('DRAWING_COMPARISON_QUEUE', 'default'),
    ],

];
