<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$loc = App\Models\Location::with('jobSummary')->whereNotNull('external_id')->first();

if ($loc && $loc->jobSummary) {
    echo "Location: {$loc->name} ({$loc->external_id})\n";
    echo "Original Revenue: {$loc->jobSummary->original_estimate_revenue}\n";
    echo "Original Cost: {$loc->jobSummary->original_estimate_cost}\n";
    echo "Current Revenue: {$loc->jobSummary->current_estimate_revenue}\n";
    echo "Current Cost: {$loc->jobSummary->current_estimate_cost}\n\n";

    // Check job_cost_details
    $costSum = DB::table('job_cost_details')
        ->where('job_number', $loc->external_id)
        ->whereNotNull('transaction_date')
        ->sum('amount');
    echo "Total Job Cost (all time): {$costSum}\n";

    // Check ar_progress_billing
    $incomeSum = DB::table('ar_progress_billing_summaries')
        ->where('job_number', $loc->external_id)
        ->where('active', 1)
        ->sum('this_app_work_completed');
    echo "Total Progress Billing (all time): {$incomeSum}\n";

    // Show a sample record
    $sample = DB::table('job_cost_details')
        ->where('job_number', $loc->external_id)
        ->first();
    if ($sample) {
        echo "\nSample job_cost_details record:\n";
        print_r($sample);
    }
}
