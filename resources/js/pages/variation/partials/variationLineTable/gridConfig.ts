import { GridOptions } from 'ag-grid-community';

const isDark = () => document.documentElement.classList.contains('dark');

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
        defaultColDef,
        rowSelection: {
            mode: 'multiRow',
            checkboxes: true,
            headerCheckbox: true,
            enableClickSelection: false,
        },
        singleClickEdit: true,
        enableCellTextSelection: true,
        ensureDomOrder: true,
        animateRows: true,
        rowHeight: 44,
        headerHeight: 40,
        suppressMenuHide: true,
        suppressContextMenu: false,
        enableBrowserTooltips: true,
        suppressHorizontalScroll: false,
        popupParent: document.body,
    };
};

export const getRowStyle = (params: any) => {
    if (params.data?.cost_type === 'REV') {
        return {
            backgroundColor: isDark() ? '#052e1680' : '#f0fdf4',
        };
    }
    return undefined;
};
