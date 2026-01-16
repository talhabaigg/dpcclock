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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

export function ForecastDialogChart({ data, editable, onEdit, budget, viewMode }: ForecastDialogChartProps) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const [editBox, setEditBox] = useState<EditBox | null>(null);
    const [editBoxDirty, setEditBoxDirty] = useState(false);

    const closeEditBox = () => {
        setEditBox(null);
        setEditBoxDirty(false);
    };

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
        () => {
            return data.map((d) => {
                // If both actual and forecast exist (current month), prefer forecast for display
                const hasForecast = d.forecast != null;
                const hasActual = d.actual != null;

                // Use forecast if available, otherwise use actual
                const y = hasForecast ? d.forecast : (hasActual ? d.actual : 0);
                const isActual = !hasForecast && hasActual;

                return {
                    label: d.monthLabel,
                    y: y ?? 0,
                    is_actual: isActual,
                    monthKey: d.monthKey,
                };
            });
        },
        [data, budget, viewMode],
    );

    // Calculate cumulative values for percent view
    const cumulativeData = useMemo(() => {
        let cumulative = 0;
        return meta.map((m) => {
            cumulative += m.y;
            return cumulative;
        });
    }, [meta]);

    const getEditBoxInput = useCallback((index: number) => {
        const m = meta[index];
        if (!m) return null;

        if (viewMode === 'cumulative-percent' && budget) {
            const cumulativeAmount = cumulativeData[index] ?? 0;
            const percent = (cumulativeAmount / budget) * 100;
            return {
                value: String(Math.round(percent * 10) / 10),
                inputMode: 'percent' as const,
            };
        }

        return {
            value: String(Math.round(m.y)),
            inputMode: 'amount' as const,
        };
    }, [meta, viewMode, budget, cumulativeData]);

    useEffect(() => {
        if (!editBox || editBoxDirty) return;
        const nextInput = getEditBoxInput(editBox.index);
        if (!nextInput) return;

        setEditBox((prev) => {
            if (!prev) return prev;
            if (prev.value === nextInput.value && prev.inputMode === nextInput.inputMode) {
                return prev;
            }
            return {
                ...prev,
                value: nextInput.value,
                inputMode: nextInput.inputMode,
            };
        });
    }, [editBox, editBoxDirty, getEditBoxInput]);

    // Calculate display values based on view mode
    const displayValues = useMemo(() => {
        if (viewMode === 'cumulative-percent' && budget) {
            return cumulativeData.map((cum) => (cum / budget) * 100);
        }
        // Monthly amount view
        return meta.map((m) => m.y);
    }, [viewMode, budget, cumulativeData, meta]);

    // Shadcn-inspired color palette
    const COLORS = useMemo(
        () => ({
            actual: '#d1c700', // Keep the yellow for actuals
            forecast: 'hsl(221.2 83.2% 53.3%)', // Blue-600 for forecast
            gridColor: 'hsl(214.3 31.8% 91.4%)', // Border color
            textColor: 'hsl(222.2 47.4% 11.2%)', // Foreground
            mutedText: 'hsl(215.4 16.3% 46.9%)', // Muted foreground
        }),
        [],
    );

    const formatValue = (value: number) => {
        if (viewMode === 'cumulative-percent') {
            return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
        }
        return `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    };

    const dataLabelPlugin = useMemo(
        () => ({
            id: 'simpleDataLabels',
            afterDatasetsDraw: (chart: any) => {
                const ctx = chart.ctx;
                const chartWidth = chart.width;
                const isSmallChart = chartWidth < 500;

                chart.data.datasets.forEach((dataset: any, datasetIndex: number) => {
                    const chartMeta = chart.getDatasetMeta(datasetIndex);
                    chartMeta.data.forEach((element: any, index: number) => {
                        const rawValue = dataset.data?.[index];
                        if (rawValue == null || !Number.isFinite(rawValue)) return;
                        const { x, y } = element.tooltipPosition();
                        ctx.save();

                        // Add background for better readability
                        const text = formatValue(rawValue);
                        const fontSize = isSmallChart ? 9 : 11;
                        ctx.font = `600 ${fontSize}px "Inter", system-ui, sans-serif`;
                        const textWidth = ctx.measureText(text).width;
                        const padding = isSmallChart ? 2 : 4;
                        const boxHeight = isSmallChart ? 14 : 16;
                        const yOffset = isSmallChart ? 18 : 22;

                        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                        ctx.fillRect(x - textWidth / 2 - padding, y - yOffset, textWidth + padding * 2, boxHeight);

                        // Draw border
                        ctx.strokeStyle = COLORS.gridColor;
                        ctx.lineWidth = 1;
                        ctx.strokeRect(x - textWidth / 2 - padding, y - yOffset, textWidth + padding * 2, boxHeight);

                        // Draw text
                        ctx.fillStyle = COLORS.textColor;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(text, x, y - yOffset + boxHeight / 2);
                        ctx.restore();
                    });
                });
            },
        }),
        [viewMode, COLORS],
    );

    const chartData = useMemo(
        () => ({
            labels: meta.map((m) => m.label),
            datasets: [
                {
                    label: viewMode === 'cumulative-percent' ? 'Cumulative %' : 'Monthly $',
                    data: displayValues,
                    spanGaps: true,
                    borderWidth: 2.5,
                    tension: 0.3,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointHitRadius: 14,
                    pointBackgroundColor: (ctx: any) => (meta[ctx.dataIndex]?.is_actual ? COLORS.actual : COLORS.forecast),
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointHoverBorderWidth: 2,
                    segment: {
                        borderColor: (ctx: any) => (meta[ctx.p1DataIndex]?.is_actual ? COLORS.actual : COLORS.forecast),
                        borderDash: (ctx: any) => (meta[ctx.p1DataIndex]?.is_actual ? [] : [5, 5]),
                    },
                },
            ],
        }),
        [meta, displayValues, viewMode, COLORS],
    );

    const options = useMemo<ChartOptions<'line'>>(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 750,
                easing: 'easeInOutQuart',
            },
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'hsl(0 0% 100%)',
                    titleColor: COLORS.textColor,
                    bodyColor: COLORS.textColor,
                    borderColor: COLORS.gridColor,
                    borderWidth: 1,
                    padding: 10,
                    cornerRadius: 6,
                    titleFont: {
                        size: 12,
                        weight: 'bold' as const,
                        family: "'Inter', system-ui, sans-serif",
                    },
                    bodyFont: {
                        size: 11,
                        family: "'Inter', system-ui, sans-serif",
                    },
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

                const nextInput = getEditBoxInput(idx);
                if (!nextInput) return;

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

                // Responsive box sizing
                const isSmallScreen = wrapRect.width < 400;
                const boxW = isSmallScreen ? 200 : 240;
                const boxH = isSmallScreen ? 100 : 140;
                left = Math.max(4, Math.min(left, wrapRect.width - boxW - 4));
                top = Math.max(4, Math.min(top, wrapRect.height - boxH - 4));

                setEditBoxDirty(false);
                setEditBox({
                    left,
                    top,
                    index: idx,
                    value: nextInput.value,
                    inputMode: nextInput.inputMode,
                });
            },
            scales: {
                x: {
                    grid: {
                        display: true,
                        color: COLORS.gridColor,
                        drawOnChartArea: true,
                        drawTicks: true,
                    },
                    ticks: {
                        maxRotation: 0,
                        autoSkip: true,
                        padding: 8,
                        font: {
                            size: 11,
                            family: "'Inter', system-ui, sans-serif",
                        },
                        color: COLORS.mutedText,
                    },
                    border: {
                        display: true,
                        color: COLORS.gridColor,
                    },
                },
                y: {
                    display: false,
                    grid: {
                        display: false,
                    },
                    ticks: {
                        display: false,
                    },
                    border: {
                        display: false,
                    },
                },
            },
        }),
        [meta, editable, onEdit, viewMode, cumulativeData, budget, COLORS],
    );

    return (
        <div
            ref={wrapRef}
            className="relative h-full w-full min-h-[200px] p-1 sm:min-h-[250px] sm:p-2"
            onPointerDown={() => {
                if (editBox) closeEditBox();
            }}
        >
            <Line key={viewMode} data={chartData} options={options} plugins={[dataLabelPlugin]} />

            {editBox && (
                <div
                    className="bg-background absolute z-50 rounded-lg border border-border p-2.5 shadow-xl sm:p-4"
                    style={{ left: editBox.left, top: editBox.top, maxWidth: 'calc(100% - 16px)' }}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <div className="text-foreground mb-2 text-xs font-semibold sm:mb-3 sm:text-sm">
                        Edit Forecast - <span className="text-primary">{meta[editBox.index]?.label}</span>
                    </div>

                    <div className="mb-2 flex flex-col gap-1.5 sm:mb-3 sm:flex-row sm:items-center sm:gap-3">
                        <input
                            autoFocus
                            inputMode="numeric"
                            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm font-medium outline-none ring-offset-background transition-colors focus:border-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 sm:h-10 sm:w-36 sm:px-3"
                            value={editBox.value}
                            onChange={(e) => {
                                setEditBoxDirty(true);
                                setEditBox((s) => (s ? { ...s, value: e.target.value } : s));
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') commitEditBox();
                                if (e.key === 'Escape') closeEditBox();
                            }}
                            onBlur={commitEditBox}
                        />
                        <span className="text-muted-foreground text-xs font-medium sm:text-sm">
                            {editBox.inputMode === 'percent' ? '% (cumulative)' : '$ (monthly)'}
                        </span>
                    </div>

                    <div className="text-muted-foreground mb-2 hidden text-xs leading-relaxed sm:mb-3 sm:block">
                        {editBox.inputMode === 'percent'
                            ? 'Enter the cumulative % of budget to reach by this month'
                            : 'Enter the dollar amount for this month only'}
                    </div>

                    <div className="flex justify-end gap-1.5 border-t border-border pt-2 sm:gap-2 sm:pt-3">
                        <button
                            className="rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:px-3 sm:py-1.5"
                            onClick={closeEditBox}
                            type="button"
                        >
                            Cancel
                        </button>
                        <button
                            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-2.5 py-1 text-xs font-medium transition-colors sm:px-3 sm:py-1.5"
                            onClick={commitEditBox}
                            type="button"
                        >
                            Save
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
