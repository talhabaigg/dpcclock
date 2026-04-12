/**
 * Forecast Grid Component
 *
 * PURPOSE:
 * Displays the main data grid for entering and viewing labour forecast data.
 * Uses AG Grid for a spreadsheet-like editing experience.
 *
 * FEATURES:
 * - Editable cells for headcount, overtime, leave, RDO, and PH hours
 * - Parent/child row structure (work types with expandable detail rows)
 * - Fill toolbar for quickly copying values across weeks
 * - Total rows for aggregated data
 * - Cost row showing weekly costs
 * - Colored row styling by row type
 *
 * ROW TYPES:
 * - Parent rows: Work types (headcount)
 * - Child rows: OT Hours, Leave Hours, RDO Hours, PH Not Worked Hours
 * - Total row: Sum of all headcount
 * - Cost row: Weekly cost calculation
 *
 * PARENT COMPONENT: show.tsx (LabourForecastShow)
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { CellClickedEvent, CellValueChangedEvent } from 'ag-grid-community';
import { shadcnDarkTheme, shadcnLightTheme } from '@/themes/ag-grid-theme';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { useCallback } from 'react';
import { buildLabourForecastShowColumnDefs } from '../column-builders';
import type { RowData, SelectedCell, Week } from '../types';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface ForecastGridProps {
    rowData: RowData[];
    weeks: Week[];
    selectedMonth: string;
    expandedParents: Set<string>;
    onToggleExpand: (parentId: string) => void;
    onExpandAll: () => void;
    onCollapseAll: () => void;
    isCalculatingCosts: boolean;
    // Cell selection for fill operations
    selectedCell: SelectedCell | null;
    onCellSelected: (cell: SelectedCell | null) => void;
    // Fill operations
    onFillRight: (weeksToFill: number | 'all') => void;
    // Cell editing
    onCellValueChanged: (event: CellValueChangedEvent) => void;
    // Week cost breakdown dialog
    onOpenWeekCostBreakdown: (weekEnding: string) => void;
    // Monthly cost breakdown dialog (triggered from Month Total cell)
    onOpenMonthlyCostBreakdown: () => void;
}

export const ForecastGrid = ({
    rowData,
    weeks,
    selectedMonth,
    expandedParents,
    onToggleExpand,
    onExpandAll,
    onCollapseAll,
    isCalculatingCosts,
    selectedCell,
    onCellSelected,
    onFillRight,
    onCellValueChanged,
    onOpenWeekCostBreakdown,
    onOpenMonthlyCostBreakdown,
}: ForecastGridProps) => {
    // Check if a parent row has child rows
    const hasChildRows = useCallback(() => {
        return true;
    }, []);

    // Row class for total and cost row styling.
    // Row type identity is conveyed via a left border accent + muted tint; aggregate rows use bg-muted.
    const getRowClass = useCallback((params: { data: RowData }) => {
        if (params.data?.isTotal && params.data?.isOrdinaryRow) {
            return 'bg-muted font-semibold text-emerald-700 dark:text-emerald-400';
        }
        if (params.data?.isTotal && params.data?.isOvertimeRow) {
            return 'bg-muted font-semibold text-orange-700 dark:text-orange-400';
        }
        if (params.data?.isTotal && params.data?.isLeaveRow) {
            return 'bg-muted font-semibold text-blue-700 dark:text-blue-400';
        }
        if (params.data?.isTotal && params.data?.isRdoRow) {
            return 'bg-muted font-semibold text-purple-700 dark:text-purple-400';
        }
        if (params.data?.isTotal && params.data?.isPublicHolidayRow) {
            return 'bg-muted font-semibold text-indigo-700 dark:text-indigo-400';
        }
        if (params.data?.isTotal) {
            return 'bg-muted font-semibold';
        }
        if (params.data?.isCostRow) {
            return 'bg-muted text-foreground font-semibold';
        }
        if (params.data?.isOrdinaryRow) {
            return 'text-emerald-700 dark:text-emerald-400 border-l-2 border-l-emerald-400/60';
        }
        if (params.data?.isOvertimeRow) {
            return 'text-orange-700 dark:text-orange-400 border-l-2 border-l-orange-400/60';
        }
        if (params.data?.isLeaveRow) {
            return 'text-blue-700 dark:text-blue-400 border-l-2 border-l-blue-400/60';
        }
        if (params.data?.isRdoRow) {
            return 'text-purple-700 dark:text-purple-400 border-l-2 border-l-purple-400/60';
        }
        if (params.data?.isPublicHolidayRow) {
            return 'text-indigo-700 dark:text-indigo-400 border-l-2 border-l-indigo-400/60';
        }
        return '';
    }, []);

    // Handle cell click
    const onCellClicked = useCallback(
        (event: CellClickedEvent) => {
            // Check if clicking on cost row cell in a week column
            if (event.data?.isCostRow && event.colDef.field?.startsWith('week_')) {
                const weekIndex = weeks.findIndex((w) => w.key === event.colDef.field);
                if (weekIndex !== -1) {
                    const week = weeks[weekIndex];
                    onOpenWeekCostBreakdown(week.weekEnding);
                }
                return;
            }

            // Check if clicking on cost row in the Month Total column
            if (event.data?.isCostRow && event.colDef.field === 'monthTotal') {
                onOpenMonthlyCostBreakdown();
                return;
            }

            // Only track week cells that are editable
            if (!event.colDef.field?.startsWith('week_')) {
                onCellSelected(null);
                return;
            }
            if (event.data?.isTotal || event.data?.isCostRow) {
                onCellSelected(null);
                return;
            }

            const weekIndex = weeks.findIndex((w) => w.key === event.colDef.field);
            if (weekIndex === -1) return;

            onCellSelected({
                rowId: event.data.id,
                field: event.colDef.field!,
                value: Number(event.value) || 0,
                weekIndex,
                workType: event.data.workType,
            });
        },
        [weeks, onCellSelected, onOpenWeekCostBreakdown, onOpenMonthlyCostBreakdown],
    );

    return (
        <Card className="gap-0 py-0">
            {/* Fill Toolbar */}
            {selectedCell && (
                <div className="border-border bg-muted/30 flex items-center gap-2 border-b px-4 py-2">
                    <span className="text-muted-foreground text-xs">
                        <span className="text-foreground font-medium">{selectedCell.workType}</span>
                        {' \u00B7 '}
                        Week {selectedCell.weekIndex + 1}
                        {' \u00B7 '}
                        Value:{' '}
                        <span className="text-foreground font-semibold">
                            {rowData.find((r) => r.id === selectedCell.rowId)?.[selectedCell.field] ?? 0}
                        </span>
                    </span>
                    <div className="bg-border mx-2 h-4 w-px" />
                    <span className="text-muted-foreground text-xs">Fill:</span>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs"
                        onClick={() => onFillRight(4)}
                        disabled={selectedCell.weekIndex + 4 > weeks.length}
                    >
                        4 weeks
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs"
                        onClick={() => onFillRight(8)}
                        disabled={selectedCell.weekIndex + 8 > weeks.length}
                    >
                        8 weeks
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs"
                        onClick={() => onFillRight(12)}
                        disabled={selectedCell.weekIndex + 12 > weeks.length}
                    >
                        12 weeks
                    </Button>
                    <Button size="sm" variant="default" className="h-6 px-2 text-xs" onClick={() => onFillRight('all')}>
                        To end
                    </Button>
                    <Button size="sm" variant="ghost" className="ml-auto h-6 px-2 text-xs" onClick={() => onCellSelected(null)}>
                        Clear
                    </Button>
                </div>
            )}

            {/* AG Grid */}
            <CardContent className="px-0">
                <div style={{ height: 350, width: '100%' }}>
                    <AgGridReact
                        rowData={rowData}
                        columnDefs={buildLabourForecastShowColumnDefs(weeks, selectedMonth, {
                            expandedParents,
                            onToggleExpand,
                            hasChildren: hasChildRows,
                            isCalculatingCosts,
                            onExpandAll,
                            onCollapseAll,
                            isAllExpanded: expandedParents.size > 0,
                        })}
                        theme={typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? shadcnDarkTheme : shadcnLightTheme}
                        onCellValueChanged={onCellValueChanged}
                        onCellClicked={onCellClicked}
                        defaultColDef={{
                            resizable: true,
                            sortable: false,
                            filter: false,
                        }}
                        headerHeight={50}
                        getRowId={(params) => params.data.id}
                        getRowClass={getRowClass}
                        singleClickEdit={true}
                        stopEditingWhenCellsLoseFocus={true}
                    />
                </div>
            </CardContent>
        </Card>
    );
};
