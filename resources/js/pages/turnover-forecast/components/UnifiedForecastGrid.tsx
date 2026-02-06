import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { shadcnTheme } from '@/themes/ag-grid-theme';
import type { ColDef, ColumnState, GetRowIdParams, GridReadyEvent } from 'ag-grid-community';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { Download, HelpCircle, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
    formatCurrency,
    formatMonthHeader,
    getMonthCellClass,
    getMonthHeaderClass,
    getPinnedCellClass,
    getRowClass,
    getValueCellClass,
} from '../lib/cell-styles';
import {
    calculateLabourRow,
    calculateTotalRow,
    createTargetRows,
    transformToUnifiedRows,
    type TurnoverRow,
    type UnifiedRow,
} from '../lib/data-transformer';
import { ColumnPresetManager, type ColumnPreset } from './ColumnPresetManager';
import { ColumnVisibilityDropdown, type ColumnGroup } from './ColumnVisibilityDropdown';
import { ForecastStatusCell } from './ForecastStatusCell';
import { LabourCell } from './LabourCell';

ModuleRegistry.registerModules([AllCommunityModule]);

// Custom header component with help icon and HoverCard
interface HeaderWithHelpProps {
    displayName: string;
    helpText: string;
}

function HeaderWithHelp({ displayName, helpText }: HeaderWithHelpProps) {
    return (
        <div className="flex items-center gap-1">
            <span>{displayName}</span>
            <HoverCard openDelay={200}>
                <HoverCardTrigger asChild>
                    <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground inline-flex items-center justify-center transition-colors"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <HelpCircle className="h-3.5 w-3.5" />
                    </button>
                </HoverCardTrigger>
                <HoverCardContent className="w-72 text-sm font-normal" side="bottom">
                    {helpText}
                </HoverCardContent>
            </HoverCard>
        </div>
    );
}

const COLUMN_STATE_KEY = 'turnover-forecast-unified-column-state';

export type ViewMode = 'revenue-only' | 'expanded' | 'targets';

interface UnifiedForecastGridProps {
    data: TurnoverRow[];
    months: string[];
    lastActualMonth: string | null;
    fyLabel: string;
    monthlyTargets: Record<string, number>;
    viewMode: ViewMode;
    height?: number;
    onHeightChange?: (height: number) => void;
}

export function UnifiedForecastGrid({
    data,
    months,
    lastActualMonth,
    fyLabel,
    monthlyTargets,
    viewMode,
    height = 500,
    onHeightChange,
}: UnifiedForecastGridProps) {
    const gridRef = useRef<AgGridReact>(null);
    const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => {
        try {
            const stored = localStorage.getItem(`${COLUMN_STATE_KEY}-hidden`);
            return stored ? new Set(JSON.parse(stored)) : new Set();
        } catch {
            return new Set();
        }
    });

    // Track current column state for presets
    const [currentColumnState, setCurrentColumnState] = useState<ColumnState[] | null>(null);
    const [activePresetId, setActivePresetId] = useState<string | null>(() => {
        try {
            return localStorage.getItem(`${COLUMN_STATE_KEY}-active-preset`) || null;
        } catch {
            return null;
        }
    });

    // Re-apply hidden columns when viewMode changes to ensure AG Grid respects React state
    useEffect(() => {
        if (!gridRef.current?.api || viewMode === 'targets') return;

        // Get all column IDs that should be hidden/shown based on React state
        const allColumnIds = [
            'projectType',
            'jobName',
            'projectManager',
            'overUnderBilling',
            'forecastStatus',
            'toDate',
            'contractFY',
            'totalValue',
            'remainingFY',
            'remainingTotal',
        ];

        // Apply visibility for each column
        allColumnIds.forEach((colId) => {
            const shouldHide = hiddenColumns.has(colId);
            gridRef.current?.api?.setColumnsVisible([colId], !shouldHide);
        });
    }, [viewMode, hiddenColumns]);

    // Transform data based on view mode
    const rowData = useMemo(() => {
        if (viewMode === 'targets') {
            return createTargetRows(data, months, monthlyTargets);
        }

        const rows = transformToUnifiedRows(data, months, lastActualMonth, viewMode);

        // Calculate totals for pinned bottom
        return rows;
    }, [data, months, lastActualMonth, viewMode, monthlyTargets]);

    // Calculate pinned bottom row data (totals)
    const pinnedBottomRowData = useMemo(() => {
        if (viewMode === 'targets') {
            return [];
        }

        const revenueTotal = calculateTotalRow(rowData, 'revenue', months, 'Total Revenue');

        if (viewMode === 'revenue-only') {
            const labourRow = calculateLabourRow(
                rowData.filter((r) => r.rowType === 'revenue'),
                data,
                months,
            );
            return [revenueTotal, labourRow];
        }

        const costTotal = calculateTotalRow(rowData, 'cost', months, 'Total Cost');
        const profitTotal = calculateTotalRow(rowData, 'profit', months, 'Total Profit');

        return [revenueTotal, costTotal, profitTotal];
    }, [rowData, months, viewMode, data]);

    // Build column definitions
    const columnDefs = useMemo<ColDef[]>(() => {
        const staticCols: ColDef[] = [];

        if (viewMode === 'targets') {
            // Targets view has different columns
            staticCols.push({
                headerComponent: () => (
                    <HeaderWithHelp
                        displayName="Metric"
                        helpText="Revenue Target: Monthly budget targets. Actual + Forecast: Combined actuals and forecasts. Variance: Difference between actual/forecast and target."
                    />
                ),
                field: 'jobNumber',
                width: 160,
                pinned: 'left',
                cellClass: 'font-semibold text-slate-700 dark:text-slate-300',
            });

            staticCols.push({
                headerComponent: () => (
                    <HeaderWithHelp displayName={`Total ${fyLabel}`} helpText="Sum of all monthly values for the selected financial year" />
                ),
                field: 'fyTotal',
                width: 140,
                valueFormatter: (params) => formatCurrency(params.value),
                type: 'numericColumn',
                cellClass: (params) => {
                    const data = params.data as UnifiedRow;
                    if (data?.rowType === 'variance') {
                        return params.value < 0
                            ? 'text-right font-semibold text-red-600 dark:text-red-400'
                            : 'text-right font-semibold text-emerald-600 dark:text-emerald-400';
                    }
                    return 'text-right font-semibold';
                },
            });
        } else {
            // Standard columns for revenue/expanded view
            staticCols.push(
                {
                    headerComponent: () => (
                        <HeaderWithHelp
                            displayName="Type"
                            helpText='Indicates project source: "location" for jobs from Access Dimensions, "forecast_project" for manually created forecast projects'
                        />
                    ),
                    field: 'projectType',
                    width: 100,
                    pinned: 'left',
                    hide: hiddenColumns.has('projectType'),
                    cellClass: getPinnedCellClass,
                },
                {
                    headerComponent: () => (
                        <HeaderWithHelp displayName="Job Number" helpText="Unique job identifier. Click to view the job forecast details." />
                    ),
                    field: 'jobNumber',
                    width: 120,
                    pinned: 'left',
                    cellClass: getPinnedCellClass,
                    onCellClicked: (params) => {
                        const rowData = params.data as UnifiedRow;
                        if (
                            rowData.rowType === 'revenue' &&
                            rowData.projectType !== 'total' &&
                            rowData.projectType !== 'summary' &&
                            rowData.jobNumber
                        ) {
                            if (rowData.projectType === 'forecast_project') {
                                window.location.href = `/forecast-projects/${rowData.jobId}`;
                            } else {
                                window.location.href = `/location/${rowData.jobId}/job-forecast`;
                            }
                        }
                    },
                },
                {
                    headerComponent: () => <HeaderWithHelp displayName="Job Name" helpText="Name of the project or job" />,
                    field: 'jobName',
                    width: 150,
                    pinned: 'left',
                    hide: hiddenColumns.has('jobName'),
                    cellClass: (params) => {
                        const rowType = (params.data as UnifiedRow)?.rowType;
                        if (rowType === 'cost' || rowType === 'profit') {
                            return 'pl-4 text-slate-500 dark:text-slate-400 text-sm italic';
                        }
                        return 'font-medium';
                    },
                },
                {
                    headerComponent: () => <HeaderWithHelp displayName="Project Manager" helpText="The manager responsible for this project" />,
                    field: 'projectManager',
                    width: 140,
                    hide: hiddenColumns.has('projectManager'),
                },
                {
                    headerComponent: () => (
                        <HeaderWithHelp
                            displayName="Over/Under Billing"
                            helpText="Difference between claimed revenue and cost incurred. Green = over-billed (claimed more than spent), Red = under-billed (spent more than claimed)"
                        />
                    ),
                    field: 'overUnderBilling',
                    width: 140,
                    hide: hiddenColumns.has('overUnderBilling'),
                    valueFormatter: (params) => formatCurrency(params.value),
                    type: 'numericColumn',
                    cellClass: (params) => {
                        if (params.value < 0) {
                            return 'text-right text-red-600 dark:text-red-400 font-bold bg-red-100 dark:bg-red-900/40';
                        }
                        return 'text-right text-green-600 dark:text-green-400 font-bold bg-green-50 dark:bg-green-900/30';
                    },
                },
                {
                    headerComponent: () => (
                        <HeaderWithHelp
                            displayName="Forecast Status"
                            helpText="Current status of the forecast: not_started, draft, submitted, or finalized"
                        />
                    ),
                    field: 'forecastStatus',
                    width: 130,
                    hide: hiddenColumns.has('forecastStatus'),
                    cellRenderer: (params: { data: UnifiedRow }) => {
                        const rowData = params.data;
                        if (rowData?.rowType !== 'revenue' || rowData?.projectType === 'total' || rowData?.projectType === 'summary') {
                            return null;
                        }
                        return <ForecastStatusCell value={rowData.forecastStatus} />;
                    },
                },
                {
                    headerComponent: () => (
                        <HeaderWithHelp
                            displayName="To Date"
                            helpText="Revenue: Total claimed to date from progress billing. Cost: Total cost incurred to date."
                        />
                    ),
                    field: 'toDate',
                    width: 130,
                    hide: hiddenColumns.has('toDate'),
                    valueFormatter: (params) => {
                        if ((params.data as UnifiedRow)?.rowType === 'labour') return '';
                        return formatCurrency(params.value);
                    },
                    type: 'numericColumn',
                    cellClass: getValueCellClass,
                },
                {
                    headerComponent: () => (
                        <HeaderWithHelp
                            displayName={`Contract ${fyLabel}`}
                            helpText="Sum of monthly values for the selected financial year. Uses actuals where available, otherwise forecast values."
                        />
                    ),
                    field: 'contractFY',
                    width: 130,
                    hide: hiddenColumns.has('contractFY'),
                    valueFormatter: (params) => {
                        if ((params.data as UnifiedRow)?.rowType === 'labour') return '';
                        return formatCurrency(params.value);
                    },
                    type: 'numericColumn',
                    cellClass: getValueCellClass,
                },
                {
                    headerComponent: () => (
                        <HeaderWithHelp
                            displayName="Total Value"
                            helpText="Revenue: Total contract value from Job Summary. Cost: Total budget for the project."
                        />
                    ),
                    field: 'totalValue',
                    width: 130,
                    hide: hiddenColumns.has('totalValue'),
                    valueFormatter: (params) => {
                        if ((params.data as UnifiedRow)?.rowType === 'labour') return '';
                        return formatCurrency(params.value);
                    },
                    type: 'numericColumn',
                    cellClass: getValueCellClass,
                },
                {
                    headerComponent: () => (
                        <HeaderWithHelp
                            displayName={`Remaining ${fyLabel}`}
                            helpText="Remaining value to be claimed/incurred in the current financial year (Contract FY minus To Date value for this FY)"
                        />
                    ),
                    field: 'remainingFY',
                    width: 140,
                    hide: hiddenColumns.has('remainingFY'),
                    valueFormatter: (params) => {
                        if ((params.data as UnifiedRow)?.rowType === 'labour') return '';
                        return formatCurrency(params.value);
                    },
                    type: 'numericColumn',
                    cellClass: getValueCellClass,
                },
                {
                    headerComponent: () => (
                        <HeaderWithHelp
                            displayName="Remaining Total"
                            helpText="Revenue: Remaining order book (Total Value minus Claimed To Date). Cost: Remaining budget (Budget minus Cost To Date)."
                        />
                    ),
                    field: 'remainingTotal',
                    width: 140,
                    hide: hiddenColumns.has('remainingTotal'),
                    valueFormatter: (params) => {
                        if ((params.data as UnifiedRow)?.rowType === 'labour') return '';
                        return formatCurrency(params.value);
                    },
                    type: 'numericColumn',
                    cellClass: getValueCellClass,
                },
            );
        }

        // Monthly columns
        const monthlyCols: ColDef[] = months.map((month) => ({
            headerName: formatMonthHeader(month),
            field: `month_${month}`,
            width: viewMode === 'targets' ? 100 : 110,
            type: 'numericColumn',
            headerClass: getMonthHeaderClass(month, lastActualMonth),
            cellClass: getMonthCellClass(month, lastActualMonth),
            cellRenderer: (params: { data: UnifiedRow; value: number }) => {
                const rowData = params.data;

                // Labour row has special rendering
                if (rowData?.rowType === 'labour') {
                    return <LabourCell data={rowData} month={month} />;
                }

                // Standard currency formatting
                if (params.value === null || params.value === undefined || params.value === 0) {
                    return '';
                }

                return formatCurrency(params.value);
            },
        }));

        return [...staticCols, ...monthlyCols];
    }, [months, lastActualMonth, fyLabel, viewMode, hiddenColumns]);

    // Default column definition
    const defaultColDef = useMemo<ColDef>(
        () => ({
            sortable: true,
            filter: false,
            resizable: true,
        }),
        [],
    );

    // Get row ID for stable rendering
    const getRowId = useCallback((params: GetRowIdParams) => {
        return (params.data as UnifiedRow)?.id ?? `row-${params.level}-${Date.now()}`;
    }, []);

    // Get row height - labour rows need more space
    const getRowHeight = useCallback((params: { data: UnifiedRow }) => {
        if (params.data?.rowType === 'labour') {
            return 50;
        }
        return 36;
    }, []);

    // Update current column state
    const updateCurrentColumnState = useCallback(() => {
        const state = gridRef.current?.api?.getColumnState();
        if (state) {
            setCurrentColumnState(state);
        }
    }, []);

    // Column state persistence
    const handleGridReady = useCallback(
        (params: GridReadyEvent) => {
            try {
                const stored = localStorage.getItem(COLUMN_STATE_KEY);
                if (stored) {
                    const state = JSON.parse(stored) as ColumnState[];
                    params.api.applyColumnState({ state, applyOrder: true });
                }
            } catch {
                // Ignore storage errors
            }
            // Initialize current column state
            updateCurrentColumnState();
        },
        [updateCurrentColumnState],
    );

    const saveColumnState = useCallback(() => {
        try {
            const state = gridRef.current?.api?.getColumnState();
            if (state) {
                localStorage.setItem(COLUMN_STATE_KEY, JSON.stringify(state));
                setCurrentColumnState(state);
            }
        } catch {
            // Ignore storage errors
        }
    }, []);

    const resetColumnState = useCallback(() => {
        gridRef.current?.api?.resetColumnState();
        localStorage.removeItem(COLUMN_STATE_KEY);
        setHiddenColumns(new Set());
        localStorage.removeItem(`${COLUMN_STATE_KEY}-hidden`);
        setActivePresetId(null);
        localStorage.removeItem(`${COLUMN_STATE_KEY}-active-preset`);
        updateCurrentColumnState();
    }, [updateCurrentColumnState]);

    // Export to CSV
    const handleExportCSV = useCallback(() => {
        gridRef.current?.api?.exportDataAsCsv({
            fileName: `turnover-forecast-${viewMode}-${new Date().toISOString().split('T')[0]}.csv`,
        });
    }, [viewMode]);

    // Column visibility management
    const columnGroups = useMemo<ColumnGroup[]>(() => {
        if (viewMode === 'targets') return [];

        return [
            {
                label: 'Job Info',
                columns: [
                    { id: 'projectType', label: 'Type', visible: !hiddenColumns.has('projectType') },
                    { id: 'jobName', label: 'Job Name', visible: !hiddenColumns.has('jobName') },
                    { id: 'projectManager', label: 'Project Manager', visible: !hiddenColumns.has('projectManager') },
                    { id: 'forecastStatus', label: 'Forecast Status', visible: !hiddenColumns.has('forecastStatus') },
                ],
            },
            {
                label: 'Summary Values',
                columns: [
                    { id: 'overUnderBilling', label: 'Over/Under Billing', visible: !hiddenColumns.has('overUnderBilling') },
                    { id: 'toDate', label: 'To Date', visible: !hiddenColumns.has('toDate') },
                    { id: 'contractFY', label: `Contract ${fyLabel}`, visible: !hiddenColumns.has('contractFY') },
                    { id: 'totalValue', label: 'Total Value', visible: !hiddenColumns.has('totalValue') },
                    { id: 'remainingFY', label: `Remaining ${fyLabel}`, visible: !hiddenColumns.has('remainingFY') },
                    { id: 'remainingTotal', label: 'Remaining Total', visible: !hiddenColumns.has('remainingTotal') },
                ],
            },
        ];
    }, [viewMode, hiddenColumns, fyLabel]);

    const handleToggleColumn = useCallback((columnId: string) => {
        setHiddenColumns((prev) => {
            const next = new Set(prev);
            const shouldShow = next.has(columnId);
            if (shouldShow) {
                next.delete(columnId);
            } else {
                next.add(columnId);
            }
            localStorage.setItem(`${COLUMN_STATE_KEY}-hidden`, JSON.stringify([...next]));
            // Toggle visibility via AG Grid API
            gridRef.current?.api?.setColumnsVisible([columnId], shouldShow);
            return next;
        });
        // Mark as modified from preset
        setActivePresetId(null);
        localStorage.removeItem(`${COLUMN_STATE_KEY}-active-preset`);
    }, []);

    const handleShowAllColumns = useCallback(() => {
        setHiddenColumns(new Set());
        localStorage.removeItem(`${COLUMN_STATE_KEY}-hidden`);
        // Show all columns via AG Grid API
        if (gridRef.current?.api) {
            const allColumnIds = [
                'projectType',
                'jobName',
                'projectManager',
                'overUnderBilling',
                'forecastStatus',
                'toDate',
                'contractFY',
                'totalValue',
                'remainingFY',
                'remainingTotal',
            ];
            gridRef.current.api.setColumnsVisible(allColumnIds, true);
        }
    }, []);

    const handleHideAllColumns = useCallback(() => {
        const allIds = columnGroups.flatMap((g) => g.columns.map((c) => c.id));
        setHiddenColumns(new Set(allIds));
        localStorage.setItem(`${COLUMN_STATE_KEY}-hidden`, JSON.stringify(allIds));
        // Hide columns via AG Grid API
        if (gridRef.current?.api) {
            gridRef.current.api.setColumnsVisible(allIds, false);
        }
    }, [columnGroups]);

    // Preset management
    const handleLoadPreset = useCallback(
        (preset: ColumnPreset) => {
            // Apply column state (for column order, width, pinning)
            if (preset.columnState && gridRef.current?.api) {
                gridRef.current.api.applyColumnState({ state: preset.columnState, applyOrder: true });
                localStorage.setItem(COLUMN_STATE_KEY, JSON.stringify(preset.columnState));
            }

            // Apply hidden columns via React state
            const newHiddenColumns = new Set(preset.hiddenColumns);
            setHiddenColumns(newHiddenColumns);
            localStorage.setItem(`${COLUMN_STATE_KEY}-hidden`, JSON.stringify(preset.hiddenColumns));

            // Also explicitly set visibility via AG Grid API to ensure sync
            if (gridRef.current?.api) {
                const allColumnIds = [
                    'projectType',
                    'jobName',
                    'projectManager',
                    'overUnderBilling',
                    'forecastStatus',
                    'toDate',
                    'contractFY',
                    'totalValue',
                    'remainingFY',
                    'remainingTotal',
                ];
                allColumnIds.forEach((colId) => {
                    const shouldHide = newHiddenColumns.has(colId);
                    gridRef.current?.api?.setColumnsVisible([colId], !shouldHide);
                });
            }

            updateCurrentColumnState();
        },
        [updateCurrentColumnState],
    );

    const handleActivePresetChange = useCallback((presetId: string | null) => {
        setActivePresetId(presetId);
        if (presetId) {
            localStorage.setItem(`${COLUMN_STATE_KEY}-active-preset`, presetId);
        } else {
            localStorage.removeItem(`${COLUMN_STATE_KEY}-active-preset`);
        }
    }, []);

    // Grid resize handling
    const handleResizeStart = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            const startY = e.clientY;
            const startHeight = height;

            const handleDrag = (moveEvent: MouseEvent) => {
                const deltaY = moveEvent.clientY - startY;
                const newHeight = Math.min(800, Math.max(200, startHeight + deltaY));
                onHeightChange?.(newHeight);
            };

            const handleDragEnd = () => {
                document.removeEventListener('mousemove', handleDrag);
                document.removeEventListener('mouseup', handleDragEnd);
            };

            document.addEventListener('mousemove', handleDrag);
            document.addEventListener('mouseup', handleDragEnd);
        },
        [height, onHeightChange],
    );

    return (
        <div className="space-y-2">
            {/* Toolbar */}
            <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {viewMode === 'targets' ? 'Revenue Targets' : viewMode === 'expanded' ? 'Revenue, Cost & Profit' : 'Revenue Forecast'}
                </div>
                <div className="flex items-center gap-2">
                    {viewMode !== 'targets' && (
                        <>
                            <ColumnPresetManager
                                currentColumnState={currentColumnState}
                                currentHiddenColumns={Array.from(hiddenColumns)}
                                onLoadPreset={handleLoadPreset}
                                activePresetId={activePresetId}
                                onActivePresetChange={handleActivePresetChange}
                            />
                            <ColumnVisibilityDropdown
                                columnGroups={columnGroups}
                                onToggle={handleToggleColumn}
                                onShowAll={handleShowAllColumns}
                                onHideAll={handleHideAllColumns}
                            />
                        </>
                    )}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button onClick={resetColumnState} variant="outline" size="icon" className="h-8 w-8">
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Reset column layout</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button onClick={handleExportCSV} variant="outline" size="icon" className="h-8 w-8">
                                <Download className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Export as CSV</TooltipContent>
                    </Tooltip>
                </div>
            </div>

            {/* Grid */}
            <div className="bg-card overflow-hidden rounded-xl border shadow-sm" style={{ height: `${height}px` }}>
                <AgGridReact
                    ref={gridRef}
                    rowData={rowData}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    theme={shadcnTheme}
                    getRowId={getRowId}
                    getRowHeight={getRowHeight}
                    getRowClass={getRowClass as any}
                    pinnedBottomRowData={pinnedBottomRowData}
                    enableCellTextSelection
                    ensureDomOrder
                    animateRows={false}
                    suppressRowHoverHighlight={false}
                    onGridReady={handleGridReady}
                    onColumnMoved={saveColumnState}
                    onColumnResized={saveColumnState}
                    onColumnVisible={saveColumnState}
                    onColumnPinned={saveColumnState}
                />
            </div>

            {/* Resize handle */}
            {onHeightChange && (
                <div
                    className="group relative flex h-2 cursor-row-resize items-center justify-center rounded hover:bg-blue-100 dark:hover:bg-blue-900/50"
                    onMouseDown={handleResizeStart}
                    title="Drag to resize grid"
                >
                    <div className="bg-border h-0.5 w-12 rounded-full group-hover:bg-blue-500 dark:group-hover:bg-blue-400" />
                </div>
            )}
        </div>
    );
}
