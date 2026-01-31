import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { shadcnTheme } from '@/themes/ag-grid-theme';
import type { ColDef, GridReadyEvent, ColumnState, GetRowIdParams } from 'ag-grid-community';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { Download, RotateCcw } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';

import {
    transformToUnifiedRows,
    calculateTotalRow,
    calculateLabourRow,
    createTargetRows,
    type TurnoverRow,
    type UnifiedRow,
} from '../lib/data-transformer';
import {
    formatCurrency,
    formatMonthHeader,
    getMonthCellClass,
    getMonthHeaderClass,
    getRowClass,
    getPinnedCellClass,
    getValueCellClass,
} from '../lib/cell-styles';
import { ForecastStatusCell } from './ForecastStatusCell';
import { LabourCell } from './LabourCell';
import { ColumnVisibilityDropdown, type ColumnGroup } from './ColumnVisibilityDropdown';
import { ColumnPresetManager, type ColumnPreset } from './ColumnPresetManager';

ModuleRegistry.registerModules([AllCommunityModule]);

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
                months
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
                headerName: 'Metric',
                field: 'jobNumber',
                width: 160,
                pinned: 'left',
                cellClass: 'font-semibold text-slate-700 dark:text-slate-300',
            });

            staticCols.push({
                headerName: `Total ${fyLabel}`,
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
                    headerName: 'Type',
                    field: 'projectType',
                    width: 100,
                    pinned: 'left',
                    hide: hiddenColumns.has('projectType'),
                    cellClass: getPinnedCellClass,
                },
                {
                    headerName: 'Job Number',
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
                    headerName: 'Job Name',
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
                    headerName: 'Project Manager',
                    field: 'projectManager',
                    width: 140,
                    hide: hiddenColumns.has('projectManager'),
                },
                {
                    headerName: 'Over/Under Billing',
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
                    headerName: 'Forecast Status',
                    field: 'forecastStatus',
                    width: 130,
                    hide: hiddenColumns.has('forecastStatus'),
                    cellRenderer: (params: { data: UnifiedRow }) => {
                        const rowData = params.data;
                        if (
                            rowData?.rowType !== 'revenue' ||
                            rowData?.projectType === 'total' ||
                            rowData?.projectType === 'summary'
                        ) {
                            return null;
                        }
                        return <ForecastStatusCell value={rowData.forecastStatus} />;
                    },
                },
                {
                    headerName: 'To Date',
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
                    headerName: `Contract ${fyLabel}`,
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
                    headerName: 'Total Value',
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
                    headerName: `Remaining ${fyLabel}`,
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
                    headerName: 'Remaining Total',
                    field: 'remainingTotal',
                    width: 140,
                    hide: hiddenColumns.has('remainingTotal'),
                    valueFormatter: (params) => {
                        if ((params.data as UnifiedRow)?.rowType === 'labour') return '';
                        return formatCurrency(params.value);
                    },
                    type: 'numericColumn',
                    cellClass: getValueCellClass,
                }
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
        []
    );

    // Get row ID for stable rendering
    const getRowId = useCallback((params: GetRowIdParams) => {
        return (params.data as UnifiedRow)?.id ?? `row-${params.rowIndex}`;
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
    const handleGridReady = useCallback((params: GridReadyEvent) => {
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
    }, [updateCurrentColumnState]);

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
            if (next.has(columnId)) {
                next.delete(columnId);
            } else {
                next.add(columnId);
            }
            localStorage.setItem(`${COLUMN_STATE_KEY}-hidden`, JSON.stringify([...next]));
            return next;
        });
        // Mark as modified from preset
        setActivePresetId(null);
        localStorage.removeItem(`${COLUMN_STATE_KEY}-active-preset`);
    }, []);

    const handleShowAllColumns = useCallback(() => {
        setHiddenColumns(new Set());
        localStorage.removeItem(`${COLUMN_STATE_KEY}-hidden`);
    }, []);

    const handleHideAllColumns = useCallback(() => {
        const allIds = columnGroups.flatMap((g) => g.columns.map((c) => c.id));
        setHiddenColumns(new Set(allIds));
        localStorage.setItem(`${COLUMN_STATE_KEY}-hidden`, JSON.stringify(allIds));
    }, [columnGroups]);

    // Preset management
    const handleLoadPreset = useCallback((preset: ColumnPreset) => {
        // Apply column state
        if (preset.columnState && gridRef.current?.api) {
            gridRef.current.api.applyColumnState({ state: preset.columnState, applyOrder: true });
            localStorage.setItem(COLUMN_STATE_KEY, JSON.stringify(preset.columnState));
        }

        // Apply hidden columns
        const newHiddenColumns = new Set(preset.hiddenColumns);
        setHiddenColumns(newHiddenColumns);
        localStorage.setItem(`${COLUMN_STATE_KEY}-hidden`, JSON.stringify(preset.hiddenColumns));

        updateCurrentColumnState();
    }, [updateCurrentColumnState]);

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
        [height, onHeightChange]
    );

    return (
        <div className="space-y-2">
            {/* Toolbar */}
            <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {viewMode === 'targets'
                        ? 'Revenue Targets'
                        : viewMode === 'expanded'
                        ? 'Revenue, Cost & Profit'
                        : 'Revenue Forecast'}
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
                className="rounded-xl border bg-card overflow-hidden shadow-sm"
                style={{ height: `${height}px` }}
            >
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
