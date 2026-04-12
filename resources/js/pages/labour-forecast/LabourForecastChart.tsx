/**
 * LabourForecastChart component for editing labour forecast data via chart interaction
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

const CHART_VAR_NAMES = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5'] as const;

function readCssVar(name: string, fallback: string): string {
    if (typeof window === 'undefined') return fallback;
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
}

// Wrap a color with alpha via color-mix (supported by canvas in all modern browsers).
function withAlpha(color: string, alpha: number): string {
    const pct = Math.round(alpha * 100);
    return `color-mix(in oklch, ${color} ${pct}%, transparent)`;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

    const getEditBoxInput = useCallback(
        (index: number) => {
            const point = data[index];
            if (!point) return null;
            return String(Math.round(point.value));
        },
        [data],
    );

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

    // Resolve shadcn design tokens (chart-1..5, border, foreground, muted-foreground, card, popover).
    // `isDark` is in deps so values refresh when theme toggles.
    const COLORS = useMemo(() => {
        const chart1 = readCssVar('--chart-1', 'oklch(0.646 0.222 41.116)');
        const border = readCssVar('--border', 'oklch(0.922 0 0)');
        const foreground = readCssVar('--foreground', 'oklch(0.145 0 0)');
        const mutedForeground = readCssVar('--muted-foreground', 'oklch(0.556 0 0)');
        const popover = readCssVar('--popover', 'oklch(1 0 0)');
        const card = readCssVar('--card', 'oklch(1 0 0)');

        return {
            line: chart1,
            gradientStart: withAlpha(chart1, isDark ? 0.3 : 0.2),
            gradientEnd: withAlpha(chart1, 0.02),
            gridColor: border,
            textColor: foreground,
            mutedText: mutedForeground,
            labelBg: popover,
            tooltipBg: card,
            pointBorder: card,
        };
    }, [isDark]);

    // Multi-dataset palette cycles through --chart-1 .. --chart-5.
    const WORK_TYPE_COLORS = useMemo(
        () =>
            CHART_VAR_NAMES.map((name, idx) => {
                const fallbacks = [
                    'oklch(0.646 0.222 41.116)',
                    'oklch(0.6 0.118 184.704)',
                    'oklch(0.398 0.07 227.392)',
                    'oklch(0.828 0.189 84.429)',
                    'oklch(0.769 0.188 70.08)',
                ];
                const line = readCssVar(name, fallbacks[idx]);
                return { line, bg: withAlpha(line, isDark ? 0.3 : 0.2) };
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
                        const fontSize = isSmallChart ? 10 : 11;
                        ctx.font = `500 ${fontSize}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
                        const textWidth = ctx.measureText(text).width;
                        const padding = isSmallChart ? 5 : 7;
                        const boxHeight = isSmallChart ? 18 : 20;
                        const yOffset = isSmallChart ? 20 : 24;
                        const borderRadius = 6;

                        ctx.beginPath();
                        ctx.roundRect(x - textWidth / 2 - padding, y - yOffset, textWidth + padding * 2, boxHeight, borderRadius);
                        ctx.fillStyle = COLORS.labelBg;
                        ctx.fill();

                        ctx.strokeStyle = COLORS.gridColor;
                        ctx.lineWidth = 1;
                        ctx.stroke();

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
        // Use datasets if provided (multiple work types), otherwise fall back to single data
        if (datasets && datasets.length > 0) {
            // Get labels from first dataset
            const labels = datasets[0].data.map((d) => d.weekLabel);

            return {
                labels,
                datasets: datasets.map((wt, idx) => {
                    const colors = WORK_TYPE_COLORS[idx % WORK_TYPE_COLORS.length];
                    return {
                        label: wt.name,
                        data: wt.data.map((d) => d.value),
                        spanGaps: true,
                        borderWidth: 2,
                        borderColor: colors.line,
                        tension: 0.4,
                        fill: false,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointHitRadius: 14,
                        pointBackgroundColor: colors.line,
                        pointBorderColor: COLORS.pointBorder,
                        pointBorderWidth: 2,
                        pointHoverBorderWidth: 2,
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
                    borderWidth: 2,
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
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointHitRadius: 16,
                    pointBackgroundColor: COLORS.line,
                    pointBorderColor: COLORS.pointBorder,
                    pointBorderWidth: 2,
                    pointHoverBorderWidth: 2,
                    pointStyle: 'circle' as const,
                },
            ],
        };
    }, [data, datasets, COLORS, WORK_TYPE_COLORS]);

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
                        padding: 12,
                        boxWidth: 8,
                        boxHeight: 8,
                        font: {
                            size: 12,
                            weight: 500,
                        },
                        color: COLORS.mutedText,
                    },
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: COLORS.tooltipBg,
                    titleColor: COLORS.textColor,
                    bodyColor: COLORS.mutedText,
                    borderColor: COLORS.gridColor,
                    borderWidth: 1,
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: true,
                    boxWidth: 10,
                    boxHeight: 10,
                    boxPadding: 4,
                    usePointStyle: true,
                    titleFont: {
                        size: 12,
                        weight: 600,
                    },
                    bodyFont: {
                        size: 12,
                        weight: 500,
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
            onClick: !hasMultipleDatasets
                ? (_evt: any, elements: any[], chart: any) => {
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
                  }
                : undefined,
            scales: {
                x: {
                    grid: {
                        display: false,
                    },
                    ticks: {
                        maxRotation: 0,
                        autoSkip: true,
                        padding: 8,
                        font: {
                            size: 12,
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
            className="bg-card relative h-full min-h-[180px] w-full rounded-lg p-2 sm:min-h-[250px] sm:p-4"
            onPointerDown={() => {
                if (editBox) closeEditBox();
            }}
        >
            <Line
                key={`chart-${isDark}-${editable}-${hasMultipleDatasets}`}
                data={chartData}
                options={options}
                plugins={hasMultipleDatasets ? [] : [dataLabelPlugin]}
            />

            {editBox && (
                <div
                    className="bg-popover text-popover-foreground border-border absolute z-50 overflow-hidden rounded-lg border shadow-md"
                    style={{ left: editBox.left, top: editBox.top, maxWidth: 'calc(100% - 16px)', width: '208px' }}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <div className="border-border bg-muted/30 border-b px-3 py-2">
                        <p className="text-foreground text-sm font-medium">{data[editBox.index]?.weekLabel}</p>
                    </div>

                    <div className="p-3">
                        <div className="relative">
                            <Input
                                autoFocus
                                inputMode="numeric"
                                className="pr-12 font-medium"
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
                            <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs font-medium">
                                HC
                            </span>
                        </div>

                        <div className="mt-3 flex gap-2">
                            <Button variant="outline" size="sm" className="flex-1" onClick={closeEditBox} type="button">
                                Cancel
                            </Button>
                            <Button size="sm" className="flex-1" onClick={commitEditBox} type="button">
                                Save
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
