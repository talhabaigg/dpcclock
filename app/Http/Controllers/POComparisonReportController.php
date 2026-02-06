<?php

namespace App\Http\Controllers;

use App\Services\POComparisonReportService;
use App\Services\POInsightsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class POComparisonReportController extends Controller
{
    protected POComparisonReportService $reportService;

    protected POInsightsService $insightsService;

    public function __construct()
    {
        $this->reportService = new POComparisonReportService;
        $this->insightsService = new POInsightsService;
    }

    /**
     * Display the PO Comparison Report page
     */
    public function index(Request $request)
    {
        $filterOptions = $this->reportService->getFilterOptions();

        return Inertia::render('reports/po-comparison', [
            'filterOptions' => $filterOptions,
            'initialFilters' => $request->only([
                'location_id',
                'supplier_id',
                'date_from',
                'date_to',
                'status',
                'po_number',
                'min_variance',
                'only_discrepancies',
            ]),
        ]);
    }

    /**
     * Get report data via API (for async loading)
     */
    public function getData(Request $request)
    {
        $filters = $request->validate([
            'location_id' => 'nullable|integer',
            'supplier_id' => 'nullable|integer',
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date',
            'status' => 'nullable|string',
            'po_number' => 'nullable|string',
            'min_variance' => 'nullable|numeric',
            'only_discrepancies' => 'nullable|boolean',
        ]);

        try {
            $reportData = $this->reportService->getReportData($filters);

            // Also prepare AI summary data so frontend doesn't need to re-fetch for insights
            $aiSummaryData = $this->reportService->prepareDataForAI($reportData);

            return response()->json([
                'success' => true,
                ...$reportData,
                'ai_summary_data' => $aiSummaryData,
            ]);
        } catch (\Exception $e) {
            Log::error('PO Comparison Report failed', [
                'filters' => $filters,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to generate report: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Generate AI insights for the report
     * Accepts pre-computed summary data from frontend to avoid re-fetching from Premier
     */
    public function getInsights(Request $request)
    {
        try {
            // Check if summary data was passed directly (to avoid re-fetching)
            if ($request->has('summary_data')) {
                $summaryData = $request->input('summary_data');
            } else {
                // Legacy: re-fetch if no summary data provided
                $filters = $request->validate([
                    'location_id' => 'nullable|integer',
                    'supplier_id' => 'nullable|integer',
                    'date_from' => 'nullable|date',
                    'date_to' => 'nullable|date',
                    'status' => 'nullable|string',
                    'po_number' => 'nullable|string',
                    'min_variance' => 'nullable|numeric',
                    'only_discrepancies' => 'nullable|boolean',
                ]);

                $reportData = $this->reportService->getReportData($filters);
                $summaryData = $this->reportService->prepareDataForAI($reportData);
            }

            $conversationId = $request->input('conversation_id');

            // Generate insights
            $result = $this->insightsService->generateInsights($summaryData, $conversationId);

            return response()->json($result);

        } catch (\Exception $e) {
            Log::error('PO Insights generation failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to generate insights: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Handle follow-up questions for AI insights
     */
    public function askFollowUp(Request $request)
    {
        $validated = $request->validate([
            'conversation_id' => 'required|string',
            'question' => 'required|string|max:1000',
        ]);

        try {
            $result = $this->insightsService->askFollowUp(
                $validated['conversation_id'],
                $validated['question']
            );

            return response()->json($result);

        } catch (\Exception $e) {
            Log::error('PO Insights follow-up failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to process follow-up: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Stream AI insights (SSE)
     */
    public function streamInsights(Request $request)
    {
        try {
            if (! $request->has('summary_data')) {
                return response()->json([
                    'success' => false,
                    'error' => 'Summary data is required for streaming insights',
                ], 400);
            }

            $summaryData = $request->input('summary_data');
            $streamClosure = $this->insightsService->streamInsights($summaryData);

            return response()->stream($streamClosure, 200, [
                'Content-Type' => 'text/event-stream',
                'Cache-Control' => 'no-cache, no-transform',
                'Connection' => 'keep-alive',
                'X-Accel-Buffering' => 'no',
            ]);

        } catch (\Exception $e) {
            Log::error('PO Insights streaming failed', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to stream insights: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Stream follow-up response (SSE)
     */
    public function streamFollowUp(Request $request)
    {
        $validated = $request->validate([
            'conversation_id' => 'required|string',
            'question' => 'required|string|max:1000',
        ]);

        try {
            $streamClosure = $this->insightsService->streamFollowUp(
                $validated['conversation_id'],
                $validated['question']
            );

            return response()->stream($streamClosure, 200, [
                'Content-Type' => 'text/event-stream',
                'Cache-Control' => 'no-cache, no-transform',
                'Connection' => 'keep-alive',
                'X-Accel-Buffering' => 'no',
            ]);

        } catch (\Exception $e) {
            Log::error('PO Insights follow-up streaming failed', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to stream follow-up: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Refresh insights (clear cache and regenerate)
     * Accepts pre-computed summary data from frontend to avoid re-fetching from Premier
     */
    public function refreshInsights(Request $request)
    {
        try {
            // Check if summary data was passed directly
            if ($request->has('summary_data')) {
                $summaryData = $request->input('summary_data');
            } else {
                // Legacy: re-fetch if no summary data provided
                $filters = $request->except('summary_data');
                $reportData = $this->reportService->getReportData($filters);
                $summaryData = $this->reportService->prepareDataForAI($reportData);
            }

            // Clear cache
            $this->insightsService->clearCache($summaryData);

            // Regenerate with new conversation
            $result = $this->insightsService->generateInsights($summaryData);

            return response()->json($result);

        } catch (\Exception $e) {
            Log::error('PO Insights refresh failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to refresh insights: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get sync status for Premier PO data
     */
    public function getSyncStatus(Request $request)
    {
        $filters = $request->validate([
            'location_id' => 'nullable|integer',
            'supplier_id' => 'nullable|integer',
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date',
            'status' => 'nullable|string',
            'po_number' => 'nullable|string',
            'stale_minutes' => 'nullable|integer',
            'limit' => 'nullable|integer',
        ]);

        try {
            $status = $this->reportService->getSyncStatus($filters);

            return response()->json([
                'success' => true,
                ...$status,
            ]);
        } catch (\Exception $e) {
            Log::error('Sync status check failed', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to check sync status: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Queue sync jobs for Premier PO data
     */
    public function queueSync(Request $request)
    {
        $filters = $request->validate([
            'location_id' => 'nullable|integer',
            'supplier_id' => 'nullable|integer',
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date',
            'status' => 'nullable|string',
            'po_number' => 'nullable|string',
            'stale_minutes' => 'nullable|integer',
            'limit' => 'nullable|integer',
        ]);

        try {
            $staleMinutes = (int) ($filters['stale_minutes'] ?? 60);
            $result = $this->reportService->queueSyncJobs($filters, $staleMinutes);

            return response()->json([
                'success' => true,
                'message' => "Queued {$result['queued']} sync jobs ({$result['skipped']} already up-to-date)",
                ...$result,
            ]);
        } catch (\Exception $e) {
            Log::error('Queue sync failed', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to queue sync jobs: '.$e->getMessage(),
            ], 500);
        }
    }
}
