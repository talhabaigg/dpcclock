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
import type { ColDef, GetRowIdParams } from 'ag-grid-community';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { Download, FileText, Filter } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TurnoverReportDialog } from './TurnoverReportDialog';

ModuleRegistry.registerModules([AllCommunityModule]);

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Turnover Forecast', href: '/turnover-forecast' }];

const STORAGE_KEY = 'turnover-forecast-excluded-jobs';
const GRID_HEIGHTS_KEY = 'turnover-forecast-grid-heights';

type MonthlyData = {
    [month: string]: number;
};

type TurnoverRow = {
    id: number;
    type: 'location' | 'forecast_project';
    job_name: string;
    job_number: string;
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

const formatMonthHeader = (month: string): string => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
    return date.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' });
};

export default function TurnoverForecastIndex({
    data,
    months,
    earliestMonth,
    lastActualMonth,
    latestForecastMonth,
    fyStartDate,
    fyEndDate,
    fyLabel,
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

    // Financial Year filter - generate available FYs based on data
    const availableFYs = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        const currentFY = currentMonth >= 7 ? currentYear : currentYear - 1;

        // Generate FY options from 5 years ago to 2 years ahead
        const fys = [{ value: 'all', label: 'All Time' }];
        for (let year = currentFY - 5; year <= currentFY + 2; year++) {
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
            type: 'Total',
            job_name: '',
            job_number: '',
            claimed_to_date: 0,
            revenue_contract_fy: 0,
            total_contract_value: 0,
            remaining_revenue_value_fy: 0,
            remaining_order_book: 0,
        };

        // Calculate totals for each month
        filteredMonths.forEach((month) => {
            let totalRevenue = 0;

            filteredData.forEach((row) => {
                const actualRevenue = row.revenue_actuals?.[month] || 0;
                const forecastRevenue = row.revenue_forecast?.[month] || 0;
                const revenue = actualRevenue || forecastRevenue;
                totalRevenue += revenue;
            });

            totalRow[`month_${month}`] = totalRevenue;
        });

        // Calculate summary fields
        filteredData.forEach((row) => {
            totalRow.claimed_to_date += row.claimed_to_date || 0;
            totalRow.revenue_contract_fy += row.revenue_contract_fy || 0;
            totalRow.total_contract_value += row.total_contract_value || 0;
            totalRow.remaining_revenue_value_fy += row.remaining_revenue_value_fy || 0;
            totalRow.remaining_order_book += row.remaining_order_book || 0;
        });

        return [totalRow];
    }, [filteredData, filteredMonths]);

    // Calculate cost total row data
    const costTotalRowData = useMemo(() => {
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

    // Calculate profit pinned row data
    const profitPinnedRowData = useMemo(() => {
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

    // Build static column definitions (shared across grids)
    const staticCols = useMemo<ColDef[]>(
        () => [
            {
                headerName: 'Type',
                field: 'type',
                width: 100,
                pinned: 'left',
                cellClass: (params) => {
                    if (params.data?.type === 'Total') {
                        return 'font-bold bg-gray-100';
                    }
                    if (params.data?.type === 'Profit') {
                        return 'font-bold bg-red-50';
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
                    if (params.data?.type === 'Profit') {
                        return 'font-bold bg-red-50';
                    }
                    if (params.data?.type === 'Total') {
                        return 'font-bold bg-gray-100';
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
                    if (params.data?.type === 'Total') {
                        return 'bg-gray-100';
                    }
                    if (params.data?.type === 'Profit') {
                        return 'font-bold bg-red-50';
                    }
                    return 'text-blue-600 hover:underline cursor-pointer';
                },
                onCellClicked: (params: any) => {
                    const rowData = params.data;
                    if (rowData.type !== 'Total' && rowData.type !== 'Profit' && rowData.job_number) {
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
                    if (params.data?.type === 'Total' || params.data?.type === 'Profit') {
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
                headerName: `Contract ${fyLabel}`,
                field: 'revenue_contract_fy',
                width: 150,
                valueFormatter: (params) => formatCurrency(params.value),
                type: 'numericColumn',
                cellClass: (params) => {
                    if (params.data?.type === 'Total') {
                        return 'text-right font-bold bg-gray-100';
                    }
                    return 'text-right font-semibold';
                },
                headerClass: 'bg-blue-50',
            },
            {
                headerName: 'Total Contract Value',
                field: 'total_contract_value',
                width: 170,
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
                headerName: `Remaining Value ${fyLabel}`,
                field: 'remaining_revenue_value_fy',
                width: 180,
                valueFormatter: (params) => formatCurrency(params.value),
                type: 'numericColumn',
                cellClass: (params) => {
                    if (params.data?.type === 'Total') {
                        return 'text-right font-bold bg-gray-100';
                    }
                    return 'text-right';
                },
                headerClass: 'bg-amber-50',
            },
            {
                headerName: 'Remaining Order Book',
                field: 'remaining_order_book',
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
                        return 'text-right font-bold bg-gray-100';
                    }

                    const hasActual = rowData.revenue_actuals && rowData.revenue_actuals[month];
                    const hasForecast = rowData.revenue_forecast && rowData.revenue_forecast[month];

                    const classes = ['text-right'];
                    if (hasActual) {
                        classes.push('bg-green-50 font-medium');
                    } else if (hasForecast) {
                        classes.push('bg-blue-50 italic');
                    }
                    return classes.join(' ');
                },
                headerClass: isActualColumn ? 'bg-green-50 font-semibold' : 'bg-blue-100',
                valueGetter: (params) => {
                    const rowData = params.data as any;

                    // For total row, use pre-calculated value
                    if (rowData.type === 'Total') {
                        return rowData[`month_${month}`] || 0;
                    }

                    if (rowData.revenue_actuals && rowData.revenue_actuals[month]) {
                        return rowData.revenue_actuals[month];
                    } else if (rowData.revenue_forecast && rowData.revenue_forecast[month]) {
                        return rowData.revenue_forecast[month];
                    }
                    return 0;
                },
                valueFormatter: (params) => formatCurrency(params.value),
            };
        });

        return [...summaryCols, ...monthlyCols];
    }, [filteredMonths, lastActualMonth, fyLabel, staticCols]);

    // Build cost column definitions (same structure as revenue)
    const costColumnDefs = useMemo<ColDef[]>(() => {
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
                    if (params.data?.type === 'Profit') {
                        return formatCurrency(params.data.profit_to_date);
                    }
                    return formatCurrency(params.value);
                },
                type: 'numericColumn',
                cellClass: (params) => {
                    if (params.data?.type === 'Profit') {
                        return 'text-right font-bold bg-red-50';
                    }
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
                    if (params.data?.type === 'Profit') {
                        return formatCurrency(params.data.profit_contract_fy);
                    }
                    return formatCurrency(params.value);
                },
                type: 'numericColumn',
                cellClass: (params) => {
                    if (params.data?.type === 'Profit') {
                        return 'text-right font-bold bg-red-50';
                    }
                    if (params.data?.type === 'Total') {
                        return 'text-right font-bold bg-gray-100';
                    }
                    return 'text-right font-semibold';
                },
                headerClass: 'bg-blue-50',
            },
            {
                headerName: 'Budget',
                field: 'budget',
                width: 170,
                valueFormatter: (params) => {
                    if (params.data?.type === 'Profit') {
                        return formatCurrency(params.data.profit_total);
                    }
                    return formatCurrency(params.value);
                },
                type: 'numericColumn',
                cellClass: (params) => {
                    if (params.data?.type === 'Profit') {
                        return 'text-right font-bold bg-red-50';
                    }
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
                    if (params.data?.type === 'Profit') {
                        return 'text-right font-bold bg-red-50';
                    }
                    if (params.data?.type === 'Total') {
                        return 'text-right font-bold bg-gray-100';
                    }
                    return 'text-right';
                },
                headerClass: 'bg-amber-50',
            },
            {
                headerName: 'Remaining Budget',
                field: 'remaining_budget',
                width: 180,
                valueFormatter: (params) => formatCurrency(params.value),
                type: 'numericColumn',
                cellClass: (params) => {
                    if (params.data?.type === 'Profit') {
                        return 'text-right font-bold bg-red-50';
                    }
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

                    if (rowData.type === 'Profit') {
                        const classes = ['text-right', 'font-bold', 'bg-red-50'];
                        return classes.join(' ');
                    }

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

    const handleExportCSV = (gridType: 'revenue' | 'cost') => {
        const gridRef = gridType === 'revenue' ? revenueGridRef : costGridRef;
        gridRef.current?.api?.exportDataAsCsv({
            fileName: `turnover-forecast-${gridType}-${new Date().toISOString().split('T')[0]}.csv`,
        });
    };

    // Calculate totals for filtered data
    const totals = useMemo(() => {
        return filteredData.reduce(
            (acc, row) => {
                acc.budget += row.budget;
                acc.costToDate += row.cost_to_date;
                acc.claimedToDate += row.claimed_to_date;
                acc.revenueContractFY += row.revenue_contract_fy;
                acc.costContractFY += row.cost_contract_fy;
                acc.totalContractValue += row.total_contract_value;
                return acc;
            },
            {
                budget: 0,
                costToDate: 0,
                claimedToDate: 0,
                revenueContractFY: 0,
                costContractFY: 0,
                totalContractValue: 0,
            },
        );
    }, [filteredData]);

    const getRowId = useMemo<(params: GetRowIdParams) => string>(() => {
        return (params: GetRowIdParams) => {
            if (params.data.type === 'Profit') {
                return 'profit-row';
            }
            if (params.data.type === 'Total') {
                return params.data.id;
            }
            return `${params.data.type}-${params.data.id}`;
        };
    }, []);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Turnover Forecast" />

            <div className="m-4">
                <div className="mb-6 space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                            <h1 className="text-2xl font-semibold tracking-tight">Turnover Forecast</h1>
                            <p className="text-muted-foreground text-sm">
                                Combined view of current and potential projects - Financial Year: {fyLabel}
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
                            <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50/50 p-1">
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
                                    Cost
                                </Button>
                            </div>
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

                {/* Summary Cards */}
                <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
                    <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm transition-all hover:shadow-md">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="text-sm font-medium text-slate-600">Total Contract Value</div>
                                <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                                    {formatCurrency(totals.totalContractValue)}
                                </div>
                                <div className="mt-2 text-xs text-slate-500">Full project value</div>
                            </div>
                            <div className="rounded-lg bg-slate-100 p-2.5">
                                <svg className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                    />
                                </svg>
                            </div>
                        </div>
                        <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-slate-400 to-slate-500"></div>
                    </div>

                    <div className="group relative overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm transition-all hover:shadow-md">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="text-sm font-medium text-blue-700">Revenue Contract {fyLabel}</div>
                                <div className="mt-2 text-3xl font-bold tracking-tight text-blue-900">{formatCurrency(totals.revenueContractFY)}</div>
                                <div className="mt-2 flex items-center gap-1 text-xs text-blue-600">
                                    <span className="font-medium">{((totals.revenueContractFY / totals.totalContractValue) * 100).toFixed(1)}%</span>
                                    <span className="text-blue-500">of total value</span>
                                </div>
                            </div>
                            <div className="rounded-lg bg-blue-100 p-2.5">
                                <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                            </div>
                        </div>
                        <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-blue-400 to-blue-600"></div>
                    </div>

                    <div className="group relative overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 shadow-sm transition-all hover:shadow-md">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="text-sm font-medium text-amber-700">Budget</div>
                                <div className="mt-2 text-3xl font-bold tracking-tight text-amber-900">{formatCurrency(totals.budget)}</div>
                                <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                                    <span className="font-medium">{((totals.budget / totals.totalContractValue) * 100).toFixed(1)}%</span>
                                    <span className="text-amber-500">cost ratio</span>
                                </div>
                            </div>
                            <div className="rounded-lg bg-amber-100 p-2.5">
                                <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                            </div>
                        </div>
                        <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-amber-400 to-amber-600"></div>
                    </div>

                    <div className="group relative overflow-hidden rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-white p-6 shadow-sm transition-all hover:shadow-md">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="text-sm font-medium text-green-700">Profit to Date</div>
                                <div className="mt-2 text-3xl font-bold tracking-tight text-green-900">
                                    {formatCurrency(totals.claimedToDate - totals.costToDate)}
                                </div>
                                <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                                    <span className="font-medium">
                                        {totals.claimedToDate > 0
                                            ? (((totals.claimedToDate - totals.costToDate) / totals.claimedToDate) * 100).toFixed(1)
                                            : '0.0'}
                                        %
                                    </span>
                                    <span className="text-green-500">margin</span>
                                </div>
                            </div>
                            <div className="rounded-lg bg-green-100 p-2.5">
                                <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                                    />
                                </svg>
                            </div>
                        </div>
                        <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-green-400 to-green-600"></div>
                    </div>
                </div>

                {/* Legend */}
                {/* <div className="mb-4 flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-4 border border-green-200 bg-green-50"></div>
                        <span>Revenue Actuals</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-4 border border-yellow-200 bg-yellow-50"></div>
                        <span>Cost Actuals</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-4 border border-blue-200 bg-blue-50"></div>
                        <span>Forecast</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-4 border border-blue-300 bg-blue-100"></div>
                        <span>Total Row</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-4 border border-amber-200 bg-amber-100"></div>
                        <span>Profit Row (in Cost grid)</span>
                    </div>
                </div> */}

                {/* Aligned Grids Container */}
                <div className="space-y-4">
                    {/* Revenue Grid */}
                    {(viewMode === 'both' || viewMode === 'revenue') && (
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <h2 className="text-sm font-semibold">Revenue</h2>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button onClick={() => handleExportCSV('revenue')} variant="outline" size="icon">
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">Export as CSV</TooltipContent>
                                </Tooltip>
                            </div>
                            <div className="rounded-md border bg-white" style={{ height: `${gridHeights.revenue}px` }}>
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
                                    alignedGrids={[]}
                                    onGridReady={() => {
                                        setGridsReady((prev) => ({ ...prev, revenue: true }));
                                    }}
                                />
                            </div>
                            <div
                                className="group relative mt-1 flex h-2 cursor-row-resize items-center justify-center rounded hover:bg-blue-100"
                                onMouseDown={handleGridResizeStart('revenue')}
                                title="Drag to resize grid"
                            >
                                <div className="bg-border h-0.5 w-12 rounded-full group-hover:bg-blue-500" />
                            </div>
                        </div>
                    )}

                    {/* Cost Grid with Total and Profit Pinned Rows */}
                    {(viewMode === 'both' || viewMode === 'cost') && (
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <h2 className="text-sm font-semibold">Cost</h2>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button onClick={() => handleExportCSV('cost')} variant="outline" size="icon">
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">Export as CSV</TooltipContent>
                                </Tooltip>
                            </div>
                            <div className="rounded-md border bg-white" style={{ height: `${gridHeights.cost}px` }}>
                                <AgGridReact
                                    ref={costGridRef}
                                    rowData={filteredData}
                                    columnDefs={costColumnDefs}
                                    defaultColDef={defaultColDef}
                                    theme={shadcnTheme}
                                    enableCellTextSelection={true}
                                    ensureDomOrder={true}
                                    getRowId={getRowId}
                                    pinnedBottomRowData={[...costTotalRowData, ...profitPinnedRowData]}
                                    alignedGrids={[]}
                                    onGridReady={() => {
                                        setGridsReady((prev) => ({ ...prev, cost: true }));
                                    }}
                                />
                            </div>
                            <div
                                className="group relative mt-1 flex h-2 cursor-row-resize items-center justify-center rounded hover:bg-blue-100"
                                onMouseDown={handleGridResizeStart('cost')}
                                title="Drag to resize grid"
                            >
                                <div className="bg-border h-0.5 w-12 rounded-full group-hover:bg-blue-500" />
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
