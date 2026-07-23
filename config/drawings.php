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
        'max_changes_for_ai' => env('DRAWING_COMPARISON_MAX_CHANGES', 160),

        // Seconds to allow for each individual model call.
        'timeout' => env('DRAWING_COMPARISON_TIMEOUT', 120),

        // Queue the analysis job runs on.
        'queue' => env('DRAWING_COMPARISON_QUEUE', 'default'),

        // Raster comparison (Phase 2) finds geometry changes the text layer
        // cannot see — a wall that moved, a door removed without its tag
        // changing. Requires ImageMagick; degrades to text-only when absent.
        'raster_enabled' => env('DRAWING_COMPARISON_RASTER', true),

        // Phase 3: read each detected geometry region by cropping it from both
        // revisions and showing the pair to a vision model. This is the only
        // step that asks a model what changed rather than to interpret an
        // already-found difference, and it is bounded to the largest regions.
        'vision_enabled' => env('DRAWING_COMPARISON_VISION', true),

        // Model used for region reads. Defaults to the main comparison model.
        'vision_model' => env('DRAWING_COMPARISON_VISION_MODEL'),

        // Largest N regions actually read. The rest keep their factual
        // "changed area" row so nothing is lost, just not described.
        'max_regions_for_vision' => env('DRAWING_COMPARISON_MAX_REGIONS', 25),

        // Explicit path to the ImageMagick binary. Leave null to discover
        // `magick` (v7) or `convert` (v6) on PATH.
        'magick_path' => env('DRAWING_COMPARISON_MAGICK_PATH'),
    ],

];
