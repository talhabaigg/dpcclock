<?php

namespace App\Services;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Log;

class TimesheetService
{
    public function deleteTimesheetInEH($timesheetId)
    {
        $apiKey = env('EH_API_KEY');

        $apiResponse = Http::withHeaders([
            'Authorization' => 'Basic '.base64_encode($apiKey.':'),
            'Accept' => 'application/json',
        ])->delete("https://api.yourpayroll.com.au/api/v2/business/431152/timesheet/{$timesheetId}");
        Log::info($apiResponse);
        // Check API response before returning anything
        if ($apiResponse->failed()) {
            Log::error('Failed to delete timesheet from EH', [
                'timesheetId' => $timesheetId,
                'status' => $apiResponse->status(),
                'body' => $apiResponse->body(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to delete timesheet in Employment Hero',
                'error' => $apiResponse->body(),
            ], $apiResponse->status());
        }

        // Success case
        return response()->json([
            'success' => true,
            'message' => 'Timesheet deleted successfully from Employment Hero',
            'status' => $apiResponse->status(),
            'response' => $apiResponse->json(),
        ]);
    }
}
