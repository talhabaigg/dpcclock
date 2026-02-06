<?php

namespace App\Services;

use App\Jobs\SyncPremierPoLinesJob;
use App\Models\Location;
use App\Models\PremierPoLine;
use App\Models\Requisition;
use App\Models\Supplier;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class POComparisonReportService
{
    protected POComparisonService $comparisonService;

    public function __construct()
    {
        $this->comparisonService = new POComparisonService;
    }

    /**
     * Get sync status for requisitions - which have cached data and which need syncing
     */
    public function getSyncStatus(array $filters = []): array
    {
        $query = Requisition::whereNotNull('premier_po_id')
            ->whereNotNull('po_number');

        // Apply same filters as getReportData
        if (! empty($filters['location_id'])) {
            $query->where('project_number', $filters['location_id']);
        }

        if (! empty($filters['supplier_id'])) {
            $query->where('supplier_number', $filters['supplier_id']);
        }

        if (! empty($filters['date_from'])) {
            $query->whereDate('created_at', '>=', $filters['date_from']);
        }

        if (! empty($filters['date_to'])) {
            $query->whereDate('created_at', '<=', $filters['date_to']);
        }

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['po_number'])) {
            $query->where('po_number', 'like', '%'.$filters['po_number'].'%');
        }

        $requisitions = $query->orderByDesc('created_at')->get();

        $cached = 0;
        $stale = 0;
        $missing = 0;
        $staleMinutes = (int) ($filters['stale_minutes'] ?? 60);

        foreach ($requisitions as $requisition) {
            $hasCachedData = PremierPoLine::where('premier_po_id', $requisition->premier_po_id)->exists();

            if (! $hasCachedData) {
                $missing++;
            } elseif (PremierPoLine::isStale($requisition->premier_po_id, $staleMinutes)) {
                $stale++;
            } else {
                $cached++;
            }
        }

        return [
            'total' => $requisitions->count(),
            'cached' => $cached,
            'stale' => $stale,
            'missing' => $missing,
            'needs_sync' => $stale + $missing,
            'ready_percent' => $requisitions->count() > 0
                ? round(($cached / $requisitions->count()) * 100, 1)
                : 100,
        ];
    }

    /**
     * Queue sync jobs for requisitions that need Premier data
     */
    public function queueSyncJobs(array $filters = [], int $staleMinutes = 60): array
    {
        $query = Requisition::whereNotNull('premier_po_id')
            ->whereNotNull('po_number');

        // Apply same filters as getReportData
        if (! empty($filters['location_id'])) {
            $query->where('project_number', $filters['location_id']);
        }

        if (! empty($filters['supplier_id'])) {
            $query->where('supplier_number', $filters['supplier_id']);
        }

        if (! empty($filters['date_from'])) {
            $query->whereDate('created_at', '>=', $filters['date_from']);
        }

        if (! empty($filters['date_to'])) {
            $query->whereDate('created_at', '<=', $filters['date_to']);
        }

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['po_number'])) {
            $query->where('po_number', 'like', '%'.$filters['po_number'].'%');
        }

        $requisitions = $query->orderByDesc('created_at')->get();

        $queued = 0;
        $skipped = 0;
        $poIdsToSync = [];

        foreach ($requisitions as $requisition) {
            // Check if data is missing or stale
            $hasCachedData = PremierPoLine::where('premier_po_id', $requisition->premier_po_id)->exists();
            $needsSync = ! $hasCachedData || PremierPoLine::isStale($requisition->premier_po_id, $staleMinutes);

            if ($needsSync) {
                SyncPremierPoLinesJob::dispatch($requisition->premier_po_id, $requisition->id);
                $poIdsToSync[] = $requisition->premier_po_id;
                $queued++;
            } else {
                $skipped++;
            }
        }

        // Store sync context so progress broadcasts only count filtered POs
        if ($queued > 0) {
            Cache::put('premier_sync_context', [
                'po_ids' => $poIdsToSync,
                'total' => $queued,
                'started_at' => now()->toIso8601String(),
            ], now()->addHours(1));
        }

        return [
            'queued' => $queued,
            'skipped' => $skipped,
            'total' => $requisitions->count(),
        ];
    }

    /**
     * Get filtered requisitions with comparison data for the report
     */
    public function getReportData(array $filters = []): array
    {
        $query = Requisition::with(['supplier', 'location', 'lineItems', 'creator'])
            ->whereNotNull('premier_po_id')
            ->whereNotNull('po_number');

        // Apply filters
        if (! empty($filters['location_id'])) {
            $query->where('project_number', $filters['location_id']);
        }

        if (! empty($filters['supplier_id'])) {
            $query->where('supplier_number', $filters['supplier_id']);
        }

        if (! empty($filters['date_from'])) {
            $query->whereDate('created_at', '>=', $filters['date_from']);
        }

        if (! empty($filters['date_to'])) {
            $query->whereDate('created_at', '<=', $filters['date_to']);
        }

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['po_number'])) {
            $query->where('po_number', 'like', '%'.$filters['po_number'].'%');
        }

        // Get all matching requisitions - data is cached so no API timeout concerns
        $requisitions = $query->orderByDesc('created_at')->get();

        // Collect comparison data for each requisition
        $reportItems = [];
        $aggregateStats = [
            'total_pos' => 0,
            'pos_with_variances' => 0,
            'total_original_value' => 0,
            'total_premier_value' => 0,
            'total_invoiced_value' => 0,
            'total_variance' => 0,
            'items_added' => 0,
            'items_removed' => 0,
            'items_modified' => 0,
            'items_unchanged' => 0,
            'unit_cost_increases' => 0,
            'unit_cost_decreases' => 0,
            'quantity_increases' => 0,
            'quantity_decreases' => 0,
            'price_list_violations' => 0,
            'price_list_violation_value' => 0,
        ];

        // Track price list violations separately for detailed reporting
        $priceListViolations = [];

        foreach ($requisitions as $requisition) {
            try {
                $comparison = $this->comparisonService->compare($requisition);

                $hasVariance = $comparison['summary']['has_discrepancies'] ?? false;
                $localTotal = $comparison['local_total'] ?? 0;
                $premierTotal = $comparison['premier_total'] ?? 0;
                $invoiceTotal = $comparison['invoice_total'] ?? 0;
                $variance = $premierTotal - $localTotal;

                // Filter by variance threshold if specified
                if (! empty($filters['min_variance'])) {
                    if (abs($variance) < floatval($filters['min_variance'])) {
                        continue;
                    }
                }

                // Filter by only discrepancies
                if (! empty($filters['only_discrepancies']) && ! $hasVariance) {
                    continue;
                }

                $aggregateStats['total_pos']++;
                $aggregateStats['total_original_value'] += $localTotal;
                $aggregateStats['total_premier_value'] += $premierTotal;
                $aggregateStats['total_invoiced_value'] += $invoiceTotal;
                $aggregateStats['total_variance'] += $variance;

                if ($hasVariance) {
                    $aggregateStats['pos_with_variances']++;
                }

                // Count item-level changes and track price list violations
                $poViolations = [];
                foreach ($comparison['comparison'] as $item) {
                    $status = $item['status'] ?? 'unchanged';
                    $aggregateStats["items_{$status}"]++;

                    // Check for price list violations - items with a PROJECT price list that have price changes
                    // Note: 'base_price' is standard pricing, not a contracted project price
                    $priceList = $item['local']['price_list'] ?? null;
                    $hasProjectPriceList = ! empty($priceList) && strtolower(trim($priceList)) !== 'base_price';
                    $hasUnitCostChange = isset($item['variances']['unit_cost']['difference'])
                        && abs($item['variances']['unit_cost']['difference']) > 0.001;

                    if ($hasProjectPriceList && $hasUnitCostChange) {
                        $aggregateStats['price_list_violations']++;
                        $violationValue = abs($item['variances']['total_cost']['difference'] ?? 0);
                        $aggregateStats['price_list_violation_value'] += $violationValue;

                        $poViolations[] = [
                            'description' => $item['local']['description'] ?? 'Unknown',
                            'price_list' => $item['local']['price_list'],
                            'original_unit_cost' => $item['local']['unit_cost'] ?? 0,
                            'current_unit_cost' => $item['premier']['unit_cost'] ?? 0,
                            'difference' => $item['variances']['unit_cost']['difference'] ?? 0,
                            'total_impact' => $violationValue,
                        ];
                    }

                    if ($status === 'modified' && isset($item['variances'])) {
                        // Track unit cost changes
                        if (isset($item['variances']['unit_cost']['difference'])) {
                            $diff = $item['variances']['unit_cost']['difference'];
                            if ($diff > 0) {
                                $aggregateStats['unit_cost_increases']++;
                            } elseif ($diff < 0) {
                                $aggregateStats['unit_cost_decreases']++;
                            }
                        }

                        // Track quantity changes
                        if (isset($item['variances']['qty']['difference'])) {
                            $diff = $item['variances']['qty']['difference'];
                            if ($diff > 0) {
                                $aggregateStats['quantity_increases']++;
                            } elseif ($diff < 0) {
                                $aggregateStats['quantity_decreases']++;
                            }
                        }
                    }
                }

                // Add violations to the global list
                if (! empty($poViolations)) {
                    $priceListViolations[] = [
                        'po_number' => $requisition->po_number,
                        'supplier' => $requisition->supplier?->name,
                        'location' => $requisition->location?->name,
                        'violations' => $poViolations,
                    ];
                }

                $reportItems[] = [
                    'requisition' => [
                        'id' => $requisition->id,
                        'po_number' => $requisition->po_number,
                        'created_at' => $requisition->created_at->toIso8601String(),
                        'date_required' => $requisition->date_required,
                        'status' => $requisition->status,
                        'requested_by' => $requisition->requested_by,
                        'order_reference' => $requisition->order_reference,
                    ],
                    'location' => [
                        'id' => $requisition->location?->id,
                        'name' => $requisition->location?->name,
                        'external_id' => $requisition->location?->external_id,
                    ],
                    'supplier' => [
                        'id' => $requisition->supplier?->id,
                        'name' => $requisition->supplier?->name,
                        'code' => $requisition->supplier?->code,
                    ],
                    'totals' => [
                        'original' => $localTotal,
                        'premier' => $premierTotal,
                        'invoiced' => $invoiceTotal,
                        'variance' => $variance,
                        'variance_percent' => $localTotal > 0 ? (($variance / $localTotal) * 100) : 0,
                        'remaining' => $premierTotal - $invoiceTotal,
                    ],
                    'summary' => $comparison['summary'],
                    'comparison' => $comparison['comparison'],
                    'invoices' => $comparison['invoices'] ?? null,
                ];
            } catch (\Exception $e) {
                Log::warning('Failed to get comparison for requisition', [
                    'requisition_id' => $requisition->id,
                    'error' => $e->getMessage(),
                ]);

                continue;
            }
        }

        // Calculate percentage stats
        $aggregateStats['variance_percent'] = $aggregateStats['total_original_value'] > 0
            ? (($aggregateStats['total_variance'] / $aggregateStats['total_original_value']) * 100)
            : 0;

        return [
            'items' => $reportItems,
            'aggregate' => $aggregateStats,
            'price_list_violations' => $priceListViolations,
            'filters_applied' => $filters,
            'generated_at' => now()->toIso8601String(),
        ];
    }

    /**
     * Get filter options for the report UI
     */
    public function getFilterOptions(): array
    {
        // Get locations with POs
        $locations = Location::whereHas('requisitions', function ($query) {
            $query->whereNotNull('premier_po_id');
        })
            ->select('id', 'name', 'external_id')
            ->orderBy('name')
            ->get();

        // Get suppliers with POs
        $suppliers = Supplier::whereHas('requisitions', function ($query) {
            $query->whereNotNull('premier_po_id');
        })
            ->select('id', 'name', 'code')
            ->orderBy('name')
            ->get();

        // Get available statuses
        $statuses = Requisition::whereNotNull('premier_po_id')
            ->select('status')
            ->distinct()
            ->pluck('status');

        return [
            'locations' => $locations,
            'suppliers' => $suppliers,
            'statuses' => $statuses,
        ];
    }

    /**
     * Prepare data for AI analysis
     */
    public function prepareDataForAI(array $reportData): array
    {
        $items = $reportData['items'];
        $aggregate = $reportData['aggregate'];

        // Summarize for AI consumption
        $summary = [
            'overview' => [
                'total_purchase_orders' => $aggregate['total_pos'],
                'pos_with_discrepancies' => $aggregate['pos_with_variances'],
                'discrepancy_rate' => $aggregate['total_pos'] > 0
                    ? round(($aggregate['pos_with_variances'] / $aggregate['total_pos']) * 100, 1)
                    : 0,
            ],
            'financial_summary' => [
                'total_original_value' => round($aggregate['total_original_value'], 2),
                'total_premier_value' => round($aggregate['total_premier_value'], 2),
                'total_invoiced_value' => round($aggregate['total_invoiced_value'], 2),
                'net_variance' => round($aggregate['total_variance'], 2),
                'variance_percentage' => round($aggregate['variance_percent'], 2),
            ],
            'line_item_changes' => [
                'items_unchanged' => $aggregate['items_unchanged'],
                'items_modified' => $aggregate['items_modified'],
                'items_added_in_premier' => $aggregate['items_added'],
                'items_removed_from_premier' => $aggregate['items_removed'],
            ],
            'price_trends' => [
                'unit_cost_increases' => $aggregate['unit_cost_increases'],
                'unit_cost_decreases' => $aggregate['unit_cost_decreases'],
                'quantity_increases' => $aggregate['quantity_increases'],
                'quantity_decreases' => $aggregate['quantity_decreases'],
            ],
            'price_list_compliance' => [
                'violations_count' => $aggregate['price_list_violations'] ?? 0,
                'violation_total_value' => round($aggregate['price_list_violation_value'] ?? 0, 2),
                'is_critical' => ($aggregate['price_list_violations'] ?? 0) > 0,
            ],
        ];

        // Variance distribution - categorize POs by variance size
        $varianceDistribution = [
            'no_variance' => 0,
            'minor_under_100' => 0,
            'small_100_to_500' => 0,
            'medium_500_to_1000' => 0,
            'large_1000_to_5000' => 0,
            'major_over_5000' => 0,
        ];
        foreach ($items as $item) {
            $absVariance = abs($item['totals']['variance']);
            if ($absVariance < 1) {
                $varianceDistribution['no_variance']++;
            } elseif ($absVariance < 100) {
                $varianceDistribution['minor_under_100']++;
            } elseif ($absVariance < 500) {
                $varianceDistribution['small_100_to_500']++;
            } elseif ($absVariance < 1000) {
                $varianceDistribution['medium_500_to_1000']++;
            } elseif ($absVariance < 5000) {
                $varianceDistribution['large_1000_to_5000']++;
            } else {
                $varianceDistribution['major_over_5000']++;
            }
        }
        $summary['variance_distribution'] = $varianceDistribution;

        // Time trends - variance by month
        $monthlyTrends = [];
        foreach ($items as $item) {
            $month = date('Y-m', strtotime($item['requisition']['created_at']));
            if (! isset($monthlyTrends[$month])) {
                $monthlyTrends[$month] = [
                    'po_count' => 0,
                    'total_variance' => 0,
                    'total_original' => 0,
                    'pos_with_variance' => 0,
                ];
            }
            $monthlyTrends[$month]['po_count']++;
            $monthlyTrends[$month]['total_variance'] += $item['totals']['variance'];
            $monthlyTrends[$month]['total_original'] += $item['totals']['original'];
            if (abs($item['totals']['variance']) > 1) {
                $monthlyTrends[$month]['pos_with_variance']++;
            }
        }
        // Calculate variance percentages and sort by month
        foreach ($monthlyTrends as $month => &$data) {
            $data['variance_percent'] = $data['total_original'] > 0
                ? round(($data['total_variance'] / $data['total_original']) * 100, 2)
                : 0;
            $data['discrepancy_rate'] = $data['po_count'] > 0
                ? round(($data['pos_with_variance'] / $data['po_count']) * 100, 1)
                : 0;
        }
        unset($data);
        ksort($monthlyTrends);
        $summary['monthly_trends'] = $monthlyTrends;

        // Get top variances by supplier
        $supplierVariances = [];
        foreach ($items as $item) {
            $supplierName = $item['supplier']['name'] ?? 'Unknown';
            if (! isset($supplierVariances[$supplierName])) {
                $supplierVariances[$supplierName] = [
                    'total_variance' => 0,
                    'po_count' => 0,
                    'total_original' => 0,
                ];
            }
            $supplierVariances[$supplierName]['total_variance'] += $item['totals']['variance'];
            $supplierVariances[$supplierName]['po_count']++;
            $supplierVariances[$supplierName]['total_original'] += $item['totals']['original'];
        }

        // Calculate variance percentages and sort
        foreach ($supplierVariances as $name => &$data) {
            $data['variance_percent'] = $data['total_original'] > 0
                ? round(($data['total_variance'] / $data['total_original']) * 100, 2)
                : 0;
        }
        unset($data);

        uasort($supplierVariances, fn ($a, $b) => abs($b['total_variance']) <=> abs($a['total_variance']));
        $summary['top_suppliers_by_variance'] = array_slice($supplierVariances, 0, 10, true);

        // Get top variances by location
        $locationVariances = [];
        foreach ($items as $item) {
            $locationName = $item['location']['name'] ?? 'Unknown';
            if (! isset($locationVariances[$locationName])) {
                $locationVariances[$locationName] = [
                    'total_variance' => 0,
                    'po_count' => 0,
                    'total_original' => 0,
                ];
            }
            $locationVariances[$locationName]['total_variance'] += $item['totals']['variance'];
            $locationVariances[$locationName]['po_count']++;
            $locationVariances[$locationName]['total_original'] += $item['totals']['original'];
        }

        foreach ($locationVariances as $name => &$data) {
            $data['variance_percent'] = $data['total_original'] > 0
                ? round(($data['total_variance'] / $data['total_original']) * 100, 2)
                : 0;
        }
        unset($data);

        uasort($locationVariances, fn ($a, $b) => abs($b['total_variance']) <=> abs($a['total_variance']));
        $summary['top_locations_by_variance'] = array_slice($locationVariances, 0, 10, true);

        // Get significant individual PO discrepancies (increased to 25, lowered threshold to $100)
        $significantPOs = array_filter($items, fn ($item) => abs($item['totals']['variance']) > 100);
        usort($significantPOs, fn ($a, $b) => abs($b['totals']['variance']) <=> abs($a['totals']['variance']));
        $significantPOs = array_slice($significantPOs, 0, 25);

        $summary['significant_po_discrepancies'] = array_map(fn ($po) => [
            'po_number' => $po['requisition']['po_number'],
            'supplier' => $po['supplier']['name'],
            'location' => $po['location']['name'],
            'created_at' => $po['requisition']['created_at'],
            'original_value' => $po['totals']['original'],
            'current_value' => $po['totals']['premier'],
            'variance' => $po['totals']['variance'],
            'variance_percent' => $po['totals']['variance_percent'],
            'items_added' => $po['summary']['added_count'],
            'items_removed' => $po['summary']['removed_count'],
            'items_modified' => $po['summary']['modified_count'],
        ], $significantPOs);

        return $summary;
    }
}
