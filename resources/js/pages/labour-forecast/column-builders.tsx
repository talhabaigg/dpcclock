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
export const buildLabourForecastColumnDefs = (): ColDef[] => {
    return [
        {
            headerName: 'Job Name',
            field: 'name',
            pinned: 'left',
            width: 250,
            filter: true,
            sortable: true,
            headerClass: 'ag-left-aligned-header',
        },
        {
            headerName: 'Job Number',
            field: 'job_number',
            width: 120,
            filter: true,
            sortable: true,
        },
        {
            headerName: 'State',
            field: 'state',
            width: 80,
            filter: true,
            sortable: true,
        },
        {
            headerName: '',
            width: 100,
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

export const buildLabourForecastShowColumnDefs = (weeks: Week[]): ColDef[] => {
    const cols: ColDef[] = [
        {
            headerName: 'Work Type',
            field: 'workType',
            pinned: 'left',
            width: 180,
            editable: false,
            cellClass: (params) => (params.data?.isTotal ? 'font-bold' : ''),
        },
    ];

    weeks.forEach((week) => {
        cols.push({
            headerName: week.label,
            headerComponent: WeekHeader,
            field: week.key,
            width: 90,
            editable: (params) => !params.data?.isTotal,
            cellDataType: 'number',
            cellClass: (params) => (params.data?.isTotal ? 'font-bold text-center' : 'text-center'),
            valueParser: (params) => {
                const val = Number(params.newValue);
                return isNaN(val) ? 0 : Math.max(0, Math.floor(val));
            },
        });
    });

    return cols;
};
