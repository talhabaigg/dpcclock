import { CostCodeSelector } from '@/pages/purchasing/costCodeSelector';
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
            width: 70,
            maxWidth: 80,
            flex: 0,
            editable: false,
            sortable: false,
            suppressMovable: true,
            cellStyle: () => ({
                color: isDark() ? '#a1a1aa' : '#71717a',
                fontWeight: 500,
                fontSize: '12px',
            }),
        },
        {
            field: 'cost_item',
            headerName: 'Cost Item',
            flex: 2,
            minWidth: 200,
            editable: true,
            cellEditor: CostCodeSelector,
            cellEditorParams: (params: any) => ({
                value: params.value || '',
                costCodes: costCodes,
                onValueChange: params.onValueChange,
            }),
            valueFormatter: (params) => {
                if (!params.value) return 'Select Cost Item...';
                const costCode = costCodes.find((code) => code.code === params.value);
                return costCode ? `${costCode.code} - ${costCode.description}` : params.value;
            },
        },
        {
            field: 'cost_type',
            headerName: 'Cost Type',
            flex: 1.5,
            minWidth: 150,
            editable: true,
            cellEditor: CostTypeSearchEditor,
            cellEditorParams: (params: any) => ({
                value: params.value || '',
                costTypes: costTypes,
                onValueChange: params.onValueChange,
            }),
            valueFormatter: (params) => {
                if (!params.value) return 'Select Cost Type...';
                const costType = costTypes.find((type) => type.value === params.value);
                return costType ? costType.description : params.value;
            },
        },
        {
            field: 'description',
            headerName: 'Description',
            flex: 2.5,
            minWidth: 200,
            editable: true,
            cellEditor: 'agLargeTextCellEditor',
            cellEditorPopup: true,
            cellEditorParams: {
                maxLength: 500,
                rows: 3,
                cols: 50,
            },
            valueFormatter: (params) => {
                if (!params.value) return 'Enter Description...';
                return params.value;
            },
            wrapText: true,
            autoHeight: false,
            cellClass: 'ag-cell-wrap-text',
        },
        {
            field: 'qty',
            headerName: 'Qty',
            flex: 0.8,
            minWidth: 90,
            maxWidth: 120,
            editable: (params) => params.data?.cost_type !== 'REV',
            cellEditor: 'agNumberCellEditor',
            cellEditorParams: {
                min: 0,
                precision: 2,
            },
            valueFormatter: (params) => {
                if (params.value == null) return '';
                return parseFloat(params.value).toFixed(2);
            },
            type: 'numericColumn',
        },
        {
            field: 'unit_cost',
            headerName: 'Unit Cost',
            flex: 1,
            minWidth: 110,
            maxWidth: 140,
            editable: (params) => params.data?.cost_type !== 'REV',
            cellEditor: 'agNumberCellEditor',
            cellEditorParams: {
                min: 0,
                precision: 2,
            },
            valueFormatter: currencyFormatter,
            type: 'numericColumn',
        },
        {
            field: 'waste_ratio',
            headerName: 'Waste %',
            flex: 0.7,
            minWidth: 85,
            maxWidth: 100,
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
            headerName: 'Total Cost',
            flex: 1,
            minWidth: 120,
            maxWidth: 150,
            editable: (params) => params.data?.cost_type !== 'REV',
            cellEditor: 'agNumberCellEditor',
            cellEditorParams: {
                min: 0,
                precision: 2,
            },
            valueFormatter: currencyFormatter,
            type: 'numericColumn',
            cellStyle: { fontWeight: 600 },
        },
        {
            field: 'revenue',
            headerName: 'Revenue',
            flex: 1,
            minWidth: 120,
            maxWidth: 150,
            editable: (params) => params.data?.cost_type === 'REV',
            cellEditor: 'agNumberCellEditor',
            cellEditorParams: {
                min: 0,
                precision: 2,
            },
            valueFormatter: currencyFormatter,
            type: 'numericColumn',
            cellStyle: (params) => {
                if (params.data?.cost_type === 'REV') {
                    return {
                        backgroundColor: isDark() ? '#052e16' : '#f0fdf4',
                        color: isDark() ? '#4ade80' : '#16a34a',
                        fontWeight: 600,
                    };
                }
                return {};
            },
        },
        {
            field: 'actions',
            headerName: '',
            width: 60,
            flex: 0,
            editable: false,
            sortable: false,
            filter: false,
            cellRenderer: ActionsCellRenderer,
            cellRendererParams: {
                onDelete: onDeleteRow,
                canDelete: canDelete,
            },
            suppressMovable: true,
        },
    ];
};
