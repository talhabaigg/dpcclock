<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Jonas Premier API Configuration
    |--------------------------------------------------------------------------
    |
    | This configuration file contains settings for integrating with the
    | Jonas Premier ERP system via OData API.
    |
    */

    'api' => [
        'base_url' => env('PREMIER_API_BASE_URL', 'https://reporting.jonas-premier.com/OData/ODataService.svc'),
        'username' => env('PREMIER_POWERBI_USER'),
        'password' => env('PREMIER_POWERBI_PW'),
        'timeout' => env('PREMIER_API_TIMEOUT', 300), // 5 minutes default
    ],

    'endpoints' => [
        'job_cost_details' => '/JobCostDetails',
        'job_report_by_cost_item' => '/JobReportByCostItemAndCostTypes',
        'ar_progress_billing' => '/ARProgressBillingSummaries',
    ],

    'jobs' => [
        'retry_times' => env('PREMIER_JOB_RETRY_TIMES', 3),
        'retry_delay' => env('PREMIER_JOB_RETRY_DELAY', 60), // seconds
        'timeout' => env('PREMIER_JOB_TIMEOUT', 600), // 10 minutes
        'batch_size' => env('PREMIER_JOB_BATCH_SIZE', 1000),
    ],
];
