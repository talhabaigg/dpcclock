export interface LayoutItem {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    minH?: number;
    static?: boolean;
}

export interface WidgetDefinition {
    id: string;
    label: string;
    minW: number;
    minH: number;
    defaultLayout: { x: number; y: number; w: number; h: number };
}

export const GRID_COLS = 14;
export const GRID_ROWS = 10;
export const GRID_MARGIN: [number, number] = [8, 8];

export const WIDGET_REGISTRY: WidgetDefinition[] = [
    {
        id: 'project-details',
        label: 'Project Details',
        minW: 3,
        minH: 2,
        defaultLayout: { x: 0, y: 0, w: 4, h: 2 },
    },
    {
        id: 'variations',
        label: 'Variations',
        minW: 3,
        minH: 2,
        defaultLayout: { x: 4, y: 0, w: 4, h: 2 },
    },
    {
        id: 'budget-safety',
        label: 'Budget vs Actual - Safety',
        minW: 2,
        minH: 2,
        defaultLayout: { x: 8, y: 0, w: 2, h: 2 },
    },
    {
        id: 'industrial-action',
        label: 'Industrial Action',
        minW: 2,
        minH: 2,
        defaultLayout: { x: 10, y: 0, w: 2, h: 2 },
    },
    {
        id: 'budget-weather',
        label: 'Budget vs Actual - Weather',
        minW: 2,
        minH: 2,
        defaultLayout: { x: 12, y: 0, w: 2, h: 2 },
    },
    {
        id: 'other-items',
        label: 'Other Items',
        minW: 3,
        minH: 2,
        defaultLayout: { x: 0, y: 2, w: 4, h: 2 },
    },
    {
        id: 'vendor-commitments',
        label: 'Vendor Commitments',
        minW: 3,
        minH: 2,
        defaultLayout: { x: 4, y: 2, w: 4, h: 2 },
    },
    {
        id: 'employees-on-site',
        label: 'Employees on Site',
        minW: 2,
        minH: 2,
        defaultLayout: { x: 8, y: 2, w: 6, h: 8 },
    },
    {
        id: 'project-income',
        label: 'Project Income',
        minW: 2,
        minH: 2,
        defaultLayout: { x: 0, y: 4, w: 8, h: 2 },
    },
    {
        id: 'labour-budget',
        label: 'Budget Utilization',
        minW: 2,
        minH: 2,
        defaultLayout: { x: 0, y: 6, w: 8, h: 4 },
    },
];

export function getDefaultLayout(): LayoutItem[] {
    return WIDGET_REGISTRY.map((w) => ({
        i: w.id,
        ...w.defaultLayout,
        minW: w.minW,
        minH: w.minH,
    }));
}
