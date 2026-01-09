/**
 * ForecastDialogChart component for editing forecast data via chart interaction
 */

import {
    CategoryScale,
    Chart as ChartJS,
    ChartOptions,
    Tooltip as ChartTooltip,
    Filler,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
} from 'chart.js';
import dragData from 'chartjs-plugin-dragdata';
import { useMemo, useRef, useState } from 'react';
import { Line } from 'react-chartjs-2';
import type { ChartMeta, ChartRow } from './types';

ChartJS.register(dragData);
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTooltip, Filler, Legend);

interface ForecastDialogChartProps {
    data: ChartRow[];
    editable: boolean;
    onEdit: (monthKey: string, value: number | null) => void;
    budget?: number; // Total budget for % calculations
    viewMode: ChartViewMode;
    onViewModeChange: (mode: ChartViewMode) => void;
}

interface EditBox {
    left: number;
    top: number;
    index: number;
    value: string;
    inputMode: 'amount' | 'percent'; // Track what user is entering
}

export type ChartViewMode = 'cumulative-percent' | 'monthly-amount';

export function ForecastDialogChart({ data, editable, onEdit, budget, viewMode, onViewModeChange }: ForecastDialogChartProps) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const [editBox, setEditBox] = useState<EditBox | null>(null);

    const closeEditBox = () => setEditBox(null);

    const commitEditBox = () => {
        if (!editBox) return;

        const m = meta[editBox.index];
        if (!m || m.is_actual) return closeEditBox();

        let valueToSet: number;
        const inputValue = Number(String(editBox.value).replace(/,/g, '').trim());
        if (!Number.isFinite(inputValue)) return closeEditBox();

        if (editBox.inputMode === 'percent') {
            // Convert percent to amount
            if (!budget) return closeEditBox();
            // For cumulative percent, calculate the month value needed
            const targetCumulative = (inputValue / 100) * budget;
            const cumulativeBeforeThisMonth = meta.slice(0, editBox.index).reduce((sum, m) => sum + m.y, 0);
            valueToSet = Math.max(0, targetCumulative - cumulativeBeforeThisMonth);
        } else {
            // Direct amount
            valueToSet = inputValue;
        }

        onEdit(m.monthKey, Math.max(0, Math.round(valueToSet)));
        closeEditBox();
    };

    const meta = useMemo<ChartMeta[]>(
        () =>
            data.map((d) => {
                const isActual = d.actual != null;
                const y = isActual ? d.actual : d.forecast;
                return {
                    label: d.monthLabel,
                    y: y ?? 0,
                    is_actual: isActual,
                    monthKey: d.monthKey,
                };
            }),
        [data],
    );

    // Calculate cumulative values for percent view
    const cumulativeData = useMemo(() => {
        let cumulative = 0;
        return meta.map((m) => {
            cumulative += m.y;
            return cumulative;
        });
    }, [meta]);

    // Calculate display values based on view mode
    const displayValues = useMemo(() => {
        if (viewMode === 'cumulative-percent' && budget) {
            return cumulativeData.map((cum) => (cum / budget) * 100);
        }
        // Monthly amount view
        return meta.map((m) => m.y);
    }, [viewMode, budget, cumulativeData, meta]);

    const chartData = useMemo(
        () => ({
            labels: meta.map((m) => m.label),
            datasets: [
                {
                    label: viewMode === 'cumulative-percent' ? 'Cumulative %' : 'Monthly $',
                    data: displayValues,
                    spanGaps: true,
                    borderWidth: 2.5,
                    tension: 0.25,
                    pointRadius: 3,
                    pointHoverRadius: 4,
                    pointHitRadius: 14,
                    pointBackgroundColor: (ctx: any) => (meta[ctx.dataIndex]?.is_actual ? '#d1c700' : '#60A5FA'),
                    pointBorderColor: (ctx: any) => (meta[ctx.dataIndex]?.is_actual ? '#d1c700' : '#60A5FA'),
                    segment: {
                        borderColor: (ctx: any) => (meta[ctx.p1DataIndex]?.is_actual ? '#d1c700' : '#60A5FA'),
                        borderDash: (ctx: any) => (meta[ctx.p1DataIndex]?.is_actual ? [] : [4, 4]),
                    },
                },
            ],
        }),
        [meta, displayValues, viewMode],
    );

    const options = useMemo<ChartOptions<'line'>>(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const m = meta[ctx.dataIndex];
                            const v = ctx.parsed.y;
                            if (!m || v == null) return '';

                            const prefix = m.is_actual ? 'Actual' : 'Forecast';
                            if (viewMode === 'cumulative-percent') {
                                return `${prefix}: ${Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
                            }
                            return `${prefix}: $${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
                        },
                    },
                },
                dragData:
                    editable && viewMode === 'monthly-amount'
                        ? {
                              round: 0,
                              showTooltip: true,
                              onDragStart: (_e: any, _datasetIndex: number, index: number) => {
                                  const m = meta[index];
                                  if (!m) return false;
                                  return !m.is_actual;
                              },
                              onDragEnd: (_e: any, _datasetIndex: number, index: number, value: any) => {
                                  const m = meta[index];
                                  if (!m || m.is_actual) return;

                                  const newY = Number(value);
                                  if (!Number.isFinite(newY)) return;

                                  onEdit(m.monthKey, Math.max(0, Math.round(newY)));
                              },
                          }
                        : undefined,
            },
            onClick: (_evt: any, elements: any[], chart: any) => {
                if (!editable) return;
                if (!elements?.length) return;

                const idx = elements[0].index as number;
                const m = meta[idx];
                if (!m || m.is_actual) return;

                // Get current value in the appropriate format
                let currentValue: string;
                let inputMode: 'amount' | 'percent';

                if (viewMode === 'cumulative-percent' && budget) {
                    // Show cumulative percentage
                    const cumulativeAmount = cumulativeData[idx];
                    const percent = (cumulativeAmount / budget) * 100;
                    currentValue = String(Math.round(percent * 10) / 10);
                    inputMode = 'percent';
                } else {
                    // Show monthly amount
                    currentValue = String(Math.round(m.y));
                    inputMode = 'amount';
                }

                const el = elements[0].element;
                const px = el?.x ?? 0;
                const py = el?.y ?? 0;

                const canvas = chart?.canvas as HTMLCanvasElement | undefined;
                const wrap = wrapRef.current;

                if (!canvas || !wrap) return;

                const canvasRect = canvas.getBoundingClientRect();
                const wrapRect = wrap.getBoundingClientRect();

                let left = canvasRect.left - wrapRect.left + px + 10;
                let top = canvasRect.top - wrapRect.top + py + 10;

                const boxW = 240;
                const boxH = 140;
                left = Math.max(8, Math.min(left, wrapRect.width - boxW - 8));
                top = Math.max(8, Math.min(top, wrapRect.height - boxH - 8));

                setEditBox({
                    left,
                    top,
                    index: idx,
                    value: currentValue,
                    inputMode,
                });
            },
            scales: {
                x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true } },
                y: {
                    grid: {},
                    ticks: {
                        callback: (v) => {
                            if (viewMode === 'cumulative-percent') {
                                return `${Number(v).toLocaleString()}%`;
                            }
                            return `$${Number(v).toLocaleString()}`;
                        },
                    },
                },
            },
        }),
        [meta, editable, onEdit, viewMode, cumulativeData, budget],
    );

    return (
        <div
            ref={wrapRef}
            className="relative h-full w-full"
            onPointerDown={() => {
                if (editBox) closeEditBox();
            }}
        >
            <Line data={chartData} options={options} />

            {editBox && (
                <div
                    className="bg-background absolute z-50 rounded-md border p-3 shadow-lg"
                    style={{ left: editBox.left, top: editBox.top }}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <div className="text-muted-foreground mb-2 text-xs">
                        Set forecast for <span className="font-medium">{meta[editBox.index]?.label}</span>
                    </div>

                    <div className="mb-2 flex items-center gap-2">
                        <input
                            autoFocus
                            inputMode="numeric"
                            className="h-9 w-32 rounded-md border px-2 text-sm outline-none"
                            value={editBox.value}
                            onChange={(e) => setEditBox((s) => (s ? { ...s, value: e.target.value } : s))}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') commitEditBox();
                                if (e.key === 'Escape') closeEditBox();
                            }}
                            onBlur={commitEditBox}
                        />
                        <span className="text-muted-foreground text-sm font-medium">
                            {editBox.inputMode === 'percent' ? '% (cumulative)' : '$ (monthly)'}
                        </span>
                    </div>

                    <div className="text-muted-foreground mb-2 text-xs">
                        {editBox.inputMode === 'percent'
                            ? 'Enter the cumulative % of budget to reach by this month'
                            : 'Enter the dollar amount for this month only'}
                    </div>

                    <div className="mt-2 flex justify-end gap-2">
                        <button className="rounded-md border px-2 py-1 text-xs" onClick={closeEditBox} type="button">
                            Cancel
                        </button>
                        <button className="bg-primary text-primary-foreground rounded-md px-2 py-1 text-xs" onClick={commitEditBox} type="button">
                            Save
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
