import { CostCodeSearchEditor } from './cellEditors/CostCodeSearchEditor';
import { CostCode } from '@/pages/purchasing/types';
import { ColDef } from 'ag-grid-community';
import { CostTypeSearchEditor } from './cellEditors/CostTypeSearchEditor';
import { ActionsCellRenderer } from './cellRenderers/ActionsCellRenderer';
import { CostType, currencyFormatter } from './utils';

const isDark = () => document.documentElement.classList.contains('dark');

export const createColumnDefs = (costCodes: CostCode[], costTypes: CostType[], onDeleteRow: (data: any) => void, canDelete: boolean): ColDef[] => {
    return [
        {
            field: 'line_number',
            headerName: '#',
            width: 45,
            maxWidth: 50,
            flex: 0,
            editable: false,
            sortable: false,
            suppressMovable: true,
            cellStyle: () => ({
                color: isDark() ? '#a1a1aa' : '#71717a',
                fontWeight: 500,
            }),
        },
        {
            field: 'cost_item',
            headerName: 'Cost Item',
            flex: 1.5,
            minWidth: 120,
            editable: true,
            cellEditor: CostCodeSearchEditor,
            cellEditorParams: (params: any) => ({
                value: params.value || '',
                costCodes: costCodes,
                onValueChange: params.onValueChange,
            }),
            valueFormatter: (params) => {
                if (!params.value) return 'Select cost item...';
                const costCode = costCodes.find((code) => code.code === params.value);
                return costCode ? `${costCode.code} - ${costCode.description}` : params.value;
            },
            cellStyle: (params) => params.value ? {} : { color: isDark() ? '#52525b' : '#a1a1aa' },
        },
        {
            field: 'cost_type',
            headerName: 'Type',
            flex: 0.8,
            minWidth: 70,
            editable: true,
            cellEditor: CostTypeSearchEditor,
            cellEditorParams: (params: any) => ({
                value: params.value || '',
                costTypes: costTypes,
                onValueChange: params.onValueChange,
            }),
            valueFormatter: (params) => {
                if (!params.value) return 'Type...';
                return params.value;
            },
            cellStyle: (params) => params.value ? {} : { color: isDark() ? '#52525b' : '#a1a1aa' },
        },
        {
            field: 'description',
            headerName: 'Description',
            flex: 2,
            minWidth: 140,
            editable: true,
            cellEditor: 'agTextCellEditor',
            valueFormatter: (params) => params.value || 'Enter description...',
            cellStyle: (params) => params.value ? {} : { color: isDark() ? '#52525b' : '#a1a1aa' },
            wrapText: false,
            autoHeight: false,
        },
        {
            field: 'qty',
            headerName: 'Qty',
            flex: 0.6,
            minWidth: 60,
            maxWidth: 80,
            editable: (params) => params.data?.cost_type !== 'REV',
            cellEditor: 'agNumberCellEditor',
            cellEditorParams: { min: 0, precision: 2 },
            valueFormatter: (params) => {
                if (params.value == null) return '';
                return parseFloat(params.value).toFixed(2);
            },
            type: 'numericColumn',
        },
        {
            field: 'unit_cost',
            headerName: 'Unit $',
            flex: 0.8,
            minWidth: 75,
            maxWidth: 100,
            editable: (params) => params.data?.cost_type !== 'REV',
            cellEditor: 'agNumberCellEditor',
            cellEditorParams: { min: 0, precision: 2 },
            valueFormatter: currencyFormatter,
            type: 'numericColumn',
        },
        {
            field: 'waste_ratio',
            headerName: 'W%',
            flex: 0.5,
            minWidth: 50,
            maxWidth: 65,
            editable: false,
            valueFormatter: (params) => {
                if (params.value == null || params.value === '' || params.value === 0) return '-';
                return `${params.value}%`;
            },
            type: 'numericColumn',
            cellStyle: () => ({
                color: isDark() ? '#a1a1aa' : '#71717a',
            }),
        },
        {
            field: 'total_cost',
            headerName: 'Total',
            flex: 0.8,
            minWidth: 80,
            maxWidth: 110,
            editable: (params) => params.data?.cost_type !== 'REV',
            cellEditor: 'agNumberCellEditor',
            cellEditorParams: { min: 0, precision: 2 },
            valueFormatter: currencyFormatter,
            type: 'numericColumn',
            cellStyle: { fontWeight: 600 },
        },
        {
            field: 'revenue',
            headerName: 'Revenue',
            flex: 0.8,
            minWidth: 80,
            maxWidth: 110,
            editable: (params) => params.data?.cost_type === 'REV',
            cellEditor: 'agNumberCellEditor',
            cellEditorParams: { min: 0, precision: 2 },
            valueFormatter: currencyFormatter,
            type: 'numericColumn',
        },
        {
            field: 'actions',
            headerName: '',
            width: 40,
            flex: 0,
            editable: false,
            sortable: false,
            filter: false,
            cellRenderer: ActionsCellRenderer,
            cellRendererParams: {
                onDelete: onDeleteRow,
                canDelete: canDelete,
            },
            cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
            suppressMovable: true,
        },
    ];
};
