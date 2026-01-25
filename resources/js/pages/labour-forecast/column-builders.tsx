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
// Status badge renderer
const StatusBadge = ({ status }: { status: string | null }) => {
    if (!status) {
        return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-400">Not Started</span>;
    }
    const styles: Record<string, string> = {
        draft: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
        submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
        approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
        rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    };
    return (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || styles.draft}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
    );
};

export const buildLabourForecastColumnDefs = (): ColDef[] => {
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
            cellClass: 'text-right font-medium text-green-700 dark:text-green-400',
            headerClass: 'ag-right-aligned-header',
            valueFormatter: (params) => {
                const value = params.value;
                if (!value) return '-';
                return formatCurrency(value);
            },
        },
        {
            headerName: '',
            minWidth: 80,
            width: 90,
            filter: false,
            sortable: false,
            cellRenderer: (params: ValueGetterParams) => {
                const id = params.data?.id;
                if (!id) return '';
                return (
                    <a href={`/location/${id}/labour-forecast/show`} className="text-blue-600 underline hover:text-blue-800">
                        Open
                    </a>
                );
            },
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

export const buildLabourForecastShowColumnDefs = (weeks: Week[]): ColDef[] => {
    const cols: ColDef[] = [
        {
            headerName: 'Work Type',
            field: 'workType',
            pinned: 'left',
            width: 180,
            editable: false,
            cellClass: (params) => {
                if (params.data?.isTotal) return 'font-bold';
                if (params.data?.isCostRow) return 'font-bold text-green-700 dark:text-green-300';
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
                if (params.data?.isTotal) return 'font-bold text-center';
                if (params.data?.isCostRow) return 'font-bold text-center text-green-700 dark:text-green-300';
                return 'text-center';
            },
            valueParser: (params) => {
                const val = Number(params.newValue);
                return isNaN(val) ? 0 : Math.max(0, Math.floor(val));
            },
            valueFormatter: (params) => {
                if (params.data?.isCostRow) {
                    return formatCurrency(params.value || 0);
                }
                return params.value;
            },
        });
    });

    return cols;
};
