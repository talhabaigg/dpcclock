import { GridOptions } from 'ag-grid-community';
import { shadcnTheme } from '@/themes/ag-grid-theme';

export const defaultColDef = {
    resizable: true,
    sortable: true,
    filter: false,
    editable: false,
    flex: 1,
    minWidth: 100,
};

export const getGridOptions = (): GridOptions => {
    return {
        theme: shadcnTheme,
        defaultColDef,
        rowSelection: {
            mode: 'multiRow',
            checkboxes: true,
            headerCheckbox: true,
            enableClickSelection: false,
        },
        singleClickEdit: true,
        stopEditingWhenCellsLoseFocus: true,
        enableCellTextSelection: true,
        ensureDomOrder: true,
        animateRows: true,
        rowHeight: 52,
        headerHeight: 44,
        suppressMenuHide: true,
        suppressContextMenu: false,
        enableBrowserTooltips: true,
        autoSizeStrategy: {
            type: 'fitGridWidth',
            defaultMinWidth: 100,
        },
        suppressHorizontalScroll: false,
    };
};

export const getRowStyle = (params: any) => {
    // Highlight REV rows with green background
    if (params.data?.cost_type === 'REV') {
        return {
            backgroundColor: '#f0fdf4',
        };
    }
    return undefined;
};
