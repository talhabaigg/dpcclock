// Cash Forecast Types
// Centralized type definitions for the cash forecast module

export type DataSource = 'actual' | 'forecast';

export type MonthNode = {
    month: string;
    cash_in: CashFlowNode;
    cash_out: CashFlowNode;
    net: number;
};

export type CostItemNode = {
    cost_item: string;
    description?: string | null;
    total: number;
    jobs?: JobNode[];
    vendors?: VendorNode[];
};

export type CashFlowNode = {
    total: number;
    cost_items: CostItemNode[];
};

export type JobNode = {
    job_number: string;
    total: number;
    source?: DataSource;
};

export type VendorNode = {
    vendor: string;
    total: number;
    jobs?: JobNode[];
    source?: DataSource;
};

export type GeneralCost = {
    id: number;
    name: string;
    description: string | null;
    type: 'one_off' | 'recurring';
    amount: number;
    includes_gst: boolean;
    frequency: string | null;
    start_date: string;
    end_date: string | null;
    category: string | null;
    is_active: boolean;
    flow_type: 'cash_in' | 'cash_out';
};

export type CashInSource = {
    job_number: string;
    month: string;
    amount: number;
    source?: DataSource;
};

export type CashInAdjustment = {
    id: number;
    job_number: string;
    source_month: string;
    receipt_month: string;
    amount: number;
};

export type CashOutSource = {
    job_number: string;
    cost_item: string;
    vendor: string | null;  // null for forecast data (only actuals have vendor)
    month: string;
    amount: number;
    source: DataSource;
};

export type CashOutAdjustment = {
    id: number;
    job_number: string;
    cost_item: string;
    vendor: string;
    source_month: string;
    payment_month: string;
    amount: number;
};

export type CashInSplit = {
    receipt_month: string;
    amount: number;
};

export type CashOutSplit = {
    payment_month: string;
    amount: number;
};

export type VendorPaymentDelay = {
    id: number;
    vendor: string;
    source_month: string;
    payment_month: string;
    amount: number;
};

export type VendorPaymentDelaySplit = {
    payment_month: string;
    amount: number;
};

export type CashForecastSettings = {
    startingBalance: number;
    startingBalanceDate: string | null;
    gstQ1PayMonth: number;
    gstQ2PayMonth: number;
    gstQ3PayMonth: number;
    gstQ4PayMonth: number;
};

export type CashForecastProps = {
    months: MonthNode[];
    currentMonth?: string;
    costCodeDescriptions?: Record<string, string>;
    settings: CashForecastSettings;
    generalCosts: GeneralCost[];
    categories: Record<string, string>;
    frequencies: Record<string, string>;
    cashInSources: CashInSource[];
    cashInAdjustments: CashInAdjustment[];
    cashOutSources: CashOutSource[];
    cashOutAdjustments: CashOutAdjustment[];
    vendorPaymentDelays: VendorPaymentDelay[];
    costTypeByCostItem: Record<string, string | null>;
};

export type VendorDelayModalState = {
    open: boolean;
    vendor: string | null;
    sourceMonth: string | null;
    splits: VendorPaymentDelaySplit[];
};

// Chart data types
export type ChartDataPoint = {
    label: string;
    cashIn: number;
    cashOut: number;
    net: number;
};

export type CumulativeDataPoint = {
    label: string;
    value: number;
};

export type WaterfallDataPoint = {
    label: string;
    value: number;
};

// Table row types
export type CostItemRowData = {
    code: string;
    description: string | null;
    total: number;
    monthlyValues: Map<string, number>;
};

export type JobRowData = {
    jobNumber: string;
    total: number;
    monthlyValues: Map<string, { amount: number; source?: DataSource }>;
    hasAdjustment: boolean;
};

export type VendorRowData = {
    vendor: string;
    total: number;
    monthlyValues: Map<string, { amount: number; source?: DataSource }>;
    hasAdjustment: boolean;
    jobs: JobRowData[];
};

// Modal state types
export type CashInModalState = {
    open: boolean;
    jobNumber: string | null;
    sourceMonth: string | null;
    splits: CashInSplit[];
};

export type CashOutModalState = {
    open: boolean;
    jobNumber: string | null;
    costItem: string | null;
    vendor: string | null;
    sourceMonth: string | null;
    splits: CashOutSplit[];
};

// Summary totals
export type CashFlowTotals = {
    cashIn: number;
    cashOut: number;
    net: number;
};
