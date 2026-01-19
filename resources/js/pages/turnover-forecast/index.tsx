import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { shadcnTheme } from '@/themes/ag-grid-theme';
import { BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import type { ColDef, ColumnState, GetRowIdParams } from 'ag-grid-community';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, Download, FileText, Filter, MinusCircle, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TurnoverReportDialog } from './TurnoverReportDialog';

ModuleRegistry.registerModules([AllCommunityModule]);

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Turnover Forecast', href: '/turnover-forecast' }];

const STORAGE_KEY = 'turnover-forecast-excluded-jobs';
const GRID_HEIGHTS_KEY = 'turnover-forecast-grid-heights';
const GRID_COLUMN_STATE_KEY = 'turnover-forecast-grid-column-state';

type MonthlyData = {
    [month: string]: number;
};

type TurnoverRow = {
    id: number;
    type: 'location' | 'forecast_project';
    job_name: string;
    job_number: string;
    // Forecast status fields
    forecast_status: 'not_started' | 'draft' | 'submitted';
    last_submitted_at: string | null;
    // Revenue fields
    claimed_to_date: number;
    revenue_contract_fy: number;
    total_contract_value: number;
    remaining_revenue_value_fy: number;
    remaining_order_book: number;
    // Cost fields
    cost_to_date: number;
    cost_contract_fy: number;
    budget: number;
    remaining_cost_value_fy: number;
    remaining_budget: number;
    // Monthly data
    revenue_actuals: MonthlyData;
    revenue_forecast: MonthlyData;
    cost_actuals: MonthlyData;
    cost_forecast: MonthlyData;
};

type TurnoverForecastProps = {
    data: TurnoverRow[];
    months: string[];
    earliestMonth: string | null;
    lastActualMonth: string | null;
    latestForecastMonth: string | null;
    fyStartDate: string;
    fyEndDate: string;
    fyLabel: string;
    monthlyTargets: Record<string, number>;
};

const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '';
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

const formatPercent = (value: number, total: number): string => {
    if (!total || total <= 0) return '0.0';
    return ((value / total) * 100).toFixed(1);
};

const safeNumber = (value: number | null | undefined): number => {
    if (value === null || value === undefined || Number.isNaN(value)) return 0;
    return Number(value);
};

const formatMonthHeader = (month: string): string => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
    return date.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' });
};

export default function TurnoverForecastIndex({
    data,
    months,
    lastActualMonth,
    fyLabel,
    monthlyTargets,
}: TurnoverForecastProps) {
    const revenueGridRef = useRef<AgGridReact>(null);
    const costGridRef = useRef<AgGridReact>(null);
    const [gridsReady, setGridsReady] = useState({ revenue: false, cost: false });

    // Load excluded jobs from local storage
    const [excludedJobIds, setExcludedJobIds] = useState<Set<string>>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? new Set(JSON.parse(stored)) : new Set();
        } catch {
            return new Set();
        }
    });

    const [filterDialogOpen, setFilterDialogOpen] = useState(false);
    const [reportDialogOpen, setReportDialogOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'both' | 'revenue' | 'cost'>('both');
    const [gridHeights, setGridHeights] = useState(() => {
        try {
            const stored = localStorage.getItem(GRID_HEIGHTS_KEY);
            const parsed = stored ? JSON.parse(stored) : null;
            return {
                revenue: typeof parsed?.revenue === 'number' ? parsed.revenue : 150,
                cost: typeof parsed?.cost === 'number' ? parsed.cost : 150,
            };
        } catch {
            return { revenue: 150, cost: 150 };
        }
    });

    const MIN_GRID_HEIGHT = 120;
    const MAX_GRID_HEIGHT = 600;

    const handleGridResizeStart = (grid: 'revenue' | 'cost') => (e: React.MouseEvent) => {
        e.preventDefault();
        const startY = e.clientY;
        const startHeight = gridHeights[grid];

        const handleDrag = (moveEvent: MouseEvent) => {
            const deltaY = moveEvent.clientY - startY;
            const nextHeight = Math.min(MAX_GRID_HEIGHT, Math.max(MIN_GRID_HEIGHT, startHeight + deltaY));
            setGridHeights((prev) => (prev[grid] === nextHeight ? prev : { ...prev, [grid]: nextHeight }));
        };

        const handleDragEnd = () => {
            document.removeEventListener('mousemove', handleDrag);
            document.removeEventListener('mouseup', handleDragEnd);
        };

        document.addEventListener('mousemove', handleDrag);
        document.addEventListener('mouseup', handleDragEnd);
    };

    // Column state persistence handlers
    const saveColumnState = useCallback((gridType: 'revenue' | 'target') => {
        const gridRef = gridType === 'revenue' ? revenueGridRef : costGridRef;
        const key = `${GRID_COLUMN_STATE_KEY}-${gridType}`;
        try {
            const state = gridRef.current?.api?.getColumnState();
            if (state) {
                localStorage.setItem(key, JSON.stringify(state));
            }
        } catch {
            // Ignore storage errors
        }
    }, []);

    const restoreColumnState = useCallback((gridType: 'revenue' | 'target') => {
        const gridRef = gridType === 'revenue' ? revenueGridRef : costGridRef;
        const key = `${GRID_COLUMN_STATE_KEY}-${gridType}`;
        try {
            localStorage.removeItem(key);
            // Temporarily disable aligned grids to prevent syncing reset to the other grid
            gridRef.current?.api?.setGridOption('alignedGrids', []);
            gridRef.current?.api?.resetColumnState();
            // Re-enable aligned grids
            if (revenueGridRef.current?.api && costGridRef.current?.api) {
                revenueGridRef.current.api.setGridOption('alignedGrids', [costGridRef.current.api]);
                costGridRef.current.api.setGridOption('alignedGrids', [revenueGridRef.current.api]);
            }
        } catch {
            // Ignore storage errors
        }
    }, []);

    const applyStoredColumnState = useCallback((gridType: 'revenue' | 'target') => {
        const gridRef = gridType === 'revenue' ? revenueGridRef : costGridRef;
        const key = `${GRID_COLUMN_STATE_KEY}-${gridType}`;
        try {
            const stored = localStorage.getItem(key);
            if (stored) {
                const state = JSON.parse(stored) as ColumnState[];
                gridRef.current?.api?.applyColumnState({ state, applyOrder: true });
            }
        } catch {
            // Ignore storage errors
        }
    }, []);

    // Financial Year filter - generate available FYs based on data
    const availableFYs = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        const currentFY = currentMonth >= 7 ? currentYear : currentYear - 1;

        // Generate FY options from 5 years ago to 5 years ahead
        const fys = [{ value: 'all', label: 'All Time' }];
        for (let year = currentFY - 5; year <= currentFY + 5; year++) {
            fys.push({
                value: year.toString(),
                label: `FY${year}-${String(year + 1).slice(2)}`,
            });
        }
        return fys;
    }, []);

    const [selectedFY, setSelectedFY] = useState<string>(() => {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        return currentMonth >= 7 ? currentYear.toString() : (currentYear - 1).toString();
    });

    // Navigation handlers for FY arrows (unlimited navigation)
    const goToPreviousFY = () => {
        if (selectedFY === 'all') return;
        const currentFYYear = parseInt(selectedFY);
        setSelectedFY((currentFYYear - 1).toString());
    };

    const goToNextFY = () => {
        if (selectedFY === 'all') return;
        const currentFYYear = parseInt(selectedFY);
        setSelectedFY((currentFYYear + 1).toString());
    };

    // Filter months based on selected FY
    const filteredMonths = useMemo(() => {
        if (selectedFY === 'all') {
            return months;
        }
        const fyYear = parseInt(selectedFY);
        const fyStart = `${fyYear}-07`;
        const fyEnd = `${fyYear + 1}-06`;
        return months.filter((month) => month >= fyStart && month <= fyEnd);
    }, [months, selectedFY]);

    // Save excluded jobs to local storage whenever it changes
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(excludedJobIds)));
    }, [excludedJobIds]);

    useEffect(() => {
        localStorage.setItem(GRID_HEIGHTS_KEY, JSON.stringify(gridHeights));
    }, [gridHeights]);

    // Sync grid alignment when both grids are ready
    useEffect(() => {
        if (gridsReady.revenue && gridsReady.cost) {
            if (revenueGridRef.current?.api && costGridRef.current?.api) {
                revenueGridRef.current.api.setGridOption('alignedGrids', [costGridRef.current.api]);
                costGridRef.current.api.setGridOption('alignedGrids', [revenueGridRef.current.api]);
            }
        }
    }, [gridsReady]);

    // Filter data based on excluded jobs
    const filteredData = useMemo(() => {
        return data.filter((row) => !excludedJobIds.has(`${row.type}-${row.id}`));
    }, [data, excludedJobIds]);

    const toggleJobExclusion = (row: TurnoverRow) => {
        const key = `${row.type}-${row.id}`;
        setExcludedJobIds((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    // Calculate revenue total row data
    const revenueTotalRowData = useMemo(() => {
        const totalRow: any = {
            id: 'revenue-total-row',
            type: '',
            job_name: '',
            job_number: 'Total',
            claimed_to_date: 0,
            revenue_contract_fy: 0,
            total_contract_value: 0,
            remaining_revenue_value_fy: 0,
            remaining_order_book: 0,
        };

        const labourRow: any = {
            id: 'labour-requirement-row',
            type: '',
            job_name: '',
            job_number: 'Labour Req',
            claimed_to_date: null,
            revenue_contract_fy: null,
            total_contract_value: null,
            remaining_revenue_value_fy: null,
            remaining_order_book: null,
        };

        // Calculate totals for each month
        filteredMonths.forEach((month) => {
            let totalRevenue = 0;

            filteredData.forEach((row) => {
                const actualRevenue = safeNumber(row.revenue_actuals?.[month]);
                const forecastRevenue = safeNumber(row.revenue_forecast?.[month]);
                const revenue = actualRevenue || forecastRevenue;
                totalRevenue += revenue;
            });

            totalRow[`month_${month}`] = safeNumber(totalRevenue);
            // Labour requirement = total revenue / $26,000 per worker
            labourRow[`month_${month}`] = totalRevenue / 26000;
        });

        // Calculate summary fields
        filteredData.forEach((row) => {
            totalRow.claimed_to_date += row.claimed_to_date || 0;
            totalRow.revenue_contract_fy += row.revenue_contract_fy || 0;
            totalRow.total_contract_value += row.total_contract_value || 0;
            totalRow.remaining_revenue_value_fy += row.remaining_revenue_value_fy || 0;
            totalRow.remaining_order_book += row.remaining_order_book || 0;
        });

        return [totalRow, labourRow];
    }, [filteredData, filteredMonths]);

    // Calculate cost total row data (computed for future use)
    void useMemo(() => {
        const totalRow: any = {
            id: 'cost-total-row',
            type: 'Total',

            job_number: '',
            cost_to_date: 0,
            cost_contract_fy: 0,
            budget: 0,
            remaining_cost_value_fy: 0,
            remaining_budget: 0,
        };

        // Calculate totals for each month
        filteredMonths.forEach((month) => {
            let totalCost = 0;

            filteredData.forEach((row) => {
                const actualCost = Number(row.cost_actuals?.[month]) || 0;
                const forecastCost = Number(row.cost_forecast?.[month]) || 0;
                const cost = actualCost || forecastCost;
                totalCost += cost;
            });

            totalRow[`month_${month}`] = totalCost;
        });

        // Calculate summary fields
        filteredData.forEach((row) => {
            totalRow.cost_to_date += row.cost_to_date || 0;
            totalRow.cost_contract_fy += row.cost_contract_fy || 0;
            totalRow.budget += row.budget || 0;
            totalRow.remaining_cost_value_fy += row.remaining_cost_value_fy || 0;
            totalRow.remaining_budget += row.remaining_budget || 0;
        });

        return [totalRow];
    }, [filteredData, filteredMonths]);

    // Calculate profit pinned row data (computed for future use)
    void useMemo(() => {
        const profitRow: any = {
            id: 'profit-row',
            type: 'Profit',
            // job_name: 'PROFIT',
            job_number: '',
            claimed_to_date: 0,
            revenue_contract_fy: 0,
            total_contract_value: 0,
            remaining_revenue_value_fy: 0,
            remaining_order_book: 0,
            cost_to_date: 0,
            cost_contract_fy: 0,
            budget: 0,
            remaining_cost_value_fy: 0,
            remaining_budget: 0,
        };

        // Calculate profit for each month
        filteredMonths.forEach((month) => {
            let totalRevenue = 0;
            let totalCost = 0;

            filteredData.forEach((row) => {
                const actualRevenue = Number(row.revenue_actuals?.[month]) || 0;
                const forecastRevenue = Number(row.revenue_forecast?.[month]) || 0;
                const revenue = actualRevenue || forecastRevenue;

                const actualCost = Number(row.cost_actuals?.[month]) || 0;
                const forecastCost = Number(row.cost_forecast?.[month]) || 0;
                const cost = actualCost || forecastCost;

                totalRevenue += revenue;
                totalCost += cost;
            });

            profitRow[`month_${month}`] = totalRevenue - totalCost;
        });

        // Calculate summary fields
        filteredData.forEach((row) => {
            profitRow.claimed_to_date += row.claimed_to_date || 0;
            profitRow.cost_to_date += row.cost_to_date || 0;
            profitRow.revenue_contract_fy += row.revenue_contract_fy || 0;
            profitRow.cost_contract_fy += row.cost_contract_fy || 0;
            profitRow.total_contract_value += row.total_contract_value || 0;
            profitRow.budget += row.budget || 0;
        });

        // Profit summaries
        profitRow.profit_to_date = profitRow.claimed_to_date - profitRow.cost_to_date;
        profitRow.profit_contract_fy = profitRow.revenue_contract_fy - profitRow.cost_contract_fy;
        profitRow.profit_total = profitRow.total_contract_value - profitRow.budget;

        return [profitRow];
    }, [filteredData, filteredMonths]);

    const targetRowData = useMemo(() => {
        const targetRow: any = {
            id: 'target-row',
            label: 'Revenue Target',
        };
        const actualRow: any = {
            id: 'actual-row',
            label: 'Actual + Forecast',
        };
        const varianceRow: any = {
            id: 'variance-row',
            label: 'Variance',
        };

        filteredMonths.forEach((month) => {
            let totalRevenue = 0;
            filteredData.forEach((row) => {
                const actualRevenue = Number(row.revenue_actuals?.[month]) || 0;
                const forecastRevenue = Number(row.revenue_forecast?.[month]) || 0;
                totalRevenue += actualRevenue || forecastRevenue;
            });

            const targetValue = Number(monthlyTargets?.[month]) || 0;
            const varianceValue = totalRevenue - targetValue;

            targetRow[`month_${month}`] = targetValue;
            actualRow[`month_${month}`] = totalRevenue;
            varianceRow[`month_${month}`] = varianceValue;
        });

        const sumMonths = (row: any) => filteredMonths.reduce((sum, month) => sum + (row[`month_${month}`] || 0), 0);
        targetRow.fyTotal = sumMonths(targetRow);
        actualRow.fyTotal = sumMonths(actualRow);
        varianceRow.fyTotal = sumMonths(varianceRow);

        return [targetRow, actualRow, varianceRow];
    }, [filteredData, filteredMonths, monthlyTargets]);

    // Build static column definitions (shared across grids)
    const staticCols = useMemo<ColDef[]>(
        () => [
            {
                headerName: 'Type',
                field: 'type',
                width: 100,
                pinned: 'left',
                cellClass: (params) => {
                    if (params.data?.job_number === 'Total') {
                        return 'font-bold bg-gray-100 dark:bg-gray-800';
                    }
                    if (params.data?.job_number === 'Labour Req') {
                        return 'font-semibold bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
                    }

                    return 'font-medium';
                },
            },
            {
                headerName: 'Job Name',
                field: 'job_name',
                width: 120,
                pinned: 'left',
                cellClass: (params) => {
                    if (params.data?.job_number === 'Total') {
                        return 'font-bold bg-gray-100 dark:bg-gray-800';
                    }
                    if (params.data?.job_number === 'Labour Req') {
                        return 'bg-purple-50 dark:bg-purple-900/30';
                    }
                    return 'font-medium';
                },
            },
            {
                headerName: 'Job Number',
                field: 'job_number',
                width: 120,
                pinned: 'left',
                cellClass: (params) => {
                    if (params.data?.job_number === 'Total') {
                        return 'font-bold bg-gray-100 dark:bg-gray-800';
                    }
                    if (params.data?.job_number === 'Labour Req') {
                        return 'font-semibold bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
                    }

                    return 'text-blue-600 dark:text-blue-400 hover:underline cursor-pointer';
                },
                onCellClicked: (params: any) => {
                    const rowData = params.data;
                    if (rowData.job_number !== 'Total' && rowData.type !== 'Profit' && rowData.job_number !== 'Labour Req' && rowData.job_number) {
                        if (rowData.type === 'forecast_project') {
                            window.location.href = `/forecast-projects/${rowData.id}`;
                        } else {
                            window.location.href = `/location/${rowData.id}/job-forecast`;
                        }
                    }
                },
            },
            {
                headerName: 'Project Manager',
                field: 'project_manager',
                width: 160,
            },
            {
                headerName: 'Over/Under Billing',
                field: 'over_under_billing',
                width: 160,
                valueFormatter: (params) => {
                    return formatCurrency(params.value);
                },
                type: 'numericColumn',
                cellClass: (params) => {
                    if (params.value < 0) {
                        return 'text-right text-red-600 dark:text-red-400 font-bold bg-red-200 dark:bg-red-900/40';
                    }
                    return 'text-right text-green-600 dark:text-green-400 font-bold bg-green-50 dark:bg-green-900/30';
                },
            },
            {
                headerName: 'Forecast Status',
                field: 'forecast_status',
                width: 140,
                cellRenderer: (params: { data: TurnoverRow }) => {
                    const rowData = params.data as any;
                    if (rowData?.job_number === 'Total' || rowData?.type === 'Profit' || rowData?.job_number === 'Labour Req') {
                        return '';
                    }
                    const status = rowData?.forecast_status as TurnoverRow['forecast_status'];
                    if (status === 'submitted') {
                        return (
                            <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                                <span className="text-sm font-medium text-green-700 dark:text-green-300">Submitted</span>
                            </div>
                        );
                    }
                    if (status === 'draft') {
                        return (
                            <div className="flex items-center gap-1.5">
                                <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                                <span className="text-sm font-medium text-amber-600 dark:text-amber-400">Draft</span>
                            </div>
                        );
                    }
                    return (
                        <div className="flex items-center gap-1.5">
                            <MinusCircle className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                            <span className="text-sm text-gray-500 dark:text-gray-400">Not Started</span>
                        </div>
                    );
                },
            },
            {
                headerName: 'Last Submitted',
                field: 'last_submitted_at',
                width: 160,
                valueFormatter: (params) => {
                    if (!params.value) return '-';
                    const date = new Date(params.value);
                    return date.toLocaleDateString('en-AU', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                    });
                },
                cellClass: (params) => {
                    if (params.data?.job_number === 'Total' || params.data?.type === 'Profit') {
                        return 'bg-gray-100 dark:bg-gray-800';
                    }
                    if (params.data?.job_number === 'Labour Req') {
                        return 'bg-purple-50 dark:bg-purple-900/30';
                    }
                    return 'text-gray-600 dark:text-gray-400 text-sm';
                },
            },
        ],
        [],
    );

    // Build revenue column definitions
    const revenueColumnDefs = useMemo<ColDef[]>(() => {
        const summaryCols: ColDef[] = [
            ...staticCols,
            {
                headerName: 'Project Progress',
                field: 'project_progress',
                width: 250,
                cellRenderer: (params) => {
                    const rowData = params.data as TurnoverRow;
                    if (params.data?.job_number === 'Total' || params.data?.type === 'Profit' || params.data?.job_number === 'Labour Req') {
                        return '';
                    }
                    const claimedToDate = rowData.claimed_to_date || 0;
                    const totalContractValue = rowData.total_contract_value || 0;
                    const progressPercent = totalContractValue > 0 ? (claimedToDate / totalContractValue) * 100 : 0;
                    return (
                        <div className="w-full -space-y-2">
                            <Progress value={progressPercent} className="mt-2 w-full" max={100} />
                            <div className="text-right text-[6px]">{progressPercent.toFixed(1)}% claimed</div>
                        </div>
                    );
                },
            },

            {
                headerName: 'Claimed to Date',
                field: 'claimed_to_date',
                width: 150,
                valueFormatter: (params) => {
                    if (params.data?.job_number === 'Labour Req') return '';
                    return formatCurrency(params.value);
                },
                type: 'numericColumn',
                cellClass: (params) => {
                    if (params.data?.job_number === 'Total') {
                        return 'text-right font-bold bg-gray-100 dark:bg-gray-800';
                    }
                    if (params.data?.job_number === 'Labour Req') {
                        return 'bg-purple-50 dark:bg-purple-900/30';
                    }
                    return 'text-right';
                },
            },

            {
                headerName: `Contract ${fyLabel}`,
                field: 'revenue_contract_fy',
                width: 150,
                valueFormatter: (params) => {
                    if (params.data?.job_number === 'Labour Req') return '';
                    return formatCurrency(params.value);
                },
                type: 'numericColumn',
                cellClass: (params) => {
                    if (params.data?.job_number === 'Total') {
                        return 'text-right font-bold bg-gray-100 dark:bg-gray-800';
                    }
                    if (params.data?.job_number === 'Labour Req') {
                        return 'bg-purple-50 dark:bg-purple-900/30';
                    }
                    return 'text-right font-semibold';
                },
            },
            {
                headerName: 'Total Contract Value',
                field: 'total_contract_value',
                width: 170,
                valueFormatter: (params) => {
                    if (params.data?.job_number === 'Labour Req') return '';
                    return formatCurrency(params.value);
                },
                type: 'numericColumn',
                cellClass: (params) => {
                    if (params.data?.job_number === 'Total') {
                        return 'text-right font-bold bg-gray-100 dark:bg-gray-800';
                    }
                    if (params.data?.job_number === 'Labour Req') {
                        return 'bg-purple-50 dark:bg-purple-900/30';
                    }
                    return 'text-right';
                },
            },
            {
                headerName: `Remaining Value ${fyLabel}`,
                field: 'remaining_revenue_value_fy',
                width: 180,
                valueFormatter: (params) => {
                    if (params.data?.job_number === 'Labour Req') return '';
                    return formatCurrency(params.value);
                },
                type: 'numericColumn',
                cellClass: (params) => {
                    if (params.data?.job_number === 'Total') {
                        return 'text-right font-bold bg-gray-100 dark:bg-gray-800';
                    }
                    if (params.data?.job_number === 'Labour Req') {
                        return 'bg-purple-50 dark:bg-purple-900/30';
                    }
                    return 'text-right';
                },
            },
            {
                headerName: 'Remaining Order Book',
                field: 'remaining_order_book',
                width: 180,
                valueFormatter: (params) => {
                    if (params.data?.job_number === 'Labour Req') return '';
                    return formatCurrency(params.value);
                },
                type: 'numericColumn',
                cellClass: (params) => {
                    if (params.data?.job_number === 'Total') {
                        return 'text-right font-bold bg-gray-100 dark:bg-gray-800';
                    }
                    if (params.data?.job_number === 'Labour Req') {
                        return 'bg-purple-50 dark:bg-purple-900/30';
                    }
                    return 'text-right';
                },
            },
        ];

        const monthlyCols: ColDef[] = filteredMonths.map((month) => {
            const isActualColumn = lastActualMonth && month <= lastActualMonth;

            return {
                headerName: formatMonthHeader(month),
                field: `month_${month}`,
                width: 120,
                type: 'numericColumn',
                cellClass: (params) => {
                    const rowData = params.data as any;

                    if (rowData.job_number === 'Total') {
                        return 'text-right font-bold bg-gray-100 dark:bg-gray-800';
                    }

                    if (rowData.job_number === 'Labour Req') {
                        return 'text-right font-semibold bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
                    }

                    const hasActual = rowData.revenue_actuals && rowData.revenue_actuals[month];
                    const hasForecast = rowData.revenue_forecast && rowData.revenue_forecast[month];

                    const classes = ['text-right'];
                    if (hasActual) {
                        classes.push('bg-green-50 dark:bg-emerald-950/30 font-medium');
                    } else if (hasForecast) {
                        classes.push('bg-blue-50 dark:bg-blue-950/30 italic');
                    }
                    return classes.join(' ');
                },
                headerClass: isActualColumn ? 'bg-green-50 dark:bg-emerald-950/30 font-semibold' : 'bg-blue-100 dark:bg-blue-950/30',
                valueGetter: (params) => {
                    const rowData = params.data as any;

                    // For total or labour req row, use pre-calculated value
                    if (rowData.job_number === 'Total' || rowData.job_number === 'Labour Req') {
                        return safeNumber(rowData[`month_${month}`]);
                    }

                    if (rowData.revenue_actuals && rowData.revenue_actuals[month]) {
                        return rowData.revenue_actuals[month];
                    } else if (rowData.revenue_forecast && rowData.revenue_forecast[month]) {
                        return rowData.revenue_forecast[month];
                    }
                    return 0;
                },
                valueFormatter: (params) => {
                    const rowData = params.data as any;
                    // For labour requirement row, show number of workers (rounded up, no decimals)
                    if (rowData?.job_number === 'Labour Req') {
                        return params.value ? Math.ceil(params.value).toString() : '0';
                    }
                    return formatCurrency(params.value);
                },
            };
        });

        return [...summaryCols, ...monthlyCols];
    }, [filteredMonths, lastActualMonth, fyLabel, staticCols]);

    const targetColumnDefsMemo = useMemo<ColDef[]>(() => {
        const pinnedCols = revenueColumnDefs.filter((col) => col.pinned === 'left');
        const summaryCols = revenueColumnDefs.filter(
            (col) => col.pinned !== 'left' && typeof col.field === 'string' && !col.field.startsWith('month_'),
        );

        const targetPinnedCols: ColDef[] = pinnedCols.map((col, index) => {
            if (index === 0) {
                return {
                    headerName: 'Metric',
                    field: 'label',
                    width: col.width ?? 140,
                    pinned: 'left',
                    cellClass: (params) => {
                        if (params.data?.label === 'Variance') {
                            return 'font-semibold text-slate-700 dark:text-slate-300';
                        }
                        return 'font-medium text-slate-700 dark:text-slate-300';
                    },
                };
            }

            return {
                headerName: '',
                field: `pinned_spacer_${index}`,
                width: col.width ?? 120,
                pinned: 'left',
                sortable: false,
                filter: false,
                resizable: false,
                suppressMenu: true,
                cellClass: 'bg-slate-50 dark:bg-slate-800/50',
                headerClass: 'bg-slate-50 dark:bg-slate-800/50',
                valueGetter: () => '',
            };
        });

        const targetSummaryCols: ColDef[] = summaryCols.map((col, index) => {
            if (index === 0) {
                return {
                    headerName: `Total ${fyLabel}`,
                    field: 'fyTotal',
                    width: col.width ?? 160,
                    valueFormatter: (params) => formatCurrency(params.value),
                    type: 'numericColumn',
                    cellClass: (params) => {
                        if (params.data?.label === 'Variance') {
                            return params.value < 0 ? 'text-right font-semibold text-red-600 dark:text-red-400' : 'text-right font-semibold text-emerald-600 dark:text-emerald-400';
                        }
                        return 'text-right font-semibold';
                    },
                };
            }

            return {
                headerName: '',
                field: `summary_spacer_${index}`,
                width: col.width ?? 120,
                sortable: false,
                filter: false,
                resizable: false,
                suppressMenu: true,
                cellClass: 'bg-slate-50 dark:bg-slate-800/50',
                headerClass: 'bg-slate-50 dark:bg-slate-800/50',
                valueGetter: () => '',
            };
        });

        const monthlyCols: ColDef[] = filteredMonths.map((month) => ({
            headerName: formatMonthHeader(month),
            field: `month_${month}`,
            width: 120,
            type: 'numericColumn',
            valueFormatter: (params) => formatCurrency(params.value),
            cellClass: (params) => {
                if (params.data?.label === 'Variance') {
                    return params.value < 0 ? 'text-right font-medium text-red-600 dark:text-red-400' : 'text-right font-medium text-emerald-600 dark:text-emerald-400';
                }
                return 'text-right';
            },
        }));

        return [...targetPinnedCols, ...targetSummaryCols, ...monthlyCols];
    }, [filteredMonths, fyLabel, revenueColumnDefs]);

    // Build cost column definitions (same structure as revenue, computed for future use)
    void useMemo<ColDef[]>(() => {
        const summaryCols: ColDef[] = [
            ...staticCols,
            {
                headerName: 'Project Progress',
                field: 'project_progress',
                width: 250,
                cellRenderer: (params) => {
                    const rowData = params.data as TurnoverRow;
                    if (params.data?.type === 'Total' || params.data?.type === 'Profit') {
                        return '';
                    }
                    const claimedToDate = rowData.cost_to_date || 0;
                    const totalContractValue = rowData.budget || 0;
                    const progressPercent = totalContractValue > 0 ? (claimedToDate / totalContractValue) * 100 : 0;
                    return (
                        <div className="w-full -space-y-2">
                            <Progress value={progressPercent} className="mt-2 w-full" max={100} />
                            <div className="text-right text-[6px]">{progressPercent.toFixed(1)}% spent</div>
                        </div>
                    );
                },
            },

            {
                headerName: 'Cost to Date',
                field: 'cost_to_date',
                width: 150,
                valueFormatter: (params) => {
                    return formatCurrency(params.value);
                },
                type: 'numericColumn',
                cellClass: (params) => {
                    if (params.data?.type === 'Total') {
                        return 'text-right font-bold bg-gray-100';
                    }
                    return 'text-right';
                },
            },
            {
                headerName: `Contract ${fyLabel}`,
                field: 'cost_contract_fy',
                width: 150,
                valueFormatter: (params) => {
                    return formatCurrency(params.value);
                },
                type: 'numericColumn',
                cellClass: (params) => {
                    if (params.data?.type === 'Total') {
                        return 'text-right font-bold bg-gray-100';
                    }
                    return 'text-right font-semibold';
                },
            },
            {
                headerName: 'Budget',
                field: 'budget',
                width: 170,
                valueFormatter: (params) => {
                    return formatCurrency(params.value);
                },
                type: 'numericColumn',
                cellClass: (params) => {
                    if (params.data?.type === 'Total') {
                        return 'text-right font-bold bg-gray-100';
                    }
                    return 'text-right';
                },
            },
            {
                headerName: `Remaining Value ${fyLabel}`,
                field: 'remaining_cost_value_fy',
                width: 180,
                valueFormatter: (params) => formatCurrency(params.value),
                type: 'numericColumn',
                cellClass: (params) => {
                    if (params.data?.type === 'Total') {
                        return 'text-right font-bold bg-gray-100';
                    }
                    return 'text-right';
                },
            },
            {
                headerName: 'Remaining Budget',
                field: 'remaining_budget',
                width: 180,
                valueFormatter: (params) => formatCurrency(params.value),
                type: 'numericColumn',
                cellClass: (params) => {
                    if (params.data?.type === 'Total') {
                        return 'text-right font-bold bg-gray-100';
                    }
                    return 'text-right';
                },
            },
        ];

        const monthlyCols: ColDef[] = filteredMonths.map((month) => {
            const isActualColumn = lastActualMonth && month <= lastActualMonth;

            return {
                headerName: formatMonthHeader(month),
                field: `month_${month}`,
                width: 120,
                type: 'numericColumn',
                cellClass: (params) => {
                    const rowData = params.data as any;

                    if (rowData.type === 'Total') {
                        const classes = ['text-right', 'font-bold', 'bg-gray-100'];
                        return classes.join(' ');
                    }

                    const hasActual = rowData.cost_actuals && rowData.cost_actuals[month];
                    const hasForecast = rowData.cost_forecast && rowData.cost_forecast[month];

                    const classes = ['text-right'];
                    if (hasActual) {
                        classes.push('bg-yellow-50 font-medium');
                    } else if (hasForecast) {
                        classes.push('bg-blue-50 italic');
                    }
                    return classes.join(' ');
                },
                headerClass: isActualColumn ? 'bg-yellow-50 font-semibold' : 'bg-blue-100',
                valueGetter: (params) => {
                    const rowData = params.data as any;

                    // For profit or total row, use the pre-calculated value
                    if (rowData.type === 'Profit' || rowData.type === 'Total') {
                        return rowData[`month_${month}`] || 0;
                    }

                    if (rowData.cost_actuals && rowData.cost_actuals[month]) {
                        return rowData.cost_actuals[month];
                    } else if (rowData.cost_forecast && rowData.cost_forecast[month]) {
                        return rowData.cost_forecast[month];
                    }
                    return 0;
                },
                valueFormatter: (params) => formatCurrency(params.value),
            };
        });

        return [...summaryCols, ...monthlyCols];
    }, [filteredMonths, lastActualMonth, staticCols, fyLabel]);

    const defaultColDef = useMemo<ColDef>(
        () => ({
            sortable: true,
            filter: true,
            resizable: true,
        }),
        [],
    );

    const handleExportCSV = (gridType: 'revenue' | 'target') => {
        const gridRef = gridType === 'revenue' ? revenueGridRef : costGridRef;
        gridRef.current?.api?.exportDataAsCsv({
            fileName: `turnover-forecast-${gridType}-${new Date().toISOString().split('T')[0]}.csv`,
        });
    };

    // Calculate totals for filtered data
    const totals = useMemo(() => {
        const monthsToDate = lastActualMonth ? filteredMonths.filter((month) => month < lastActualMonth) : [];
        const monthsRemaining = lastActualMonth ? filteredMonths.filter((month) => month >= lastActualMonth) : filteredMonths;
        return filteredData.reduce(
            (acc, row) => {
                acc.budget += safeNumber(row.budget);
                acc.costToDate += safeNumber(row.cost_to_date);
                acc.claimedToDate += safeNumber(row.claimed_to_date);
                acc.revenueContractFY += safeNumber(row.revenue_contract_fy);
                acc.costContractFY += safeNumber(row.cost_contract_fy);
                acc.totalContractValue += safeNumber(row.total_contract_value);
                acc.completedTurnoverYTD += monthsToDate.reduce((sum, month) => sum + safeNumber(row.revenue_actuals?.[month]), 0);
                acc.forecastRevenueYTG += monthsRemaining.reduce((sum, month) => sum + safeNumber(row.revenue_forecast?.[month]), 0);
                return acc;
            },
            {
                budget: 0,
                costToDate: 0,
                claimedToDate: 0,
                revenueContractFY: 0,
                costContractFY: 0,
                totalContractValue: 0,
                completedTurnoverYTD: 0,
                forecastRevenueYTG: 0,
            },
        );
    }, [filteredData, filteredMonths, lastActualMonth]);

    const getRowId = useMemo<(params: GetRowIdParams) => string>(() => {
        return (params: GetRowIdParams) => {
            if (params.data?.id) {
                return String(params.data.id);
            }
            if (params.data?.type === 'Profit') {
                return 'profit-row';
            }
            if (params.data?.job_number === 'Total') {
                return 'total-row';
            }
            if (params.data?.job_number === 'Labour Req') {
                return 'labour-req-row';
            }
            return `${params.data?.type ?? 'row'}-${params.data?.job_number ?? 'unknown'}`;
        };
    }, []);

    const completedTurnoverYTD = totals.completedTurnoverYTD;
    const workInHandFY = totals.forecastRevenueYTG;
    const totalFY = completedTurnoverYTD + workInHandFY;
    const targetMonthsToDate = lastActualMonth ? filteredMonths.filter((month) => month < lastActualMonth) : filteredMonths;
    const targetTurnoverYTD = targetMonthsToDate.reduce((sum, month) => sum + safeNumber(monthlyTargets?.[month]), 0);
    const turnoverTargetFYTotal = filteredMonths.reduce((sum, month) => sum + safeNumber(monthlyTargets?.[month]), 0);
    const remainingTargetToAchieve = Math.max(turnoverTargetFYTotal - totalFY, 0);
    const targetBaseline = turnoverTargetFYTotal > 0 ? turnoverTargetFYTotal : totalFY;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Turnover Forecast" />

            <div className="m-4">
                <div className="mb-6 space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                            <p className="text-muted-foreground text-sm">
                                Combined view of current and potential projects - Financial Year: {selectedFY}
                            </p>
                        </div>
                        <Link href="/forecast-projects" className="sm:flex-shrink-0">
                            <Button variant="outline" size="sm" className="w-full sm:w-auto">
                                Manage Forecast Projects
                            </Button>
                        </Link>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex gap-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 p-1">
                                <Button
                                    size="sm"
                                    variant={viewMode === 'both' ? 'default' : 'ghost'}
                                    onClick={() => setViewMode('both')}
                                    className="h-8 flex-1 sm:flex-none"
                                >
                                    Both
                                </Button>
                                <Button
                                    size="sm"
                                    variant={viewMode === 'revenue' ? 'default' : 'ghost'}
                                    onClick={() => setViewMode('revenue')}
                                    className="h-8 flex-1 sm:flex-none"
                                >
                                    Revenue
                                </Button>
                                <Button
                                    size="sm"
                                    variant={viewMode === 'cost' ? 'default' : 'ghost'}
                                    onClick={() => setViewMode('cost')}
                                    className="h-8 flex-1 sm:flex-none"
                                >
                                    Targets
                                </Button>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={goToPreviousFY}
                                    disabled={selectedFY === 'all'}
                                    title="Previous FY"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Select value={selectedFY} onValueChange={setSelectedFY}>
                                    <SelectTrigger className="h-8 w-[140px]">
                                        <SelectValue placeholder="Select FY" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableFYs.map((fy) => (
                                            <SelectItem key={fy.value} value={fy.value}>
                                                {fy.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={goToNextFY}
                                    disabled={selectedFY === 'all'}
                                    title="Next FY"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={() => setReportDialogOpen(true)} variant="default" size="sm" className="w-full sm:w-auto">
                                <FileText className="mr-2 h-4 w-4" />
                                <span className="hidden sm:inline">View Report</span>
                                <span className="sm:hidden">Report</span>
                            </Button>
                            <Button onClick={() => setFilterDialogOpen(true)} variant="outline" size="sm" className="w-full sm:w-auto">
                                <Filter className="mr-2 h-4 w-4" />
                                <span className="hidden sm:inline">Filter Jobs</span>
                                <span className="sm:hidden">Filter</span>
                                {data.length - filteredData.length > 0 && (
                                    <span className="bg-primary/10 text-primary ml-2 rounded-full px-2 py-0.5 text-xs font-medium">
                                        {data.length - filteredData.length}
                                    </span>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Summary Visual */}
                <div className="mb-6">
                    <div className="group relative overflow-hidden rounded-xl border border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 via-white to-slate-50 dark:from-blue-950/30 dark:via-gray-900 dark:to-slate-900 p-6 shadow-sm transition-all hover:shadow-md">
                        <div className="flex items-start justify-between">
                            <div className="flex-1 space-y-1">
                                <div className="text-sm font-medium text-blue-700 dark:text-blue-400">FY Turnover Progress</div>
                                <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{formatCurrency(totalFY)}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">Completed YTD + Work in Hand {fyLabel}</div>
                            </div>
                            <div className="rounded-lg bg-blue-100 dark:bg-blue-900/50 p-2.5">
                                <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v18h18M7 15l3-3 3 2 4-5" />
                                </svg>
                            </div>
                        </div>
                        <div className="mt-6 space-y-4">
                            <div className="flex h-3 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-900/30">
                                <div
                                    className="bg-blue-600 dark:bg-blue-500"
                                    style={{ width: `${formatPercent(completedTurnoverYTD, targetBaseline)}%` }}
                                    title="Completed turnover YTD"
                                />
                                <div
                                    className="bg-sky-400 dark:bg-sky-500"
                                    style={{ width: `${formatPercent(workInHandFY, targetBaseline)}%` }}
                                    title="Work in hand FY"
                                />
                                <div
                                    className="bg-amber-300 dark:bg-amber-500"
                                    style={{ width: `${formatPercent(remainingTargetToAchieve, targetBaseline)}%` }}
                                    title="Remaining target to achieve"
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-3 text-xs text-slate-600 dark:text-slate-400 sm:grid-cols-3">
                                <div className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded-full bg-blue-600 dark:bg-blue-500" />
                                    <div>
                                        <div className="font-medium text-slate-700 dark:text-slate-300">Completed Turnover YTD</div>
                                        <div>{formatCurrency(completedTurnoverYTD)}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded-full bg-sky-400 dark:bg-sky-500" />
                                    <div>
                                        <div className="font-medium text-slate-700 dark:text-slate-300">Work in Hand {fyLabel}</div>
                                        <div>{formatCurrency(workInHandFY)}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded-full bg-amber-300 dark:bg-amber-500" />
                                    <div>
                                        <div className="font-medium text-slate-700 dark:text-slate-300">Budget Balance to Achieve</div>
                                        <div>{formatCurrency(remainingTargetToAchieve)}</div>
                                    </div>
                                </div>
                                {/* <div className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                                    <div>
                                        <div className="font-medium text-slate-700">Completed Turnover + Work in Hand</div>
                                        <div>{formatCurrency(totalFY)}</div>
                                    </div>
                                </div> */}
                            </div>
                            <div className="flex h-3 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-900/30">
                                <div
                                    className="bg-amber-600 dark:bg-amber-500"
                                    style={{ width: `${formatPercent(targetTurnoverYTD, targetBaseline)}%` }}
                                    title="Completed turnover YTD"
                                />
                                <div
                                    className="bg-amber-300 dark:bg-amber-600"
                                    style={{ width: `${formatPercent(turnoverTargetFYTotal, targetBaseline)}%` }}
                                    title="Budget turnover FY"
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-3 text-xs text-slate-600 dark:text-slate-400 sm:grid-cols-2">
                                <div className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded-full bg-amber-600 dark:bg-amber-500" />
                                    <div>
                                        <div className="font-medium text-slate-700 dark:text-slate-300">Budget Turnover YTD</div>
                                        <div>{formatCurrency(targetTurnoverYTD)}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded-full bg-amber-300 dark:bg-amber-600" />
                                    <div>
                                        <div className="font-medium text-slate-700 dark:text-slate-300">Budget Turnover {fyLabel}</div>
                                        <div>{formatCurrency(turnoverTargetFYTotal)}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-blue-400 via-sky-400 to-slate-400" />
                    </div>
                </div>

                {/* Aligned Grids Container */}
                <div className="space-y-4">
                    {/* Revenue Grid */}
                    {(viewMode === 'both' || viewMode === 'revenue') && (
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <h2 className="text-sm font-semibold">Revenue</h2>
                                <div className="flex gap-1">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button onClick={() => restoreColumnState('revenue')} variant="outline" size="icon">
                                                <RotateCcw className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">Reset column layout</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button onClick={() => handleExportCSV('revenue')} variant="outline" size="icon">
                                                <Download className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">Export as CSV</TooltipContent>
                                    </Tooltip>
                                </div>
                            </div>
                            <div className="rounded-md border bg-white dark:bg-gray-900" style={{ height: `${gridHeights.revenue}px` }}>
                                <AgGridReact
                                    ref={revenueGridRef}
                                    rowData={filteredData}
                                    columnDefs={revenueColumnDefs}
                                    defaultColDef={defaultColDef}
                                    theme={shadcnTheme}
                                    enableCellTextSelection={true}
                                    ensureDomOrder={true}
                                    getRowId={getRowId}
                                    pinnedBottomRowData={revenueTotalRowData}
                                    onGridReady={() => {
                                        setGridsReady((prev) => ({ ...prev, revenue: true }));
                                        applyStoredColumnState('revenue');
                                    }}
                                    onColumnMoved={() => saveColumnState('revenue')}
                                    onColumnResized={() => saveColumnState('revenue')}
                                    onColumnVisible={() => saveColumnState('revenue')}
                                    onColumnPinned={() => saveColumnState('revenue')}
                                />
                            </div>
                            <div
                                className="group relative mt-1 flex h-2 cursor-row-resize items-center justify-center rounded hover:bg-blue-100 dark:hover:bg-blue-900/50"
                                onMouseDown={handleGridResizeStart('revenue')}
                                title="Drag to resize grid"
                            >
                                <div className="bg-border h-0.5 w-12 rounded-full group-hover:bg-blue-500 dark:group-hover:bg-blue-400" />
                            </div>
                        </div>
                    )}

                    {/* Revenue Targets Grid */}
                    {(viewMode === 'both' || viewMode === 'cost') && (
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <h2 className="text-sm font-semibold">Revenue Targets</h2>
                                <div className="flex gap-1">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button onClick={() => restoreColumnState('target')} variant="outline" size="icon">
                                                <RotateCcw className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">Reset column layout</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button onClick={() => handleExportCSV('target')} variant="outline" size="icon">
                                                <Download className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">Export as CSV</TooltipContent>
                                    </Tooltip>
                                </div>
                            </div>
                            <div className="rounded-md border bg-white dark:bg-gray-900" style={{ height: `${gridHeights.cost}px` }}>
                                <AgGridReact
                                    ref={costGridRef}
                                    rowData={targetRowData}
                                    columnDefs={targetColumnDefsMemo}
                                    defaultColDef={defaultColDef}
                                    theme={shadcnTheme}
                                    enableCellTextSelection={true}
                                    ensureDomOrder={true}
                                    getRowId={getRowId}
                                    onGridReady={() => {
                                        setGridsReady((prev) => ({ ...prev, cost: true }));
                                        applyStoredColumnState('target');
                                    }}
                                    onColumnMoved={() => saveColumnState('target')}
                                    onColumnResized={() => saveColumnState('target')}
                                    onColumnVisible={() => saveColumnState('target')}
                                    onColumnPinned={() => saveColumnState('target')}
                                />
                            </div>
                            <div
                                className="group relative mt-1 flex h-2 cursor-row-resize items-center justify-center rounded hover:bg-blue-100 dark:hover:bg-blue-900/50"
                                onMouseDown={handleGridResizeStart('cost')}
                                title="Drag to resize grid"
                            >
                                <div className="bg-border h-0.5 w-12 rounded-full group-hover:bg-blue-500 dark:group-hover:bg-blue-400" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer info */}
                <div className="text-muted-foreground mt-4 text-sm">
                    <p>
                        Showing {filteredData.length} of {data.length} projects ({filteredData.filter((d) => d.type === 'location').length} locations,{' '}
                        {filteredData.filter((d) => d.type === 'forecast_project').length} forecast projects)
                    </p>
                </div>
            </div>

            {/* Filter Dialog */}
            <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
                <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Filter Jobs</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2">
                        <div className="mb-4 flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setExcludedJobIds(new Set())}>
                                Show All
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setExcludedJobIds(new Set(data.map((r) => `${r.type}-${r.id}`)))}>
                                Hide All
                            </Button>
                        </div>
                        <div className="mb-2 text-sm font-medium">Locations</div>
                        {data
                            .filter((row) => row.type === 'location')
                            .map((row) => {
                                const key = `${row.type}-${row.id}`;
                                const isExcluded = excludedJobIds.has(key);
                                return (
                                    <div key={key} className="flex items-center gap-2 py-1">
                                        <Checkbox id={key} checked={!isExcluded} onCheckedChange={() => toggleJobExclusion(row)} />
                                        <label htmlFor={key} className="flex-1 cursor-pointer text-sm">
                                            {row.job_name} ({row.job_number})
                                        </label>
                                    </div>
                                );
                            })}
                        <div className="mt-4 mb-2 text-sm font-medium">Forecast Projects</div>
                        {data
                            .filter((row) => row.type === 'forecast_project')
                            .map((row) => {
                                const key = `${row.type}-${row.id}`;
                                const isExcluded = excludedJobIds.has(key);
                                return (
                                    <div key={key} className="flex items-center gap-2 py-1">
                                        <Checkbox id={key} checked={!isExcluded} onCheckedChange={() => toggleJobExclusion(row)} />
                                        <label htmlFor={key} className="flex-1 cursor-pointer text-sm">
                                            {row.job_name} ({row.job_number})
                                        </label>
                                    </div>
                                );
                            })}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Turnover Report Dialog */}
            <TurnoverReportDialog
                open={reportDialogOpen}
                onOpenChange={setReportDialogOpen}
                data={filteredData}
                months={filteredMonths}
                lastActualMonth={lastActualMonth}
                fyLabel={fyLabel}
                allMonths={months}
            />
        </AppLayout>
    );
}
