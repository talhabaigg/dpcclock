/**
 * Type definitions for job forecast
 */

export type ForecastPoint = {
    month: string;
    amount: number;
    is_actual: boolean;
};

export type ChartRow = {
    monthKey: string; // "2025-11"
    monthLabel: string; // "Nov 25"
    actual: number | null;
    forecast: number | null;
};

export type GridRow = any & { _rowKey: string };

export type ChartContext =
    | { open: false }
    | {
          open: true;
          grid: 'cost' | 'revenue';
          rowKey?: string; // only for normal rows
          pinned?: boolean; // true for TOTAL pinned row
          title: string;
          editable: boolean;
      };

export type ForecastStatus = 'pending' | 'draft' | 'submitted' | 'finalized';

export interface ForecastWorkflow {
    id: number;
    status: ForecastStatus;
    statusLabel: string;
    statusColor: string;
    isEditable: boolean;
    canSubmit: boolean;
    canFinalize: boolean;
    canReject: boolean;
    submittedBy?: string;
    submittedAt?: string;
    finalizedBy?: string;
    finalizedAt?: string;
    rejectionNote?: string;
}

export interface JobForecastProps {
    costRowData: any[];
    revenueRowData: any[];
    monthsAll: string[];
    forecastMonths: string[];
    projectEndMonth: string;
    currentMonth?: string;
    availableForecastMonths?: string[];
    selectedForecastMonth?: string;
    isLocked?: boolean;
    locationId?: number;
    forecastProjectId?: number;
    jobName?: string;
    jobNumber?: string;
    isForecastProject?: boolean;
    lastUpdate?: string;
    // Workflow
    forecastWorkflow?: ForecastWorkflow | null;
    canUserFinalize?: boolean;
}

export interface ChartPoint {
    x: string;
    y: number;
    is_actual: boolean;
    monthKey: string;
}

export interface ChartMeta {
    label: string;
    y: number;
    is_actual: boolean;
    monthKey: string;
}
