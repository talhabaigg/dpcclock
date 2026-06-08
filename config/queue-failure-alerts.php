<?php

return [
    'enabled' => filter_var(env('QUEUE_FAILURE_ALERTS_ENABLED', true), FILTER_VALIDATE_BOOLEAN),

    // Comma-separated email addresses. When empty, falls back to all users with the 'admin' role.
    'recipients' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('QUEUE_FAILURE_ALERTS_RECIPIENTS', ''))
    ))),

    // Minutes between alerts for the same job-class + exception-class combination.
    // Prevents an outage from flooding the inbox with identical failures.
    'throttle_minutes' => (int) env('QUEUE_FAILURE_ALERTS_THROTTLE_MINUTES', 30),

    // Comma-separated job-class basenames (e.g. "LoadJobSummaries,LoadApPostedInvoices") to ignore.
    'ignore_jobs' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('QUEUE_FAILURE_ALERTS_IGNORE_JOBS', ''))
    ))),

    'ai_summary' => [
        'enabled' => filter_var(env('QUEUE_FAILURE_ALERTS_AI_ENABLED', true), FILTER_VALIDATE_BOOLEAN),
        'model' => env('QUEUE_FAILURE_ALERTS_AI_MODEL', 'gpt-4.1-mini'),
        'timeout' => (int) env('QUEUE_FAILURE_ALERTS_AI_TIMEOUT', 15),
    ],

    'digest' => [
        'enabled' => filter_var(env('QUEUE_FAILURE_DIGEST_ENABLED', true), FILTER_VALIDATE_BOOLEAN),
        // 24h format, Australia/Brisbane.
        'time' => env('QUEUE_FAILURE_DIGEST_TIME', '08:00'),
    ],
];
