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
        minW: 2,
        minH: 1,
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
        defaultLayout: { x: 8, y: 0, w: 2, h: 3 },
    },
    {
        id: 'industrial-action',
        label: 'Industrial Action',
        minW: 2,
        minH: 2,
        defaultLayout: { x: 10, y: 0, w: 2, h: 3 },
    },
    {
        id: 'budget-weather',
        label: 'Budget vs Actual - Weather',
        minW: 2,
        minH: 2,
        defaultLayout: { x: 12, y: 0, w: 2, h: 3 },
    },
    {
        id: 'margin-health',
        label: 'Margin Health',
        minW: 1,
        minH: 1,
        defaultLayout: { x: 4, y: 2, w: 1, h: 1 },
    },
    {
        id: 'this-month',
        label: 'This Month',
        minW: 1,
        minH: 1,
        defaultLayout: { x: 4, y: 3, w: 1, h: 1 },
    },
    {
        id: 'po-commitments',
        label: 'PO Commitments',
        minW: 1,
        minH: 1,
        defaultLayout: { x: 4, y: 4, w: 2, h: 2 },
    },
    {
        id: 'sc-commitments',
        label: 'SC Commitments',
        minW: 1,
        minH: 1,
        defaultLayout: { x: 6, y: 4, w: 2, h: 2 },
    },
    {
        id: 'employees-on-site',
        label: 'Employees on Site',
        minW: 2,
        minH: 2,
        defaultLayout: { x: 10, y: 6, w: 6, h: 4 },
    },
    {
        id: 'claim-vs-production',
        label: 'Claim vs DPC',
        minW: 2,
        minH: 2,
        defaultLayout: { x: 6, y: 2, w: 2, h: 2 },
    },
    {
        id: 'project-income',
        label: 'Project Income',
        minW: 2,
        minH: 2,
        defaultLayout: { x: 0, y: 4, w: 4, h: 2 },
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
