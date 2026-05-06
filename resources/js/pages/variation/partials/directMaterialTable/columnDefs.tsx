import { CostCode } from '@/pages/purchasing/types';
import { ColDef } from 'ag-grid-community';
import { CostCodeSearchEditor } from '../variationLineTable/cellEditors/CostCodeSearchEditor';
import { CostTypeSearchEditor } from '../variationLineTable/cellEditors/CostTypeSearchEditor';
import { CostType } from '../variationLineTable/utils';
import { MaterialSearchEditor, MaterialSearchResult } from './cellEditors/MaterialSearchEditor';
import { SupplierSearchEditor } from './cellEditors/SupplierSearchEditor';
import { SupplierOption, currencyFormatter } from './utils';

const isDark = () => document.documentElement.classList.contains('dark');

interface CreateColumnsArgs {
    locationId: string;
    costCodes: CostCode[];
    costTypes: CostType[];
    suppliers: SupplierOption[];
    onPickMaterial: (rowIndex: number, item: MaterialSearchResult) => void;
    onPickSupplier: (rowIndex: number, supplier: SupplierOption) => void;
}

export const createDirectMaterialColumnDefs = ({
    locationId,
    costCodes,
    costTypes,
    suppliers,
    onPickMaterial,
    onPickSupplier,
}: CreateColumnsArgs): ColDef[] => {
    return [
        {
            field: 'supplier_id',
            headerName: 'Supplier',
            flex: 1,
            minWidth: 130,
            editable: true,
            cellEditor: SupplierSearchEditor,
            cellEditorParams: (params: any) => ({
                value: params.value ?? null,
                suppliers,
                onValueChange: params.onValueChange,
                api: params.api,
                onPick: onPickSupplier,
                rowIndex: params.node?.rowIndex,
            }),
            valueFormatter: (params) => {
                if (params.node?.rowPinned) return '';
                if (!params.value) return 'Pick supplier...';
                return params.data?.supplier_label || `#${params.value}`;
            },
            cellStyle: (params) => params.value ? {} : { color: isDark() ? '#52525b' : '#a1a1aa' },
        },
        {
            field: 'material_code',
            headerName: 'Material',
            flex: 1.8,
            minWidth: 180,
            editable: (params) => !!params.data?.supplier_id,
            cellEditor: MaterialSearchEditor,
            cellEditorPopup: true,
            cellEditorPopupPosition: 'under',
            cellEditorParams: (params: any) => ({
                locationId,
                supplierId: params.data?.supplier_id ?? null,
                onPick: onPickMaterial,
            }),
            valueFormatter: (params) => {
                if (params.node?.rowPinned) return params.value || '';
                if (!params.value) {
                    return params.data?.supplier_id ? 'Search material...' : 'Pick supplier first';
                }
                const desc = params.data?.material_description;
                return desc ? `${params.value} — ${desc}` : params.value;
            },
            cellStyle: (params) => {
                if (params.node?.rowPinned) return undefined;
                return params.value ? {} : { color: isDark() ? '#52525b' : '#a1a1aa' };
            },
        },
        {
            field: 'qty',
            headerName: 'Qty',
            flex: 0.5,
            minWidth: 60,
            maxWidth: 80,
            editable: true,
            cellEditor: 'agNumberCellEditor',
            cellEditorParams: { min: 0, precision: 2 },
            valueFormatter: (params) => {
                if (params.node?.rowPinned) return '';
                if (params.value == null) return '';
                return parseFloat(params.value).toFixed(2);
            },
            type: 'numericColumn',
        },
        {
            field: 'unit_cost',
            headerName: 'Unit $',
            flex: 0.7,
            minWidth: 80,
            maxWidth: 110,
            // Editable when a material is picked AND either (a) the item isn't
            // in the project price list, or (b) the price list price is $0.
            // Otherwise the price list is the source of truth and the cell is locked.
            editable: (params) => {
                if (params.node?.rowPinned) return false;
                if (!params.data?.material_item_id) return false;
                return params.data?.in_price_list === false || !Number(params.data?.unit_cost);
            },
            cellEditor: 'agNumberCellEditor',
            cellEditorParams: { min: 0, precision: 2 },
            valueFormatter: (params) => {
                if (params.node?.rowPinned) return '';
                return currencyFormatter(params);
            },
            type: 'numericColumn',
            cellStyle: (params) => {
                if (params.node?.rowPinned) return undefined;
                const inList = params.data?.in_price_list;
                const zero = !Number(params.data?.unit_cost);
                // Amber tint signals "you can override this — the price list
                // didn't have a usable value". Locked rows render normally.
                if (params.data?.material_item_id && (inList === false || zero)) {
                    return { color: '#b45309' };
                }
                return undefined;
            },
            tooltipValueGetter: (params) => {
                if (params.node?.rowPinned) return '';
                if (!params.data?.material_item_id) return '';
                if (params.data?.in_price_list === false) {
                    return 'Not in project price list — click to enter a unit cost';
                }
                if (!Number(params.data?.unit_cost)) {
                    return 'Price list price is $0 — click to override';
                }
                return '';
            },
        },
        {
            field: 'sell_markup_pct',
            headerName: 'Markup %',
            flex: 0.6,
            minWidth: 75,
            maxWidth: 100,
            editable: true,
            cellEditor: 'agNumberCellEditor',
            cellEditorParams: { min: 0, precision: 2 },
            valueFormatter: (params) => {
                if (params.node?.rowPinned) return '';
                if (params.value == null || params.value === '') return '';
                return `${parseFloat(params.value).toFixed(2)}%`;
            },
            type: 'numericColumn',
        },
        {
            field: 'sell_cost',
            headerName: 'Client Cost',
            flex: 0.8,
            minWidth: 100,
            maxWidth: 130,
            editable: false,
            type: 'numericColumn',
            valueFormatter: currencyFormatter,
            cellStyle: { fontWeight: 600 },
        },
        {
            field: 'cost_code',
            headerName: 'Cost Code',
            flex: 0.9,
            minWidth: 110,
            editable: true,
            cellEditor: CostCodeSearchEditor,
            cellEditorParams: (params: any) => ({
                value: params.value || '',
                costCodes,
                onValueChange: params.onValueChange,
                api: params.api,
            }),
            valueFormatter: (params) => {
                if (params.node?.rowPinned) return '';
                return params.value || 'Select…';
            },
            cellStyle: (params) => params.value ? {} : { color: isDark() ? '#52525b' : '#a1a1aa' },
        },
        {
            field: 'cost_type',
            headerName: 'Type',
            flex: 0.6,
            minWidth: 70,
            editable: true,
            cellEditor: CostTypeSearchEditor,
            cellEditorParams: (params: any) => ({
                value: params.value || '',
                costTypes,
                onValueChange: params.onValueChange,
                api: params.api,
            }),
            valueFormatter: (params) => {
                if (params.node?.rowPinned) return '';
                return params.value || 'Type…';
            },
            cellStyle: (params) => params.value ? {} : { color: isDark() ? '#52525b' : '#a1a1aa' },
        },
    ];
};
