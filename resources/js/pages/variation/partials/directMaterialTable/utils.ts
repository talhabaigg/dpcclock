export interface DirectMaterialItem {
    id?: number;
    line_number: number;
    sort_order?: number;
    supplier_id: number | null;
    supplier_label: string;
    material_item_id: number | null;
    material_code: string;
    material_description: string;
    description: string;
    qty: number;
    unit_cost: number;
    sell_markup_pct: number;
    /** Per-row client-facing markup applied on top of sell_cost in the client view. Default 10%. */
    client_markup_pct: number;
    sell_cost: number;
    cost_code_id: number | null;
    cost_code: string;
    cost_type: string;
    in_price_list?: boolean;
}

export interface SupplierOption {
    id: number;
    code: string;
    name: string;
}

const auCurrencyFormat = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

export const currencyFormatter = (params: any): string => {
    if (params.value == null || params.value === '') return '';
    const value = typeof params.value === 'string' ? parseFloat(params.value) : params.value;
    if (isNaN(value)) return '';
    return auCurrencyFormat.format(value);
};

export const calculateSellCost = (qty: number, unitCost: number, markupPct: number): number => {
    return Math.round(qty * unitCost * (1 + markupPct / 100) * 100) / 100;
};

export const getNextLineNumber = (rows: DirectMaterialItem[]): number => {
    if (rows.length === 0) return 1;
    return Math.max(...rows.map((r) => r.line_number || 0)) + 1;
};
