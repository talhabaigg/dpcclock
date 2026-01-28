import type { ColDef, IHeaderParams, ValueGetterParams } from 'ag-grid-community';
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
            cellRenderer: (params: ValueGetterParams) => {
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

export const buildLabourForecastShowColumnDefs = (weeks: Week[], selectedMonth?: string): ColDef[] => {
    const cols: ColDef[] = [
        {
            headerName: 'Work Type',
            field: 'workType',
            pinned: 'left',
            width: 180,
            editable: false,
            cellClass: (params) => {
                if (params.data?.isTotal && params.data?.isOvertimeRow) return 'font-bold text-orange-700 dark:text-orange-300';
                if (params.data?.isTotal) return 'font-bold';
                if (params.data?.isCostRow) return 'font-bold text-green-700 dark:text-green-300';
                if (params.data?.isOvertimeRow) return 'text-orange-600 dark:text-orange-400 italic';
                if (params.data?.isLeaveRow) return 'text-blue-600 dark:text-blue-400 italic';
                if (params.data?.isRdoRow) return 'text-purple-600 dark:text-purple-400 italic';
                if (params.data?.isPublicHolidayRow) return 'text-indigo-600 dark:text-indigo-400 italic';
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
                if (params.data?.isTotal && params.data?.isOvertimeRow) return 'font-bold text-center text-orange-700 dark:text-orange-300';
                if (params.data?.isTotal) return 'font-bold text-center';
                if (params.data?.isCostRow) return 'font-bold text-center text-green-700 dark:text-green-300 cursor-pointer hover:underline hover:text-green-800 dark:hover:text-green-200';
                if (params.data?.isOvertimeRow) return 'text-center text-orange-600 dark:text-orange-400';
                if (params.data?.isLeaveRow) return 'text-center text-blue-600 dark:text-blue-400 italic';
                if (params.data?.isRdoRow) return 'text-center text-purple-600 dark:text-purple-400 italic';
                if (params.data?.isPublicHolidayRow) return 'text-center text-indigo-600 dark:text-indigo-400 italic';
                return 'text-center';
            },
            valueParser: (params) => {
                const val = Number(params.newValue);
                if (isNaN(val)) return 0;
                // Allow decimals for headcount (e.g., 0.4 for 2 days)
                // For overtime rows, allow whole numbers only
                if (params.data?.isOvertimeRow) {
                    return Math.max(0, Math.floor(val));
                }
                // For headcount, allow 1 decimal place
                return Math.max(0, Math.round(val * 10) / 10);
            },
            valueFormatter: (params) => {
                if (params.data?.isCostRow) {
                    return formatCurrency(params.value || 0);
                }
                if (params.data?.isOvertimeRow) {
                    return params.value || 0;
                }
                // Show decimal only if needed
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
            if (params.data?.isTotal && params.data?.isOvertimeRow) return 'font-bold text-center text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/30';
            if (params.data?.isTotal) return 'font-bold text-center bg-indigo-50 dark:bg-indigo-900/30';
            if (params.data?.isCostRow) return 'font-bold text-center text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/40';
            if (params.data?.isOvertimeRow) return 'text-center text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20';
            return 'text-center bg-slate-50 dark:bg-slate-800/50';
        },
        headerClass: 'ag-right-aligned-header',
        valueGetter: (params) => {
            if (!params.data) return 0;

            // For cost row, sum the weekly costs
            if (params.data.isCostRow) {
                let total = 0;
                currentMonthWeeks.forEach((week) => {
                    total += Number(params.data[week.key]) || 0;
                });
                return total;
            }

            // For overtime rows, just sum the hours
            if (params.data.isOvertimeRow) {
                let totalOtHours = 0;
                currentMonthWeeks.forEach((week) => {
                    totalOtHours += Number(params.data[week.key]) || 0;
                });
                return totalOtHours;
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
        valueFormatter: (params) => {
            if (params.data?.isCostRow) {
                return formatCurrency(params.value || 0);
            }
            if (params.data?.isOvertimeRow) {
                return `${(params.value || 0).toLocaleString()} OT hrs`;
            }
            // Format hours with "hrs" suffix
            return `${(params.value || 0).toLocaleString()} hrs`;
        },
    });

    return cols;
};
