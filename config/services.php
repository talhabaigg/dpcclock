<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'openai' => [
        'api_key' => env('OPENAI_API_KEY'),
        // Vision model for drawing comparison - options: gpt-4o, gpt-4o-2024-11-20, gpt-4o-mini
        'vision_model' => env('OPENAI_VISION_MODEL', 'gpt-4o-2024-11-20'),
    ],

    'textract' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_TEXTRACT_REGION', env('AWS_DEFAULT_REGION', 'ap-southeast-2')),
        // Confidence thresholds for validation (0.0 to 1.0)
        // Lower thresholds work better with template-based extraction
        'confidence_number' => env('TEXTRACT_CONFIDENCE_NUMBER', 0.45),
        'confidence_title' => env('TEXTRACT_CONFIDENCE_TITLE', 0.35),
        'confidence_revision' => env('TEXTRACT_CONFIDENCE_REVISION', 0.45),
    ],

    'employment_hero' => [
        'api_key' => env('PAYROLL_API_KEY'),
        'base_url' => env('EH_BASE_URL', 'https://api.yourpayroll.com.au/api/v2'),
        'business_id' => env('EH_BUSINESS_ID', '431152'),
    ],

    'cv_comparison' => [
        'url' => env('CV_COMPARISON_SERVICE_URL', 'http://localhost:5050'),
        'timeout' => env('CV_COMPARISON_TIMEOUT', 120),
        'enabled' => env('CV_COMPARISON_ENABLED', true),
    ],

    'payroll' => [
        'api_key' => env('PAYROLL_API_KEY'),
        'business_id' => env('PAYROLL_BUSINESS_ID', '431152'),
    ],

];
