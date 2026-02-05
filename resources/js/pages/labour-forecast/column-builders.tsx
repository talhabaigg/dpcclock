import type { ColDef, IHeaderParams, ValueGetterParams, ICellRendererParams } from 'ag-grid-community';
import type { Week } from './types';
const WeekHeader = (props: IHeaderParams) => {
    return (
        <div className="flex flex-col items-center justify-center leading-tight">
            <span className="text-xs">W.E</span>
            <span className="text-xs font-semibold">{props.displayName}</span>
        </div>
    );
};
// Status badge renderer with improved styling
const StatusBadge = ({ status }: { status: string | null }) => {
    const config: Record<string, { label: string; className: string }> = {
        not_started: {
            label: 'Not Started',
            className: 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
        },
        draft: {
            label: 'Draft',
            className: 'border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
        },
        submitted: {
            label: 'Submitted',
            className: 'border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
        },
        approved: {
            label: 'Approved',
            className: 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
        },
        rejected: {
            label: 'Rejected',
            className: 'border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300',
        },
    };

    const statusKey = status || 'not_started';
    const { label, className } = config[statusKey] || config.not_started;

    return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>{label}</span>;
};

export const buildLabourForecastColumnDefs = (onCostClick?: (locationId: number, locationName: string) => void): ColDef[] => {
    return [
        {
            headerName: 'Job Name',
            field: 'name',
            minWidth: 200,
            flex: 2,
            filter: true,
            sortable: true,
            headerClass: 'ag-left-aligned-header',
        },
        {
            headerName: 'Job Number',
            field: 'job_number',
            minWidth: 110,
            flex: 1,
            filter: true,
            sortable: true,
        },
        {
            headerName: 'State',
            field: 'state',
            minWidth: 70,
            width: 80,
            filter: true,
            sortable: true,
        },
        {
            headerName: 'Status',
            field: 'forecast_status',
            minWidth: 100,
            width: 120,
            filter: true,
            sortable: true,
            cellRenderer: (params: ValueGetterParams) => {
                return <StatusBadge status={params.data?.forecast_status} />;
            },
        },
        {
            headerName: 'Headcount',
            field: 'current_week_headcount',
            minWidth: 100,
            width: 110,
            filter: true,
            sortable: true,
            cellClass: 'text-right',
            headerClass: 'ag-right-aligned-header',
            valueFormatter: (params) => {
                const value = params.value;
                if (!value) return '-';
                return value.toLocaleString();
            },
        },
        {
            headerName: 'Week Cost',
            field: 'current_week_cost',
            minWidth: 110,
            width: 130,
            filter: true,
            sortable: true,
            cellClass: 'text-right font-medium',
            headerClass: 'ag-right-aligned-header',
            cellRenderer: (params: ICellRendererParams) => {
                const value = params.value;
                const locationId = params.data?.id;
                const locationName = params.data?.name;

                if (!value) return '-';

                return (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onCostClick && locationId && locationName) {
                                onCostClick(locationId, locationName);
                            }
                        }}
                        className="cursor-pointer font-medium text-green-700 hover:text-green-800 hover:underline dark:text-green-400 dark:hover:text-green-300"
                        title="Click to view cost breakdown"
                    >
                        {formatCurrency(value)}
                    </button>
                );
            },
        },
        {
            headerName: '',
            minWidth: 100,
            width: 110,
            filter: false,
            sortable: false,
            cellRenderer: (params: ValueGetterParams) => {
                const id = params.data?.id;
                if (!id) return '';
                return (
                    <a
                        href={`/location/${id}/labour-forecast/show`}
                        className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                    >
                        Open
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </a>
                );
            },
            cellClass: 'flex items-center justify-end pr-4',
        },
    ];
};

// Currency formatter for cost row
const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

// Props for expand/collapse functionality
interface ExpandCollapseProps {
    expandedParents: Set<string>;
    onToggleExpand: (parentId: string) => void;
    hasChildren: (parentId: string) => boolean;
    isCalculatingCosts?: boolean;
    onExpandAll?: () => void;
    onCollapseAll?: () => void;
    isAllExpanded?: boolean;
}

// Custom header for Work Type column with expand/collapse all buttons
const WorkTypeHeader = ({ onExpandAll, onCollapseAll, isAllExpanded }: { onExpandAll?: () => void; onCollapseAll?: () => void; isAllExpanded?: boolean }) => {
    return (
        <div className="flex w-full items-center justify-between">
            <span>Work Type</span>
            {onExpandAll && onCollapseAll && (
                <div className="flex gap-1">
                    {isAllExpanded ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onCollapseAll();
                            }}
                            className="rounded p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-600 dark:hover:text-slate-300"
                            title="Collapse all"
                        >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                            </svg>
                        </button>
                    ) : (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onExpandAll();
                            }}
                            className="rounded p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-600 dark:hover:text-slate-300"
                            title="Expand all"
                        >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export const buildLabourForecastShowColumnDefs = (
    weeks: Week[],
    selectedMonth?: string,
    expandCollapseProps?: ExpandCollapseProps
): ColDef[] => {
    const isCalculatingCosts = expandCollapseProps?.isCalculatingCosts ?? false;
    const cols: ColDef[] = [
        {
            headerName: 'Work Type',
            field: 'workType',
            pinned: 'left',
            width: 200,
            editable: false,
            headerComponent: () => (
                <WorkTypeHeader
                    onExpandAll={expandCollapseProps?.onExpandAll}
                    onCollapseAll={expandCollapseProps?.onCollapseAll}
                    isAllExpanded={expandCollapseProps?.isAllExpanded}
                />
            ),
            cellRenderer: (params: ValueGetterParams) => {
                const data = params.data;
                if (!data) return null;

                // For child rows (including total children), show indented with colored indicator
                if (data.isChildRow) {
                    let colorClass = 'bg-slate-400';
                    if (data.isOrdinaryRow) colorClass = 'bg-emerald-500';
                    else if (data.isOvertimeRow) colorClass = 'bg-orange-500';
                    else if (data.isLeaveRow) colorClass = 'bg-blue-500';
                    else if (data.isRdoRow) colorClass = 'bg-purple-500';
                    else if (data.isPublicHolidayRow) colorClass = 'bg-indigo-500';

                    // For total children, use bold styling; for ordinary row use normal weight
                    const textClass = data.isTotal ? 'font-semibold' : data.isOrdinaryRow ? 'font-medium' : 'italic';

                    return (
                        <div className="flex items-center pl-6">
                            <span className={`mr-2 h-2 w-2 rounded-full ${colorClass}`} />
                            <span className={textClass}>{data.workType}</span>
                        </div>
                    );
                }

                // For cost row only, just show the text
                if (data.isCostRow) {
                    return <span>{data.workType}</span>;
                }

                // For Total parent row (id === 'total') or regular parent rows, show expand/collapse icon
                const isExpandableRow = data.id === 'total' || (!data.isTotal && !data.isCostRow);

                if (isExpandableRow) {
                    const isExpanded = expandCollapseProps?.expandedParents.has(data.id);
                    const hasChildren = expandCollapseProps?.hasChildren(data.id) ?? true;

                    if (!hasChildren) {
                        return <span className={data.isTotal ? 'font-bold' : ''}>{data.workType}</span>;
                    }

                    return (
                        <div
                            className="flex cursor-pointer items-center"
                            onClick={(e) => {
                                e.stopPropagation();
                                expandCollapseProps?.onToggleExpand(data.id);
                            }}
                        >
                            <span className="mr-1 flex h-4 w-4 items-center justify-center text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                                {isExpanded ? (
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                ) : (
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                )}
                            </span>
                            <span className={data.isTotal ? 'font-bold' : ''}>{data.workType}</span>
                        </div>
                    );
                }

                // Fallback for any other rows
                return <span>{data.workType}</span>;
            },
            cellClass: (params) => {
                if (params.data?.isTotal && params.data?.isOrdinaryRow) return 'font-bold text-emerald-700 dark:text-emerald-300';
                if (params.data?.isTotal && params.data?.isOvertimeRow) return 'font-bold text-orange-700 dark:text-orange-300';
                if (params.data?.isTotal && params.data?.isLeaveRow) return 'font-bold text-blue-700 dark:text-blue-300';
                if (params.data?.isTotal && params.data?.isRdoRow) return 'font-bold text-purple-700 dark:text-purple-300';
                if (params.data?.isTotal && params.data?.isPublicHolidayRow) return 'font-bold text-indigo-700 dark:text-indigo-300';
                if (params.data?.isTotal) return 'font-bold';
                if (params.data?.isCostRow) return 'font-bold text-green-700 dark:text-green-300';
                if (params.data?.isOrdinaryRow) return 'text-emerald-600 dark:text-emerald-400';
                if (params.data?.isOvertimeRow) return 'text-orange-600 dark:text-orange-400';
                if (params.data?.isLeaveRow) return 'text-blue-600 dark:text-blue-400';
                if (params.data?.isRdoRow) return 'text-purple-600 dark:text-purple-400';
                if (params.data?.isPublicHolidayRow) return 'text-indigo-600 dark:text-indigo-400';
                return '';
            },
        },
    ];

    weeks.forEach((week) => {
        cols.push({
            headerName: week.label,
            headerComponent: WeekHeader,
            field: week.key,
            width: 90,
            editable: (params) => !params.data?.isTotal && !params.data?.isCostRow,
            cellDataType: 'number',
            cellClass: (params) => {
                if (params.data?.isTotal && params.data?.isOrdinaryRow) return 'font-bold text-center text-emerald-700 dark:text-emerald-300';
                if (params.data?.isTotal && params.data?.isOvertimeRow) return 'font-bold text-center text-orange-700 dark:text-orange-300';
                if (params.data?.isTotal) return 'font-bold text-center';
                if (params.data?.isCostRow) return 'font-bold text-center text-green-700 dark:text-green-300 cursor-pointer hover:underline hover:text-green-800 dark:hover:text-green-200';
                if (params.data?.isOrdinaryRow) return 'text-center text-emerald-600 dark:text-emerald-400 font-medium';
                if (params.data?.isOvertimeRow) return 'text-center text-orange-600 dark:text-orange-400';
                if (params.data?.isLeaveRow) return 'text-center text-blue-600 dark:text-blue-400 italic';
                if (params.data?.isRdoRow) return 'text-center text-purple-600 dark:text-purple-400 italic';
                if (params.data?.isPublicHolidayRow) return 'text-center text-indigo-600 dark:text-indigo-400 italic';
                return 'text-center';
            },
            valueParser: (params) => {
                const val = Number(params.newValue);
                if (isNaN(val)) return 0;
                // For overtime rows, allow whole numbers only
                if (params.data?.isOvertimeRow) {
                    return Math.max(0, Math.floor(val));
                }
                // For ordinary hours rows, allow whole numbers
                if (params.data?.isOrdinaryRow) {
                    return Math.max(0, Math.round(val));
                }
                // For headcount, allow 1 decimal place
                return Math.max(0, Math.round(val * 10) / 10);
            },
            cellRenderer: (params: ICellRendererParams) => {
                // Show skeleton for cost row when calculating
                if (params.data?.isCostRow && isCalculatingCosts) {
                    return (
                        <div className="flex h-full items-center justify-center">
                            <div className="h-4 w-14 animate-pulse rounded bg-green-200 dark:bg-green-800" />
                        </div>
                    );
                }
                // For cost row, show formatted currency
                if (params.data?.isCostRow) {
                    return formatCurrency(params.value || 0);
                }
                // For other rows, use default formatting
                if (params.data?.isOvertimeRow) {
                    return params.value || 0;
                }
                const val = params.value || 0;
                return val % 1 === 0 ? val.toString() : val.toFixed(1);
            },
        });
    });

    // Filter weeks to only those in the selected month for the Month Total column
    const currentMonthWeeks = selectedMonth
        ? weeks.filter((week) => {
              // weekEnding is in YYYY-MM-DD format, extract YYYY-MM
              const weekMonth = week.weekEnding.substring(0, 7);
              return weekMonth === selectedMonth;
          })
        : weeks;

    // Add Month Total column at the end - shows HOURS for work types, COST for cost row
    cols.push({
        headerName: 'Month Total',
        field: 'monthTotal',
        pinned: 'right',
        width: 120,
        editable: false,
        cellClass: (params) => {
            if (params.data?.isTotal && params.data?.isOrdinaryRow) return 'font-bold text-center text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30';
            if (params.data?.isTotal && params.data?.isOvertimeRow) return 'font-bold text-center text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/30';
            if (params.data?.isTotal && params.data?.isLeaveRow) return 'font-bold text-center text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30';
            if (params.data?.isTotal && params.data?.isRdoRow) return 'font-bold text-center text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/30';
            if (params.data?.isTotal && params.data?.isPublicHolidayRow) return 'font-bold text-center text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/30';
            if (params.data?.isTotal) return 'font-bold text-center bg-indigo-50 dark:bg-indigo-900/30';
            if (params.data?.isCostRow) return 'font-bold text-center text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/40';
            if (params.data?.isOrdinaryRow) return 'text-center text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 font-medium';
            if (params.data?.isOvertimeRow) return 'text-center text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20';
            if (params.data?.isLeaveRow) return 'text-center text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
            if (params.data?.isRdoRow) return 'text-center text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20';
            if (params.data?.isPublicHolidayRow) return 'text-center text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20';
            return 'text-center bg-slate-50 dark:bg-slate-800/50';
        },
        headerClass: 'ag-right-aligned-header',
        valueGetter: (params) => {
            if (!params.data) return 0;

            // For cost row, sum the weekly costs for the selected month
            if (params.data.isCostRow) {
                let total = 0;
                currentMonthWeeks.forEach((week) => {
                    total += Number(params.data[week.key]) || 0;
                });
                return total;
            }

            // For ordinary, overtime, leave, RDO, or PH rows, just sum the hours directly
            if (params.data.isOrdinaryRow || params.data.isOvertimeRow || params.data.isLeaveRow || params.data.isRdoRow || params.data.isPublicHolidayRow) {
                let totalHours = 0;
                currentMonthWeeks.forEach((week) => {
                    totalHours += Number(params.data[week.key]) || 0;
                });
                return totalHours;
            }

            // For work type rows and total row, calculate hours (headcount × hoursPerWeek)
            const hoursPerWeek = params.data.hoursPerWeek || 40; // default to 40 if not set
            let totalHours = 0;
            currentMonthWeeks.forEach((week) => {
                const headcount = Number(params.data[week.key]) || 0;
                totalHours += headcount * hoursPerWeek;
            });
            return totalHours;
        },
        cellRenderer: (params: ICellRendererParams) => {
            // Show skeleton for cost row when calculating
            if (params.data?.isCostRow && isCalculatingCosts) {
                return (
                    <div className="flex h-full items-center justify-center">
                        <div className="h-4 w-16 animate-pulse rounded bg-green-200 dark:bg-green-800" />
                    </div>
                );
            }
            if (params.data?.isCostRow) {
                return formatCurrency(params.value || 0);
            }
            if (params.data?.isOrdinaryRow) {
                return `${(params.value || 0).toLocaleString()} hrs`;
            }
            if (params.data?.isOvertimeRow) {
                return `${(params.value || 0).toLocaleString()} OT hrs`;
            }
            if (params.data?.isLeaveRow) {
                return `${(params.value || 0).toLocaleString()} Lv hrs`;
            }
            if (params.data?.isRdoRow) {
                return `${(params.value || 0).toLocaleString()} RDO hrs`;
            }
            if (params.data?.isPublicHolidayRow) {
                return `${(params.value || 0).toLocaleString()} PH hrs`;
            }
            // Format hours with "hrs" suffix
            return `${(params.value || 0).toLocaleString()} hrs`;
        },
    });

    return cols;
};
