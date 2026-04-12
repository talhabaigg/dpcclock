import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { shadcnDarkTheme, shadcnLightTheme } from '@/themes/ag-grid-theme';
import { router } from '@inertiajs/react';
import type { ColDef, ColumnState, GetRowIdParams, GridReadyEvent, ICellRendererParams } from 'ag-grid-community';
import type { AgGridReactProps } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { AgGridReact } from 'ag-grid-react';
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Download, GripHorizontal, RotateCcw } from 'lucide-react';
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

ModuleRegistry.registerModules([AllCommunityModule, AllEnterpriseModule]);

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

export type ViewMode = 'revenue-only' | 'targets';

interface UnifiedForecastGridProps {
    data: TurnoverRow[];
    months: string[];
    lastActualMonth: string | null;
    fyLabel: string;
    monthlyTargets: Record<string, number>;
    viewMode: ViewMode;
    height?: number;
    onHeightChange?: (height: number) => void;
    /** External ref for the AG Grid instance (used to wire up alignedGrids across views) */
    gridRef?: React.RefObject<AgGridReact | null>;
    /** Other grids whose columns/horizontal scroll should stay in sync with this one */
    alignedGrids?: AgGridReactProps['alignedGrids'];
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
    gridRef: externalGridRef,
    alignedGrids,
}: UnifiedForecastGridProps) {
    const internalGridRef = useRef<AgGridReact>(null);
    const gridRef = externalGridRef ?? internalGridRef;
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

    // Tracks whether the sticky Total Revenue row is expanded to also show Total Cost
    // and Total Profit beneath it (pinned rows don't participate in AG Grid tree data,
    // so we manage expansion ourselves and re-render pinnedBottomRowData accordingly).
    const [totalsExpanded, setTotalsExpanded] = useState(false);

    // Transform data based on view mode (tree-structured for non-targets).
    const rowData = useMemo(() => {
        const unified = transformToUnifiedRows(data, months);
        if (viewMode === 'targets') {
            return createTargetRows(unified, months, monthlyTargets, lastActualMonth);
        }
        return unified;
    }, [data, months, lastActualMonth, viewMode, monthlyTargets]);

    // Pinned bottom rows: always-visible totals (sticky) + labour requirement.
    // Total Revenue is the always-shown root; Total Cost/Profit reveal on expand.
    // Returns undefined (not []) for targets so AG Grid doesn't reserve pinned space.
    const pinnedBottomRowData = useMemo<UnifiedRow[] | undefined>(() => {
        if (viewMode === 'targets') {
            return undefined;
        }
        const revenueTotal = calculateTotalRow(rowData, 'revenue', months, 'Total Revenue', 'root');
        const labourRow = calculateLabourRow(
            rowData.filter((r) => r.rowType === 'revenue' && !r.isTotal),
            data,
            months,
        );
        if (totalsExpanded) {
            const costTotal = calculateTotalRow(rowData, 'cost', months, 'Total Cost', 'child');
            const profitTotal = calculateTotalRow(rowData, 'profit', months, 'Total Profit', 'child');
            return [revenueTotal, costTotal, profitTotal, labourRow];
        }
        return [revenueTotal, labourRow];
    }, [rowData, months, viewMode, data, totalsExpanded]);

    // Build column definitions
    const columnDefs = useMemo<ColDef[]>(() => {
        const staticCols: ColDef[] = [];

        if (viewMode === 'targets') {
            // Targets view reuses the revenue forecast column structure (matching colIds
            // and widths) so AG Grid's `alignedGrids` keeps the months in sync. The metric
            // column borrows the auto-group colId ('ag-Grid-AutoColumn') so it lines up
            // with the forecast grid's tree-data auto column.
            staticCols.push(
                {
                    headerComponent: () => (
                        <HeaderWithHelp
                            displayName="Metric"
                            helpText="Revenue Target: Monthly budget targets. Work in Hand: Combined actuals and forecasts. Variance: Difference between actual/forecast and target."
                        />
                    ),
                    colId: 'ag-Grid-AutoColumn',
                    field: 'jobNumber',
                    width: 160,
                    pinned: 'left',
                    cellClass: 'font-semibold text-foreground',
                },
                { field: 'jobName', headerName: '', width: 150, pinned: 'left', valueFormatter: () => '' },
                { headerName: '', colId: 'totalValue', width: 130, valueFormatter: () => '' },
                { headerName: '', colId: 'toDate', width: 130, valueFormatter: () => '' },
                { headerName: '', colId: 'remainingTotal', width: 140, valueFormatter: () => '' },
                {
                    headerComponent: () => (
                        <HeaderWithHelp displayName={fyLabel} helpText="Sum of all monthly values for the selected financial year" />
                    ),
                    colId: 'contractFY',
                    field: 'fyTotal',
                    width: 130,
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
                },
                {
                    headerComponent: () => (
                        <HeaderWithHelp
                            displayName="FY To Date"
                            helpText="Cumulative value through the last actual month for each metric (Budget, Work in Hand, Variance)."
                        />
                    ),
                    colId: 'fyToDate',
                    field: 'fyToDate',
                    width: 130,
                    type: 'numericColumn',
                    valueFormatter: (params) => formatCurrency(params.value),
                    cellClass: (params) => {
                        const data = params.data as UnifiedRow;
                        if (data?.rowType === 'variance') {
                            return params.value < 0
                                ? 'text-right font-semibold text-red-600 dark:text-red-400'
                                : 'text-right font-semibold text-emerald-600 dark:text-emerald-400';
                        }
                        return 'text-right font-semibold';
                    },
                },
                {
                    headerComponent: () => (
                        <HeaderWithHelp
                            displayName="Remaining FY"
                            helpText="Sum of remaining months (after the last actual month) for each metric."
                        />
                    ),
                    colId: 'remainingFY',
                    field: 'remainingFY',
                    width: 130,
                    type: 'numericColumn',
                    valueFormatter: (params) => formatCurrency(params.value),
                    cellClass: (params) => {
                        const data = params.data as UnifiedRow;
                        if (data?.rowType === 'variance') {
                            return params.value < 0
                                ? 'text-right font-semibold text-red-600 dark:text-red-400'
                                : 'text-right font-semibold text-emerald-600 dark:text-emerald-400';
                        }
                        return 'text-right font-semibold';
                    },
                },
            );
        } else {
            // Standard columns for revenue view (job number column is provided by autoGroupColumnDef)
            staticCols.push(
                {
                    headerComponent: () => <HeaderWithHelp displayName="Job Name" helpText="Name of the project or job" />,
                    field: 'jobName',
                    width: 150,
                    pinned: 'left',
                    // Visibility managed via AG Grid API in handleGridReady/useEffect
                    cellClass: (params) => {
                        const rowType = (params.data as UnifiedRow)?.rowType;
                        if (rowType === 'cost' || rowType === 'profit') {
                            return 'pl-4 text-muted-foreground text-sm italic';
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
            width: 140,
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

    // Tree data: revenue rows are roots; cost/profit rows hang off the same parentKey
    const getDataPath = useCallback((data: UnifiedRow) => data.path, []);

    // Custom renderer for pinned bottom rows (totals + labour). Pinned rows aren't tree
    // nodes, so we bypass agGroupCellRenderer to avoid its tree indent and render flat,
    // matching the alignment of leaf data rows.
    const PinnedTotalsRenderer = useCallback(
        (params: ICellRendererParams<UnifiedRow>) => {
            const d = params.data;
            if (!d) return null;
            if (d.isTotal && d.rowType === 'revenue') {
                return (
                    <span className="flex items-center font-bold">
                        <span className="text-muted-foreground hover:text-foreground mr-1 inline-flex size-4 items-center justify-center rounded">
                            {totalsExpanded ? (
                                <ChevronDown className="size-3.5" />
                            ) : (
                                <ChevronRight className="size-3.5" />
                            )}
                        </span>
                        {d.jobNumber}
                    </span>
                );
            }
            if (d.isTotal) return <span className="pl-5 font-bold">{d.jobNumber}</span>;
            if (d.rowType === 'labour') return d.jobNumber;
            return d.jobNumber;
        },
        [totalsExpanded],
    );

    // Auto group column — replaces the static jobNumber column. Renders job number for
    // revenue rows (clickable) and "Cost"/"Profit" labels for child rows. Pinned bottom
    // rows use a flat custom renderer to avoid the tree-indent padding.
    const autoGroupColumnDef = useMemo<ColDef>(
        () => ({
            headerName: 'Job Number',
            minWidth: 160,
            width: 160,
            pinned: 'left',
            sortable: true,
            cellClass: getPinnedCellClass,
            cellRendererSelector: (params) => {
                if (params.node.rowPinned) {
                    return { component: PinnedTotalsRenderer };
                }
                return { component: 'agGroupCellRenderer' };
            },
            cellRendererParams: {
                suppressCount: true,
                innerRenderer: (params: ICellRendererParams<UnifiedRow>) => {
                    const d = params.data;
                    if (!d) return null;
                    if (d.rowType === 'cost') return <span className="text-muted-foreground text-xs">Cost</span>;
                    if (d.rowType === 'profit') return <span className="text-xs">Profit</span>;
                    return d.jobNumber;
                },
            },
            onCellClicked: (params) => {
                const rowData = params.data as UnifiedRow | undefined;
                if (rowData?.isTotal && rowData.rowType === 'revenue') {
                    setTotalsExpanded((prev) => !prev);
                    return;
                }
                if (
                    rowData?.rowType === 'revenue' &&
                    !rowData.isTotal &&
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
        }),
        [PinnedTotalsRenderer],
    );

    // Get row ID for stable rendering
    const getRowId = useCallback((params: GetRowIdParams) => {
        return (params.data as UnifiedRow)?.id ?? `row-${params.level}-${rowIdCounter++}`;
    }, []);

    const expandAllRows = useCallback(() => {
        gridRef.current?.api?.expandAll();
    }, []);

    const collapseAllRows = useCallback(() => {
        gridRef.current?.api?.collapseAll();
    }, []);

    // Get row height (uniform across data and pinned rows)
    const getRowHeight = useCallback(() => 36, []);

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
                <div className="text-sm font-semibold text-foreground">
                    {viewMode === 'targets' ? 'Budget' : 'P&L Forecast'}
                </div>
                <div className="flex items-center gap-2">
                    {viewMode !== 'targets' && (
                        <>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button onClick={expandAllRows} variant="outline" size="icon" className="h-8 w-8">
                                        <ChevronsUpDown className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Expand all (show cost &amp; profit)</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button onClick={collapseAllRows} variant="outline" size="icon" className="h-8 w-8">
                                        <ChevronsDownUp className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Collapse all</TooltipContent>
                            </Tooltip>
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

            {/* Grid — targets uses an explicit height sized to its rows (header + 3 rows +
                horizontal scrollbar), since autoHeight leaves extra space under the rows
                when alignedGrids forces a horizontal scrollbar to match the P&L grid. */}
            <div
                className="bg-card overflow-hidden rounded-xl border shadow-sm"
                style={{
                    height:
                        viewMode === 'targets'
                            ? `${40 + rowData.length * 36 + 18}px`
                            : `${height}px`,
                }}
            >
                <AgGridReact
                    ref={gridRef}
                    alignedGrids={alignedGrids}
                    rowData={rowData}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    autoGroupColumnDef={viewMode !== 'targets' ? autoGroupColumnDef : undefined}
                    treeData={viewMode !== 'targets'}
                    getDataPath={viewMode !== 'targets' ? (getDataPath as any) : undefined}
                    groupDefaultExpanded={0}
                    domLayout="normal"
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
            {onHeightChange && viewMode !== 'targets' && (
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
