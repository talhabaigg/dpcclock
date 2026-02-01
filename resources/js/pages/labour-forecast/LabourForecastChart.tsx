/**
 * LabourForecastChart component for editing labour forecast data via chart interaction
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

ChartJS.register(dragData);
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTooltip, Filler, Legend);

export interface ChartDataPoint {
    weekKey: string;
    weekLabel: string;
    value: number;
}

export interface WorkTypeDataset {
    id: string;
    name: string;
    data: ChartDataPoint[];
}

interface LabourForecastChartProps {
    data: ChartDataPoint[];
    datasets?: WorkTypeDataset[];
    editable: boolean;
    onEdit: (weekKey: string, value: number, workTypeId?: string) => void;
    selectedWorkType?: string; // 'all' or specific work type id
}

interface EditBox {
    left: number;
    top: number;
    index: number;
    value: string;
}

// Color palette for multiple work types
const WORK_TYPE_COLORS = [
    { line: '#6366f1', bg: 'rgba(99, 102, 241, 0.2)' },   // Indigo
    { line: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)' },   // Amber
    { line: '#10b981', bg: 'rgba(16, 185, 129, 0.2)' },   // Emerald
    { line: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)' },    // Red
    { line: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.2)' },   // Violet
    { line: '#06b6d4', bg: 'rgba(6, 182, 212, 0.2)' },    // Cyan
    { line: '#f97316', bg: 'rgba(249, 115, 22, 0.2)' },   // Orange
    { line: '#ec4899', bg: 'rgba(236, 72, 153, 0.2)' },   // Pink
];

const WORK_TYPE_COLORS_DARK = [
    { line: '#818cf8', bg: 'rgba(129, 140, 248, 0.3)' },  // Indigo
    { line: '#fbbf24', bg: 'rgba(251, 191, 36, 0.3)' },   // Amber
    { line: '#34d399', bg: 'rgba(52, 211, 153, 0.3)' },   // Emerald
    { line: '#f87171', bg: 'rgba(248, 113, 113, 0.3)' },  // Red
    { line: '#a78bfa', bg: 'rgba(167, 139, 250, 0.3)' },  // Violet
    { line: '#22d3ee', bg: 'rgba(34, 211, 238, 0.3)' },   // Cyan
    { line: '#fb923c', bg: 'rgba(251, 146, 60, 0.3)' },   // Orange
    { line: '#f472b6', bg: 'rgba(244, 114, 182, 0.3)' },  // Pink
];

export function LabourForecastChart({ data, datasets, editable, onEdit, selectedWorkType = 'all' }: LabourForecastChartProps) {
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

        const point = data[editBox.index];
        if (!point) return closeEditBox();

        const inputValue = Number(String(editBox.value).replace(/,/g, '').trim());
        if (!Number.isFinite(inputValue)) return closeEditBox();

        onEdit(point.weekKey, Math.max(0, Math.round(inputValue)));
        closeEditBox();
    };

    const getEditBoxInput = useCallback((index: number) => {
        const point = data[index];
        if (!point) return null;
        return String(Math.round(point.value));
    }, [data]);

    useEffect(() => {
        if (!editBox || editBoxDirty) return;
        const nextInput = getEditBoxInput(editBox.index);
        if (!nextInput) return;

        setEditBox((prev) => {
            if (!prev) return prev;
            if (prev.value === nextInput) return prev;
            return { ...prev, value: nextInput };
        });
    }, [editBox, editBoxDirty, getEditBoxInput]);

    // Modern color palette with dark mode support
    const COLORS = useMemo(
        () => ({
            line: isDark ? '#818cf8' : '#6366f1', // Indigo (indigo-400/500)
            gradientStart: isDark ? 'rgba(129, 140, 248, 0.3)' : 'rgba(99, 102, 241, 0.2)',
            gradientEnd: isDark ? 'rgba(129, 140, 248, 0.02)' : 'rgba(99, 102, 241, 0.02)',
            gridColor: isDark ? '#374151' : '#e2e8f0',
            textColor: isDark ? '#f3f4f6' : '#1e293b',
            mutedText: isDark ? '#9ca3af' : '#64748b',
            labelBg: isDark ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            tooltipBg: isDark ? '#1f2937' : '#ffffff',
        }),
        [isDark],
    );

    const formatValue = (value: number) => {
        return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
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
        [COLORS],
    );

    const chartData = useMemo(() => {
        const colorPalette = isDark ? WORK_TYPE_COLORS_DARK : WORK_TYPE_COLORS;

        // Use datasets if provided (multiple work types), otherwise fall back to single data
        if (datasets && datasets.length > 0) {
            // Get labels from first dataset
            const labels = datasets[0].data.map((d) => d.weekLabel);

            return {
                labels,
                datasets: datasets.map((wt, idx) => {
                    const colors = colorPalette[idx % colorPalette.length];
                    return {
                        label: wt.name,
                        data: wt.data.map((d) => d.value),
                        spanGaps: true,
                        borderWidth: 2.5,
                        borderColor: colors.line,
                        tension: 0.4,
                        fill: false, // No fill for multi-line chart
                        pointRadius: 5,
                        pointHoverRadius: 8,
                        pointHitRadius: 14,
                        pointBackgroundColor: colors.line,
                        pointBorderColor: isDark ? '#1f2937' : '#ffffff',
                        pointBorderWidth: 2,
                        pointHoverBorderWidth: 2.5,
                        pointStyle: 'circle' as const,
                    };
                }),
            };
        }

        // Single dataset (legacy support or 'all' view)
        return {
            labels: data.map((d) => d.weekLabel),
            datasets: [
                {
                    label: 'Headcount',
                    data: data.map((d) => d.value),
                    spanGaps: true,
                    borderWidth: 3,
                    borderColor: COLORS.line,
                    tension: 0.4,
                    fill: true,
                    backgroundColor: (context: any) => {
                        const chart = context.chart;
                        const { ctx, chartArea } = chart;
                        if (!chartArea) return COLORS.gradientStart;
                        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                        gradient.addColorStop(0, COLORS.gradientStart);
                        gradient.addColorStop(1, COLORS.gradientEnd);
                        return gradient;
                    },
                    pointRadius: 6,
                    pointHoverRadius: 9,
                    pointHitRadius: 16,
                    pointBackgroundColor: COLORS.line,
                    pointBorderColor: isDark ? '#1f2937' : '#ffffff',
                    pointBorderWidth: 2.5,
                    pointHoverBorderWidth: 3,
                    pointStyle: 'circle' as const,
                },
            ],
        };
    }, [data, datasets, COLORS, isDark]);

    const hasMultipleDatasets = datasets && datasets.length > 0;

    const options = useMemo<ChartOptions<'line'>>(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: hasMultipleDatasets ? 10 : 35,
                    right: 10,
                    left: 10,
                    bottom: hasMultipleDatasets ? 5 : 0,
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
                legend: {
                    display: hasMultipleDatasets,
                    position: 'top' as const,
                    align: 'start' as const,
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 15,
                        font: {
                            size: 11,
                            family: "'Inter', system-ui, sans-serif",
                        },
                        color: COLORS.textColor,
                    },
                },
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
                            const v = ctx.parsed.y;
                            if (v == null) return '';
                            const label = ctx.dataset.label || 'Headcount';
                            return `${label}: ${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
                        },
                    },
                },
                // Disable drag editing for multi-dataset view
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                dragData: (editable && !hasMultipleDatasets
                    ? {
                          round: 0,
                          showTooltip: true,
                          onDragStart: () => {
                              // Allow drag only if editable
                              return editable;
                          },
                          onDrag: (_e: any, _datasetIndex: number, _index: number, value: any) => {
                              // Clamp to non-negative during drag
                              return Math.max(0, value);
                          },
                          onDragEnd: (_e: any, _datasetIndex: number, index: number, value: any) => {
                              const point = data[index];
                              if (!point) return;

                              const newY = Number(value);
                              if (!Number.isFinite(newY)) return;

                              onEdit(point.weekKey, Math.max(0, Math.round(newY)));
                          },
                      }
                    : false) as any,
            },
            // Disable click editing for multi-dataset view
            onClick: !hasMultipleDatasets ? (_evt: any, elements: any[], chart: any) => {
                if (!editable) return;
                if (!elements?.length) return;

                const idx = elements[0].index as number;
                const point = data[idx];
                if (!point) return;

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
                    value: nextInput,
                });
            } : undefined,
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
                    min: 0,
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
        [data, editable, onEdit, COLORS, getEditBoxInput, hasMultipleDatasets],
    );

    return (
        <div
            ref={wrapRef}
            className="relative h-full w-full min-h-[180px] rounded-lg bg-white p-2 dark:bg-slate-900 sm:min-h-[250px] sm:p-4"
            onPointerDown={() => {
                if (editBox) closeEditBox();
            }}
        >
            <Line key={`chart-${isDark}-${editable}-${hasMultipleDatasets}`} data={chartData} options={options} plugins={hasMultipleDatasets ? [] : [dataLabelPlugin]} />

            {editBox && (
                <div
                    className="absolute z-50 overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-xl shadow-indigo-500/10 dark:border-indigo-900/50 dark:bg-slate-800"
                    style={{ left: editBox.left, top: editBox.top, maxWidth: 'calc(100% - 16px)', width: '200px' }}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="border-b border-indigo-100 bg-gradient-to-r from-indigo-50 to-violet-50 px-3 py-2.5 dark:border-indigo-900/50 dark:from-indigo-950/50 dark:to-slate-800">
                        <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">{data[editBox.index]?.weekLabel}</p>
                    </div>

                    {/* Content */}
                    <div className="p-3">
                        <div className="relative">
                            <input
                                autoFocus
                                inputMode="numeric"
                                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 pr-16 text-sm font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:border-indigo-400"
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
                                <span className="inline-flex items-center rounded-md bg-indigo-100 px-1.5 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                                    HC
                                </span>
                            </div>
                        </div>

                        {/* Action buttons */}
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
