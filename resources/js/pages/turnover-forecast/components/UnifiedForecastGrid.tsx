import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { shadcnDarkTheme, shadcnLightTheme } from '@/themes/ag-grid-theme';
import { router } from '@inertiajs/react';
import type { ColDef, ColumnState, GetRowIdParams, GridReadyEvent } from 'ag-grid-community';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { Download, GripHorizontal, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
    formatMonthHeader,
    getMonthCellClass,
    getMonthHeaderClass,
    getPinnedCellClass,
    getRowClass,
    getValueCellClass,
} from '../lib/cell-styles';
import { formatCurrency } from '../lib/utils';
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
import { LabourCell } from './LabourCell';

ModuleRegistry.registerModules([AllCommunityModule]);

/** Column IDs for toggleable (non-month) columns — used for visibility sync */
const TOGGLEABLE_COLUMN_IDS = [
    'jobName',
    'totalValue',
    'toDate',
    'remainingTotal',
    'contractFY',
    'fyToDate',
    'remainingFY',
] as const;

/** Stable fallback counter for rows without an ID (avoids Date.now() instability) */
let rowIdCounter = 0;

// Custom header component with help icon and HoverCard
interface HeaderWithHelpProps {
    displayName: string;
    helpText: string;
}

function HeaderWithHelp({ displayName, helpText }: HeaderWithHelpProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className="cursor-help hover:underline hover:decoration-dotted hover:underline-offset-4">{displayName}</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-72 text-sm font-normal" side="bottom">
                {helpText}
            </TooltipContent>
        </Tooltip>
    );
}

const COLUMN_STATE_BASE_KEY = 'turnover-forecast-unified-column-state';
/** Returns a view-mode-scoped storage key so different view modes don't corrupt each other */
const columnStateKey = (viewMode: ViewMode) => `${COLUMN_STATE_BASE_KEY}-${viewMode}`;
const hiddenColumnsKey = (viewMode: ViewMode) => `${COLUMN_STATE_BASE_KEY}-${viewMode}-hidden`;
const activePresetKey = (viewMode: ViewMode) => `${COLUMN_STATE_BASE_KEY}-${viewMode}-active-preset`;

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
            const stored = localStorage.getItem(hiddenColumnsKey(viewMode));
            return stored ? new Set(JSON.parse(stored)) : new Set();
        } catch {
            return new Set();
        }
    });

    // Track current column state for presets
    const [currentColumnState, setCurrentColumnState] = useState<ColumnState[] | null>(null);
    const [activePresetId, setActivePresetId] = useState<string | null>(() => {
        try {
            return localStorage.getItem(activePresetKey(viewMode)) || null;
        } catch {
            return null;
        }
    });

    // Re-apply hidden columns when viewMode changes to ensure AG Grid respects React state
    useEffect(() => {
        if (!gridRef.current?.api || viewMode === 'targets') return;

        // Apply visibility for each column
        TOGGLEABLE_COLUMN_IDS.forEach((colId) => {
            const shouldHide = hiddenColumns.has(colId);
            gridRef.current?.api?.setColumnsVisible([colId], !shouldHide);
        });
    }, [viewMode, hiddenColumns]);

    // Transform data based on view mode
    const rowData = useMemo(() => {
        if (viewMode === 'targets') {
            // Transform revenue rows first so createTargetRows can reuse them
            const revenueRows = transformToUnifiedRows(data, months, lastActualMonth, 'revenue-only');
            return createTargetRows(revenueRows, months, monthlyTargets);
        }

        return transformToUnifiedRows(data, months, lastActualMonth, viewMode);
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
                        helpText="Revenue Target: Monthly budget targets. Work in Hand: Combined actuals and forecasts. Variance: Difference between actual/forecast and target."
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
                            const url = rowData.projectType === 'forecast_project'
                                ? `/forecast-projects/${rowData.jobId}`
                                : `/location/${rowData.jobId}/job-forecast`;
                            router.visit(url);
                        }
                    },
                },
                {
                    headerComponent: () => <HeaderWithHelp displayName="Job Name" helpText="Name of the project or job" />,
                    field: 'jobName',
                    width: 150,
                    pinned: 'left',
                    // Visibility managed via AG Grid API in handleGridReady/useEffect
                    cellClass: (params) => {
                        const rowType = (params.data as UnifiedRow)?.rowType;
                        if (rowType === 'cost' || rowType === 'profit') {
                            return 'pl-4 text-slate-500 dark:text-slate-400 text-sm italic';
                        }
                        return 'font-medium';
                    },
                },
                // --- Lifetime columns ---
                {
                    headerComponent: () => (
                        <HeaderWithHelp
                            displayName="Total Value"
                            helpText="Revenue: Total contract value. Cost: Total budget."
                        />
                    ),
                    field: 'totalValue',
                    width: 130,
                    // Visibility managed via AG Grid API
                    valueFormatter: (params) => {
                        if ((params.data as UnifiedRow)?.rowType === 'labour') return '';
                        const v = (params.data as UnifiedRow)?.rowType === 'cost' ? -Math.abs(params.value) : params.value;
                        return formatCurrency(v);
                    },
                    type: 'numericColumn',
                    cellClass: getValueCellClass,
                },
                {
                    headerComponent: () => (
                        <HeaderWithHelp
                            displayName="To Date"
                            helpText="Lifetime total. Revenue: claimed to date. Cost: incurred to date."
                        />
                    ),
                    field: 'toDate',
                    width: 130,
                    // Visibility managed via AG Grid API
                    valueFormatter: (params) => {
                        if ((params.data as UnifiedRow)?.rowType === 'labour') return '';
                        const v = (params.data as UnifiedRow)?.rowType === 'cost' ? -Math.abs(params.value) : params.value;
                        return formatCurrency(v);
                    },
                    type: 'numericColumn',
                    cellClass: getValueCellClass,
                },
                {
                    headerComponent: () => (
                        <HeaderWithHelp
                            displayName="Remaining Total"
                            helpText="Total Value minus To Date. Revenue: remaining order book. Cost: remaining budget."
                        />
                    ),
                    field: 'remainingTotal',
                    width: 140,
                    // Visibility managed via AG Grid API
                    valueFormatter: (params) => {
                        if ((params.data as UnifiedRow)?.rowType === 'labour') return '';
                        const v = (params.data as UnifiedRow)?.rowType === 'cost' ? -Math.abs(params.value) : params.value;
                        return formatCurrency(v);
                    },
                    type: 'numericColumn',
                    cellClass: getValueCellClass,
                },
                // --- FY-scoped columns ---
                {
                    headerComponent: () => (
                        <HeaderWithHelp
                            displayName="Contract FY"
                            helpText="Total expected value for the selected FY. Actuals where available, otherwise forecast."
                        />
                    ),
                    field: 'contractFY',
                    width: 130,
                    // Visibility managed via AG Grid API
                    valueFormatter: (params) => {
                        if ((params.data as UnifiedRow)?.rowType === 'labour') return '';
                        const v = (params.data as UnifiedRow)?.rowType === 'cost' ? -Math.abs(params.value) : params.value;
                        return formatCurrency(v);
                    },
                    type: 'numericColumn',
                    cellClass: getValueCellClass,
                },
                {
                    headerComponent: () => (
                        <HeaderWithHelp
                            displayName="FY To Date"
                            helpText="Actuals only within the selected FY. Zero if no actuals exist for the period."
                        />
                    ),
                    field: 'fyToDate',
                    width: 130,
                    // Visibility managed via AG Grid API
                    valueFormatter: (params) => {
                        if ((params.data as UnifiedRow)?.rowType === 'labour') return '';
                        const v = (params.data as UnifiedRow)?.rowType === 'cost' ? -Math.abs(params.value) : params.value;
                        return formatCurrency(v);
                    },
                    type: 'numericColumn',
                    cellClass: getValueCellClass,
                },
                {
                    headerComponent: () => (
                        <HeaderWithHelp
                            displayName="Remaining FY"
                            helpText="Contract FY minus FY To Date. Equals Contract FY when no actuals exist."
                        />
                    ),
                    field: 'remainingFY',
                    width: 130,
                    // Visibility managed via AG Grid API
                    valueFormatter: (params) => {
                        if ((params.data as UnifiedRow)?.rowType === 'labour') return '';
                        const v = (params.data as UnifiedRow)?.rowType === 'cost' ? -Math.abs(params.value) : params.value;
                        return formatCurrency(v);
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
            width: viewMode === 'targets' ? 120 : 140,
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

                // Show cost values as negative (deduction)
                const displayValue = rowData?.rowType === 'cost' ? -Math.abs(params.value) : params.value;
                return <span style={{ paddingRight: 4 }}>{formatCurrency(displayValue)}</span>;
            },
        }));

        return [...staticCols, ...monthlyCols];
    }, [months, lastActualMonth, fyLabel, viewMode]);

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
        return (params.data as UnifiedRow)?.id ?? `row-${params.level}-${rowIdCounter++}`;
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
                const stored = localStorage.getItem(columnStateKey(viewMode));
                if (stored) {
                    const state = JSON.parse(stored) as ColumnState[];
                    params.api.applyColumnState({ state, applyOrder: true });
                }
            } catch {
                // Ignore storage errors
            }
            // Apply hidden columns from localStorage (since hide is no longer on column defs)
            if (viewMode !== 'targets') {
                try {
                    const hiddenStored = localStorage.getItem(hiddenColumnsKey(viewMode));
                    if (hiddenStored) {
                        const hiddenIds = JSON.parse(hiddenStored) as string[];
                        TOGGLEABLE_COLUMN_IDS.forEach((colId) => {
                            params.api.setColumnsVisible([colId], !hiddenIds.includes(colId));
                        });
                    }
                } catch {
                    // Ignore
                }
            }
            // Initialize current column state
            updateCurrentColumnState();
        },
        [updateCurrentColumnState, viewMode],
    );

    const saveColumnStateImmediate = useCallback(() => {
        try {
            const state = gridRef.current?.api?.getColumnState();
            if (state) {
                localStorage.setItem(columnStateKey(viewMode), JSON.stringify(state));
                setCurrentColumnState(state);
            }
        } catch {
            // Ignore storage errors
        }
    }, [viewMode]);

    // Debounced version — avoids writing to localStorage on every pixel during column resize
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const saveColumnState = useCallback(() => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(saveColumnStateImmediate, 300);
    }, [saveColumnStateImmediate]);

    const resetColumnState = useCallback(() => {
        gridRef.current?.api?.resetColumnState();
        localStorage.removeItem(columnStateKey(viewMode));
        setHiddenColumns(new Set());
        localStorage.removeItem(hiddenColumnsKey(viewMode));
        setActivePresetId(null);
        localStorage.removeItem(activePresetKey(viewMode));
        updateCurrentColumnState();
    }, [updateCurrentColumnState, viewMode]);

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
                    { id: 'jobName', label: 'Job Name', visible: !hiddenColumns.has('jobName') },
                ],
            },
            {
                label: 'Lifetime',
                columns: [
                    { id: 'totalValue', label: 'Total Value', visible: !hiddenColumns.has('totalValue') },
                    { id: 'toDate', label: 'To Date', visible: !hiddenColumns.has('toDate') },
                    { id: 'remainingTotal', label: 'Remaining Total', visible: !hiddenColumns.has('remainingTotal') },
                ],
            },
            {
                label: 'Financial Year',
                columns: [
                    { id: 'contractFY', label: 'Contract FY', visible: !hiddenColumns.has('contractFY') },
                    { id: 'fyToDate', label: 'FY To Date', visible: !hiddenColumns.has('fyToDate') },
                    { id: 'remainingFY', label: 'Remaining FY', visible: !hiddenColumns.has('remainingFY') },
                ],
            },
        ];
    }, [viewMode, hiddenColumns]);

    const handleToggleColumn = useCallback((columnId: string) => {
        setHiddenColumns((prev) => {
            const next = new Set(prev);
            const shouldShow = next.has(columnId);
            if (shouldShow) {
                next.delete(columnId);
            } else {
                next.add(columnId);
            }
            localStorage.setItem(hiddenColumnsKey(viewMode), JSON.stringify([...next]));
            // Toggle visibility via AG Grid API
            gridRef.current?.api?.setColumnsVisible([columnId], shouldShow);
            return next;
        });
        // Mark as modified from preset
        setActivePresetId(null);
        localStorage.removeItem(activePresetKey(viewMode));
    }, [viewMode]);

    const handleShowAllColumns = useCallback(() => {
        setHiddenColumns(new Set());
        localStorage.removeItem(hiddenColumnsKey(viewMode));
        // Show all columns via AG Grid API
        if (gridRef.current?.api) {
            gridRef.current.api.setColumnsVisible([...TOGGLEABLE_COLUMN_IDS], true);
        }
    }, [viewMode]);

    const handleHideAllColumns = useCallback(() => {
        const allIds = columnGroups.flatMap((g) => g.columns.map((c) => c.id));
        setHiddenColumns(new Set(allIds));
        localStorage.setItem(hiddenColumnsKey(viewMode), JSON.stringify(allIds));
        // Hide columns via AG Grid API
        if (gridRef.current?.api) {
            gridRef.current.api.setColumnsVisible(allIds, false);
        }
    }, [columnGroups, viewMode]);

    // Preset management
    const handleLoadPreset = useCallback(
        (preset: ColumnPreset) => {
            // Apply column state (for column order, width, pinning)
            if (preset.columnState && gridRef.current?.api) {
                gridRef.current.api.applyColumnState({ state: preset.columnState, applyOrder: true });
                localStorage.setItem(columnStateKey(viewMode), JSON.stringify(preset.columnState));
            }

            // Apply hidden columns via React state
            const newHiddenColumns = new Set(preset.hiddenColumns);
            setHiddenColumns(newHiddenColumns);
            localStorage.setItem(hiddenColumnsKey(viewMode), JSON.stringify(preset.hiddenColumns));

            // Also explicitly set visibility via AG Grid API to ensure sync
            if (gridRef.current?.api) {
                TOGGLEABLE_COLUMN_IDS.forEach((colId) => {
                    const shouldHide = newHiddenColumns.has(colId);
                    gridRef.current?.api?.setColumnsVisible([colId], !shouldHide);
                });
            }

            updateCurrentColumnState();
        },
        [updateCurrentColumnState, viewMode],
    );

    const handleActivePresetChange = useCallback((presetId: string | null) => {
        setActivePresetId(presetId);
        if (presetId) {
            localStorage.setItem(activePresetKey(viewMode), presetId);
        } else {
            localStorage.removeItem(activePresetKey(viewMode));
        }
    }, [viewMode]);

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
            <div
                className="ag-theme-shadcn bg-card overflow-hidden rounded-xl border shadow-sm"
                style={viewMode === 'expanded' ? { height: `${height}px` } : undefined}
            >
                <AgGridReact
                    ref={gridRef}
                    rowData={rowData}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    domLayout={viewMode === 'expanded' ? 'normal' : 'autoHeight'}
                    theme={typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? shadcnDarkTheme : shadcnLightTheme}
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
                    className="group relative flex h-4 cursor-row-resize items-center justify-center rounded hover:bg-blue-100 dark:hover:bg-blue-900/50"
                    onMouseDown={handleResizeStart}
                    title="Drag to resize grid"
                >
                    <GripHorizontal className="text-border h-4 w-4 group-hover:text-blue-500 dark:group-hover:text-blue-400" />
                </div>
            )}
        </div>
    );
}
