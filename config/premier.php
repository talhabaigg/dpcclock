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

    'swagger_api' => [
        'base_url' => env('PREMIER_SWAGGER_API_URL'),
        'username' => env('PREMIER_SWAGGER_API_USERNAME'),
        'password' => env('PREMIER_SWAGGER_API_PASSWORD'),
    ],

    'endpoints' => [
        'job_cost_details' => '/JobCostDetails',
        'job_report_by_cost_item' => '/JobReportByCostItemAndCostTypes',
        'ar_progress_billing' => '/ARProgressBillingSummaries',
        'job_summaries' => '/JobSummaries',
        'ar_posted_invoices' => '/ARPostedInvoices',
        'ap_posted_invoices' => '/APPostedInvoices',
        'ap_posted_invoice_lines' => '/APPostedInvoiceLines',
        'job_vendor_commitments' => '/JobVendorsCommitments',
    ],

    'jobs' => [
        'retry_times' => env('PREMIER_JOB_RETRY_TIMES', 3),
        'retry_delay' => env('PREMIER_JOB_RETRY_DELAY', 60), // seconds
        'timeout' => env('PREMIER_JOB_TIMEOUT', 600), // 10 minutes
        'batch_size' => env('PREMIER_JOB_BATCH_SIZE', 1000),
    ],

    'web' => [
        'url' => env('PREMIER_WEB_URL'),
        'client_id' => env('PREMIER_WEB_CLIENT_ID', '324204'),
        'username' => env('PREMIER_WEB_USERNAME'),
        'password' => env('PREMIER_WEB_PASSWORD'),
        'dry_run' => env('PREMIER_AGENT_DRY_RUN', false),
    ],
];
