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
    const [isDark, setIsDark] = useState(false);

    // Detect dark mode
    useEffect(() => {
        const checkDarkMode = () => {
            setIsDark(document.documentElement.classList.contains('dark'));
        };
        checkDarkMode();
        const observer = new MutationObserver(checkDarkMode);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

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

    // Modern color palette with dark mode support
    const COLORS = useMemo(
        () => ({
            actual: isDark ? '#facc15' : '#eab308', // Yellow for actuals (amber-400/500)
            forecast: isDark ? '#818cf8' : '#6366f1', // Indigo for forecast (indigo-400/500)
            forecastGradientStart: isDark ? 'rgba(129, 140, 248, 0.3)' : 'rgba(99, 102, 241, 0.2)',
            forecastGradientEnd: isDark ? 'rgba(129, 140, 248, 0.02)' : 'rgba(99, 102, 241, 0.02)',
            gridColor: isDark ? '#374151' : '#e2e8f0', // Gray borders
            textColor: isDark ? '#f3f4f6' : '#1e293b', // Text color
            mutedText: isDark ? '#9ca3af' : '#64748b', // Muted text
            labelBg: isDark ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            tooltipBg: isDark ? '#1f2937' : '#ffffff',
        }),
        [isDark],
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
                        const padding = isSmallChart ? 4 : 6;
                        const boxHeight = isSmallChart ? 18 : 22;
                        const yOffset = isSmallChart ? 22 : 28;
                        const borderRadius = 6;

                        // Draw rounded rectangle background with shadow
                        ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
                        ctx.shadowBlur = 4;
                        ctx.shadowOffsetY = 2;

                        ctx.beginPath();
                        ctx.roundRect(x - textWidth / 2 - padding, y - yOffset, textWidth + padding * 2, boxHeight, borderRadius);
                        ctx.fillStyle = COLORS.labelBg;
                        ctx.fill();

                        // Reset shadow for border
                        ctx.shadowColor = 'transparent';
                        ctx.shadowBlur = 0;
                        ctx.shadowOffsetY = 0;

                        // Draw border
                        ctx.strokeStyle = COLORS.gridColor;
                        ctx.lineWidth = 1;
                        ctx.stroke();

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
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    backgroundColor: (context: any) => {
                        const chart = context.chart;
                        const { ctx, chartArea } = chart;
                        if (!chartArea) return COLORS.forecastGradientStart;
                        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                        gradient.addColorStop(0, COLORS.forecastGradientStart);
                        gradient.addColorStop(1, COLORS.forecastGradientEnd);
                        return gradient;
                    },
                    pointRadius: 6,
                    pointHoverRadius: 9,
                    pointHitRadius: 16,
                    pointBackgroundColor: (ctx: any) => (meta[ctx.dataIndex]?.is_actual ? COLORS.actual : COLORS.forecast),
                    pointBorderColor: isDark ? '#1f2937' : '#ffffff',
                    pointBorderWidth: 2.5,
                    pointHoverBorderWidth: 3,
                    pointStyle: 'circle',
                    segment: {
                        borderColor: (ctx: any) => (meta[ctx.p1DataIndex]?.is_actual ? COLORS.actual : COLORS.forecast),
                        borderDash: (ctx: any) => (meta[ctx.p1DataIndex]?.is_actual ? [] : [6, 4]),
                    },
                },
            ],
        }),
        [meta, displayValues, viewMode, COLORS, isDark],
    );

    const options = useMemo<ChartOptions<'line'>>(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 35, // Space for data labels above points
                    right: 10,
                    left: 10,
                },
            },
            animation: {
                duration: 600,
                easing: 'easeOutQuart',
            },
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    backgroundColor: COLORS.tooltipBg,
                    titleColor: COLORS.textColor,
                    bodyColor: COLORS.textColor,
                    borderColor: COLORS.gridColor,
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: true,
                    boxWidth: 12,
                    boxHeight: 12,
                    boxPadding: 4,
                    titleFont: {
                        size: 13,
                        weight: 'bold' as const,
                        family: "'Inter', system-ui, sans-serif",
                    },
                    bodyFont: {
                        size: 12,
                        family: "'Inter', system-ui, sans-serif",
                    },
                    callbacks: {
                        label: (ctx) => {
                            const m = meta[ctx.dataIndex];
                            const v = ctx.parsed.y;
                            if (!m || v == null) return '';

                            const prefix = m.is_actual ? '● Actual' : '○ Forecast';
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
            className="relative h-full w-full min-h-[200px] rounded-lg bg-white p-3 dark:bg-slate-900 sm:min-h-[250px] sm:p-4"
            onPointerDown={() => {
                if (editBox) closeEditBox();
            }}
        >
            <Line key={`${viewMode}-${isDark}`} data={chartData} options={options} plugins={[dataLabelPlugin]} />

            {editBox && (
                <div
                    className="absolute z-50 overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-xl shadow-indigo-500/10 dark:border-indigo-900/50 dark:bg-slate-800"
                    style={{ left: editBox.left, top: editBox.top, maxWidth: 'calc(100% - 16px)', width: '200px' }}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    {/* Header - subtle indigo accent */}
                    <div className="border-b border-indigo-100 bg-gradient-to-r from-indigo-50 to-violet-50 px-3 py-2.5 dark:border-indigo-900/50 dark:from-indigo-950/50 dark:to-slate-800">
                        <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">{meta[editBox.index]?.label}</p>
                    </div>

                    {/* Content */}
                    <div className="p-3">
                        {/* Input with unit badge */}
                        <div className="relative">
                            <input
                                autoFocus
                                inputMode="numeric"
                                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 pr-10 text-sm font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:border-indigo-400"
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
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                <span
                                    className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-bold ${
                                        editBox.inputMode === 'percent'
                                            ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300'
                                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                                    }`}
                                    title={editBox.inputMode === 'percent' ? 'Cumulative % of budget by this month' : 'Monthly dollar amount'}
                                >
                                    {editBox.inputMode === 'percent' ? '%' : '$'}
                                </span>
                            </div>
                        </div>

                        {/* Action buttons below input */}
                        <div className="mt-3 flex gap-2">
                            <button
                                className="flex h-8 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 transition-all hover:bg-slate-50 active:scale-[0.98] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                                onClick={closeEditBox}
                                type="button"
                            >
                                Cancel
                            </button>
                            <button
                                className="flex h-8 flex-1 items-center justify-center rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-xs font-medium text-white shadow-sm shadow-indigo-500/30 transition-all hover:from-indigo-600 hover:to-violet-600 active:scale-[0.98]"
                                onClick={commitEditBox}
                                type="button"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
