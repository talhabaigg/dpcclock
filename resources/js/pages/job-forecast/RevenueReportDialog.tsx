/**
 * Revenue Report Dialog - Generates a professional revenue report with charts and detailed table
 */

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { ChartOptions } from 'chart.js';
import { FileText, Printer } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Line } from 'react-chartjs-2';

interface RevenueReportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    jobName: string;
    jobNumber: string;
    accrualData: Array<{
        monthKey: string;
        monthLabel: string;
        costActual: number | null;
        costForecast: number | null;
        revenueActual: number | null;
        revenueForecast: number | null;
    }>;
    totalCostBudget: number;
    totalRevenueBudget: number;
}

export function RevenueReportDialog({
    open,
    onOpenChange,
    jobName,
    jobNumber,
    accrualData,
    totalCostBudget,
    totalRevenueBudget,
}: RevenueReportDialogProps) {
    const reportRef = useRef<HTMLDivElement>(null);
    const chartRefDollar = useRef<any>(null);
    const chartRefPercent = useRef<any>(null);
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

    // Modern color palette
    const COLORS = useMemo(
        () => ({
            // Cost - Blue theme
            costActual: isDark ? '#60a5fa' : '#3b82f6',
            costForecast: isDark ? '#93c5fd' : '#60a5fa',
            costGradientStart: isDark ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.15)',
            costGradientEnd: isDark ? 'rgba(59, 130, 246, 0.02)' : 'rgba(59, 130, 246, 0.02)',
            // Revenue - Green theme
            revenueActual: isDark ? '#4ade80' : '#22c55e',
            revenueForecast: isDark ? '#86efac' : '#4ade80',
            revenueGradientStart: isDark ? 'rgba(34, 197, 94, 0.25)' : 'rgba(34, 197, 94, 0.15)',
            revenueGradientEnd: isDark ? 'rgba(34, 197, 94, 0.02)' : 'rgba(34, 197, 94, 0.02)',
            // Margin - Purple theme
            marginActual: isDark ? '#a78bfa' : '#8b5cf6',
            marginForecast: isDark ? '#c4b5fd' : '#a78bfa',
            marginGradientStart: isDark ? 'rgba(139, 92, 246, 0.25)' : 'rgba(139, 92, 246, 0.15)',
            marginGradientEnd: isDark ? 'rgba(139, 92, 246, 0.02)' : 'rgba(139, 92, 246, 0.02)',
            // Actual indicator
            actualIndicator: '#eab308',
            // Shared
            gridColor: isDark ? '#374151' : '#e2e8f0',
            textColor: isDark ? '#f3f4f6' : '#1e293b',
            mutedText: isDark ? '#9ca3af' : '#64748b',
            tooltipBg: isDark ? '#1f2937' : '#ffffff',
        }),
        [isDark],
    );

    // Calculate cumulative values and prepare table data
    const tableData = accrualData.map((point, index) => {
        const costValue = point.costActual ?? point.costForecast ?? 0;
        const revenueValue = point.revenueActual ?? point.revenueForecast ?? 0;

        // Calculate cumulative up to this point
        const cumulativeCost = accrualData.slice(0, index + 1).reduce((sum, p) => sum + (p.costActual ?? p.costForecast ?? 0), 0);
        const cumulativeRevenue = accrualData.slice(0, index + 1).reduce((sum, p) => sum + (p.revenueActual ?? p.revenueForecast ?? 0), 0);

        const isActual = point.revenueActual !== null;
        const remaining = totalRevenueBudget - cumulativeRevenue;
        const percentComplete = totalRevenueBudget > 0 ? (cumulativeRevenue / totalRevenueBudget) * 100 : 0;

        return {
            month: point.monthLabel,
            monthKey: point.monthKey,
            isActual,
            monthlyCost: costValue,
            monthlyRevenue: revenueValue,
            cumulativeCost,
            cumulativeRevenue,
            percentComplete,
            remaining,
        };
    });

    // Calculate cumulative values for charts
    const cumulativeData = accrualData.reduce(
        (acc, point) => {
            const costValue = point.costActual ?? point.costForecast ?? 0;
            const revenueValue = point.revenueActual ?? point.revenueForecast ?? 0;

            acc.costCumulative += costValue;
            acc.revenueCumulative += revenueValue;
            acc.marginCumulative = acc.revenueCumulative - acc.costCumulative;

            acc.labels.push(point.monthLabel);
            acc.costValues.push(acc.costCumulative);
            acc.revenueValues.push(acc.revenueCumulative);
            acc.marginValues.push(acc.marginCumulative);

            // Track colors - use modern palette
            const costIsActual = point.costActual !== null;
            const revenueIsActual = point.revenueActual !== null;
            acc.costIsActual.push(costIsActual);
            acc.revenueIsActual.push(revenueIsActual);
            acc.pointColors.cost.push(costIsActual ? COLORS.costActual : COLORS.costForecast);
            acc.pointColors.revenue.push(revenueIsActual ? COLORS.revenueActual : COLORS.revenueForecast);
            acc.pointColors.margin.push(costIsActual && revenueIsActual ? COLORS.marginActual : COLORS.marginForecast);

            return acc;
        },
        {
            costCumulative: 0,
            revenueCumulative: 0,
            marginCumulative: 0,
            labels: [] as string[],
            costValues: [] as number[],
            revenueValues: [] as number[],
            marginValues: [] as number[],
            costIsActual: [] as boolean[],
            revenueIsActual: [] as boolean[],
            pointColors: { cost: [] as string[], revenue: [] as string[], margin: [] as string[] },
        },
    );

    // Calculate final totals
    const finalCost = cumulativeData.costCumulative;
    const finalRevenue = cumulativeData.revenueCumulative;
    const finalMargin = finalRevenue - finalCost;
    const marginPercent = finalRevenue > 0 ? (finalMargin / finalRevenue) * 100 : 0;

    // Calculate actuals to date
    const actualsToDate = tableData.reduce((sum, row) => (row.isActual ? sum + row.monthlyRevenue : sum), 0);
    const actualsPercent = totalRevenueBudget > 0 ? (actualsToDate / totalRevenueBudget) * 100 : 0;

    // Chart data for dollar view - with modern styling
    const chartDataDollar = {
        labels: cumulativeData.labels,
        datasets: [
            {
                label: 'Revenue',
                data: cumulativeData.revenueValues,
                borderColor: COLORS.revenueActual,
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                backgroundColor: (context: any) => {
                    const chart = context.chart;
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return COLORS.revenueGradientStart;
                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, COLORS.revenueGradientStart);
                    gradient.addColorStop(1, COLORS.revenueGradientEnd);
                    return gradient;
                },
                pointRadius: 6,
                pointHoverRadius: 9,
                pointBackgroundColor: cumulativeData.pointColors.revenue,
                pointBorderColor: isDark ? '#1f2937' : '#ffffff',
                pointBorderWidth: 2.5,
                segment: {
                    borderColor: (ctx: any) => cumulativeData.revenueIsActual[ctx.p1DataIndex] ? COLORS.revenueActual : COLORS.revenueForecast,
                    borderDash: (ctx: any) => {
                        const point = accrualData[ctx.p1DataIndex];
                        return point && point.revenueActual === null ? [6, 4] : [];
                    },
                },
            },
            {
                label: 'Cost',
                data: cumulativeData.costValues,
                borderColor: COLORS.costActual,
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                backgroundColor: (context: any) => {
                    const chart = context.chart;
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return COLORS.costGradientStart;
                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, COLORS.costGradientStart);
                    gradient.addColorStop(1, COLORS.costGradientEnd);
                    return gradient;
                },
                pointRadius: 6,
                pointHoverRadius: 9,
                pointBackgroundColor: cumulativeData.pointColors.cost,
                pointBorderColor: isDark ? '#1f2937' : '#ffffff',
                pointBorderWidth: 2.5,
                segment: {
                    borderColor: (ctx: any) => cumulativeData.costIsActual[ctx.p1DataIndex] ? COLORS.costActual : COLORS.costForecast,
                    borderDash: (ctx: any) => {
                        const point = accrualData[ctx.p1DataIndex];
                        return point && point.costActual === null ? [6, 4] : [];
                    },
                },
            },
            {
                label: 'Margin',
                data: cumulativeData.marginValues,
                borderColor: COLORS.marginActual,
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                backgroundColor: (context: any) => {
                    const chart = context.chart;
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return COLORS.marginGradientStart;
                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, COLORS.marginGradientStart);
                    gradient.addColorStop(1, COLORS.marginGradientEnd);
                    return gradient;
                },
                pointRadius: 6,
                pointHoverRadius: 9,
                pointBackgroundColor: cumulativeData.pointColors.margin,
                pointBorderColor: isDark ? '#1f2937' : '#ffffff',
                pointBorderWidth: 2.5,
                segment: {
                    borderColor: (ctx: any) => {
                        const costIsActual = cumulativeData.costIsActual[ctx.p1DataIndex];
                        const revenueIsActual = cumulativeData.revenueIsActual[ctx.p1DataIndex];
                        return costIsActual && revenueIsActual ? COLORS.marginActual : COLORS.marginForecast;
                    },
                    borderDash: (ctx: any) => {
                        const point = accrualData[ctx.p1DataIndex];
                        const costIsActual = point && point.costActual !== null;
                        const revenueIsActual = point && point.revenueActual !== null;
                        return costIsActual && revenueIsActual ? [] : [6, 4];
                    },
                },
            },
        ],
    };

    // Chart data for percentage view - with modern styling
    const chartDataPercent = {
        labels: cumulativeData.labels,
        datasets: [
            {
                label: 'Revenue %',
                data: cumulativeData.revenueValues.map((v) => (totalRevenueBudget > 0 ? (v / totalRevenueBudget) * 100 : 0)),
                borderColor: COLORS.revenueActual,
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                backgroundColor: (context: any) => {
                    const chart = context.chart;
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return COLORS.revenueGradientStart;
                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, COLORS.revenueGradientStart);
                    gradient.addColorStop(1, COLORS.revenueGradientEnd);
                    return gradient;
                },
                pointRadius: 6,
                pointHoverRadius: 9,
                pointBackgroundColor: cumulativeData.pointColors.revenue,
                pointBorderColor: isDark ? '#1f2937' : '#ffffff',
                pointBorderWidth: 2.5,
            },
            {
                label: 'Cost %',
                data: cumulativeData.costValues.map((v) => (totalCostBudget > 0 ? (v / totalCostBudget) * 100 : 0)),
                borderColor: COLORS.costActual,
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                backgroundColor: (context: any) => {
                    const chart = context.chart;
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return COLORS.costGradientStart;
                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, COLORS.costGradientStart);
                    gradient.addColorStop(1, COLORS.costGradientEnd);
                    return gradient;
                },
                pointRadius: 6,
                pointHoverRadius: 9,
                pointBackgroundColor: cumulativeData.pointColors.cost,
                pointBorderColor: isDark ? '#1f2937' : '#ffffff',
                pointBorderWidth: 2.5,
            },
            {
                label: 'Margin %',
                data: cumulativeData.marginValues.map((v) => (totalRevenueBudget > 0 ? (v / totalRevenueBudget) * 100 : 0)),
                borderColor: COLORS.marginActual,
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                backgroundColor: (context: any) => {
                    const chart = context.chart;
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return COLORS.marginGradientStart;
                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, COLORS.marginGradientStart);
                    gradient.addColorStop(1, COLORS.marginGradientEnd);
                    return gradient;
                },
                pointRadius: 6,
                pointHoverRadius: 9,
                pointBackgroundColor: cumulativeData.pointColors.margin,
                pointBorderColor: isDark ? '#1f2937' : '#ffffff',
                pointBorderWidth: 2.5,
            },
        ],
    };

    const chartOptionsDollar: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 600,
            easing: 'easeOutQuart',
        },
        interaction: {
            mode: 'index',
            intersect: false,
        },
        layout: {
            padding: {
                top: 10,
                right: 10,
                left: 10,
            },
        },
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    usePointStyle: true,
                    pointStyle: 'circle',
                    padding: 20,
                    font: {
                        size: 12,
                        weight: 600,
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
                titleFont: {
                    size: 13,
                    weight: 600,
                    family: "'Inter', system-ui, sans-serif",
                },
                bodyFont: {
                    size: 12,
                    family: "'Inter', system-ui, sans-serif",
                },
                callbacks: {
                    label: (ctx) => `${ctx.dataset.label}: $${Number(ctx.parsed.y).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                },
            },
        },
        scales: {
            x: {
                grid: {
                    display: true,
                    color: COLORS.gridColor,
                    drawOnChartArea: true,
                    drawTicks: false,
                },
                ticks: {
                    maxRotation: 45,
                    autoSkip: true,
                    padding: 8,
                    font: {
                        size: 11,
                        weight: 500,
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
                grid: {
                    display: true,
                    color: COLORS.gridColor,
                },
                ticks: {
                    padding: 8,
                    font: {
                        size: 11,
                        weight: 500,
                        family: "'Inter', system-ui, sans-serif",
                    },
                    color: COLORS.mutedText,
                    callback: (v) => `$${Number(v).toLocaleString()}`,
                },
                border: {
                    display: false,
                },
            },
        },
    };

    const chartOptionsPercent: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 600,
            easing: 'easeOutQuart',
        },
        interaction: {
            mode: 'index',
            intersect: false,
        },
        layout: {
            padding: {
                top: 10,
                right: 10,
                left: 10,
            },
        },
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    usePointStyle: true,
                    pointStyle: 'circle',
                    padding: 20,
                    font: {
                        size: 12,
                        weight: 600,
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
                titleFont: {
                    size: 13,
                    weight: 600,
                    family: "'Inter', system-ui, sans-serif",
                },
                bodyFont: {
                    size: 12,
                    family: "'Inter', system-ui, sans-serif",
                },
                callbacks: {
                    label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.y).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`,
                },
            },
        },
        scales: {
            x: {
                grid: {
                    display: true,
                    color: COLORS.gridColor,
                    drawOnChartArea: true,
                    drawTicks: false,
                },
                ticks: {
                    maxRotation: 45,
                    autoSkip: true,
                    padding: 8,
                    font: {
                        size: 11,
                        weight: 500,
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
                grid: {
                    display: true,
                    color: COLORS.gridColor,
                },
                ticks: {
                    padding: 8,
                    font: {
                        size: 11,
                        weight: 500,
                        family: "'Inter', system-ui, sans-serif",
                    },
                    color: COLORS.mutedText,
                    callback: (v) => `${Number(v).toLocaleString()}%`,
                },
                border: {
                    display: false,
                },
            },
        },
    };

    const handlePrint = async () => {
        if (!reportRef.current) return;

        try {
            // Convert charts to images
            const chartDollarImg = chartRefDollar.current?.toBase64Image();
            const chartPercentImg = chartRefPercent.current?.toBase64Image();

            const printWindow = window.open('', '', 'width=1200,height=800');
            if (printWindow) {
                printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                        <head>
                            <title>Revenue Report - ${jobName}</title>
                            <style>
                                * {
                                    margin: 0;
                                    padding: 0;
                                    box-sizing: border-box;
                                }
                                body {
                                    font-family: 'Segoe UI', Arial, sans-serif;
                                    padding: 30px 40px;
                                    color: #333;
                                    font-size: 11px;
                                    line-height: 1.4;
                                }
                                .report-header {
                                    text-align: center;
                                    margin-bottom: 25px;
                                    padding-bottom: 15px;
                                    border-bottom: 1px solid #ccc;
                                }
                                .logo {
                                    max-width: 150px;
                                    margin-bottom: 8px;
                                }
                                h1 {
                                    color: #1a1a1a;
                                    margin: 8px 0 4px 0;
                                    font-size: 22px;
                                    font-weight: 600;
                                }
                                h2 {
                                    color: #333;
                                    margin: 20px 0 10px 0;
                                    font-size: 14px;
                                    font-weight: 600;
                                    border-bottom: 1px solid #ddd;
                                    padding-bottom: 5px;
                                }
                                .meta {
                                    color: #666;
                                    font-size: 11px;
                                    margin: 2px 0;
                                }

                                /* Summary - Clean minimal boxes */
                                .summary-box {
                                    margin-bottom: 25px;
                                }
                                .summary-grid {
                                    display: grid;
                                    grid-template-columns: repeat(4, 1fr);
                                    gap: 12px;
                                }
                                .summary-item {
                                    padding: 12px;
                                    border: 1px solid #ddd;
                                    border-radius: 4px;
                                }
                                .summary-item label {
                                    font-size: 9px;
                                    color: #666;
                                    text-transform: uppercase;
                                    letter-spacing: 0.3px;
                                    display: block;
                                    margin-bottom: 4px;
                                }
                                .summary-item .value {
                                    font-size: 16px;
                                    font-weight: 600;
                                    color: #1a1a1a;
                                }
                                .summary-item .sub-value {
                                    font-size: 9px;
                                    color: #666;
                                    margin-top: 2px;
                                }

                                /* Table Styles - Clean and minimal */
                                .data-table {
                                    width: 100%;
                                    border-collapse: collapse;
                                    margin: 15px 0;
                                    font-size: 10px;
                                }
                                .data-table thead {
                                    background: #f5f5f5;
                                }
                                .data-table th {
                                    padding: 8px 6px;
                                    text-align: right;
                                    font-weight: 600;
                                    border: 1px solid #ddd;
                                    color: #333;
                                }
                                .data-table th:first-child {
                                    text-align: left;
                                }
                                .data-table td {
                                    padding: 6px;
                                    text-align: right;
                                    border: 1px solid #ddd;
                                }
                                .data-table td:first-child {
                                    text-align: left;
                                }
                                .data-table tbody tr:nth-child(even) {
                                    background: #fafafa;
                                }
                                .data-table tbody tr.actual-row td:first-child::after {
                                    content: ' (Actual)';
                                    font-size: 8px;
                                    color: #666;
                                }
                                .data-table tfoot {
                                    background: #f0f0f0;
                                    font-weight: 600;
                                }
                                .data-table tfoot td {
                                    border-top: 2px solid #999;
                                }

                                .chart-section {
                                    margin-top: 25px;
                                    page-break-inside: avoid;
                                }
                                .chart-section img {
                                    max-width: 100%;
                                    height: auto;
                                    border: 1px solid #ddd;
                                }
                                .legend {
                                    margin-top: 20px;
                                    padding: 10px;
                                    border: 1px solid #ddd;
                                    font-size: 9px;
                                    color: #666;
                                }
                                .legend p {
                                    margin-bottom: 5px;
                                    font-weight: 600;
                                    color: #333;
                                }
                                .legend-items {
                                    display: flex;
                                    flex-wrap: wrap;
                                    gap: 15px;
                                }
                                .legend-item {
                                    display: flex;
                                    align-items: center;
                                    gap: 5px;
                                }
                                .legend-dot {
                                    width: 8px;
                                    height: 8px;
                                    border-radius: 50%;
                                    display: inline-block;
                                }
                                .legend-line {
                                    width: 20px;
                                    height: 0;
                                    border-top: 2px dashed #999;
                                    display: inline-block;
                                }
                                @media print {
                                    body {
                                        padding: 15px 25px;
                                    }
                                    .no-print {
                                        display: none !important;
                                    }
                                    .chart-section {
                                        page-break-before: always;
                                    }
                                }
                            </style>
                        </head>
                        <body>
                            <div class="report-header">
                                <img src="/logo.png" alt="Company Logo" class="logo" />
                                <h1>${jobName}</h1>
                                <p class="meta">Job Number: ${jobNumber}</p>
                                <p class="meta">Report Generated: ${new Date().toLocaleDateString()}</p>
                            </div>

                            <div class="summary-box">
                                <h2>Project Summary</h2>
                                <div class="summary-grid">
                                    <div class="summary-item">
                                        <label>Contract Value</label>
                                        <div class="value">$${totalRevenueBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                    </div>

                                    <div class="summary-item">
                                        <label>Actuals to Date</label>
                                        <div class="value">$${actualsToDate.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                        <div class="sub-value">${actualsPercent.toFixed(1)}% Complete</div>
                                    </div>

                                    <div class="summary-item">
                                        <label>Remaining</label>
                                        <div class="value">$${(totalRevenueBudget - finalRevenue).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                    </div>

                                    <div class="summary-item">
                                        <label>Projected Margin</label>
                                        <div class="value">$${finalMargin.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                        <div class="sub-value">${marginPercent.toFixed(1)}% of Revenue</div>
                                    </div>
                                </div>
                            </div>

                            <h2>Revenue Forecast</h2>
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Month</th>
                                        <th>Monthly Claim</th>
                                        <th>Monthly Cost</th>
                                        <th>Monthly Profit</th>
                                        <th>Claimed to Date</th>
                                        <th>Cost to Date</th>
                                        <th>Profit to Date</th>
                                        <th>Claimed %</th>
                                        <th>Remaining</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableData
                                        .map(
                                            (row) => `
                                        <tr class="${row.isActual ? 'actual-row' : ''}">
                                            <td>${row.month}</td>
                                            <td>${row.monthlyRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                            <td>${row.monthlyCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                            <td>${(row.monthlyRevenue - row.monthlyCost).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                            <td>${row.cumulativeRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                            <td>${row.cumulativeCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                            <td>${(row.cumulativeRevenue - row.cumulativeCost).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                            <td>${row.percentComplete.toFixed(1)}%</td>
                                            <td>${row.remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                        </tr>
                                    `,
                                        )
                                        .join('')}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td>TOTAL</td>
                                        <td colspan="3">Contract: $${totalRevenueBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                        <td>${finalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                        <td>${finalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                        <td>${finalMargin.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                        <td>${((finalRevenue / totalRevenueBudget) * 100).toFixed(1)}%</td>
                                        <td>${(totalRevenueBudget - finalRevenue).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                    </tr>
                                </tfoot>
                            </table>

                            ${
                                chartDollarImg
                                    ? `
                            <div class="chart-section">
                                <h2>Accrual Progression ($)</h2>
                                <img src="${chartDollarImg}" alt="Accrual Chart (Dollars)" />
                            </div>
                            `
                                    : ''
                            }

                            ${
                                chartPercentImg
                                    ? `
                            <div class="chart-section">
                                <h2>Accrual Progression (%)</h2>
                                <img src="${chartPercentImg}" alt="Accrual Chart (Percent)" />
                            </div>
                            `
                                    : ''
                            }

                            <div class="legend">
                                <p>Chart Legend</p>
                                <div class="legend-items">
                                    <div class="legend-item">
                                        <span class="legend-dot" style="background: #3b82f6;"></span>
                                        Cost
                                    </div>
                                    <div class="legend-item">
                                        <span class="legend-dot" style="background: #22c55e;"></span>
                                        Revenue
                                    </div>
                                    <div class="legend-item">
                                        <span class="legend-dot" style="background: #8b5cf6;"></span>
                                        Margin
                                    </div>
                                    <div class="legend-item">
                                        <span class="legend-line"></span>
                                        Forecast period
                                    </div>
                                </div>
                            </div>
                        </body>
                    </html>
                `);
                printWindow.document.close();
                printWindow.focus();
                setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                }, 500);
            }
        } catch {
            // Error generating print view
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex h-[95vh] w-[98vw] max-w-[98vw] flex-col overflow-hidden border border-slate-200 bg-white p-0 shadow-xl sm:h-[90vh] sm:w-[95vw] sm:max-w-[1400px] sm:rounded-xl dark:border-slate-700 dark:bg-slate-900">
                {/* Header - indigo accent with subtle gradient */}
                <div className="relative flex-shrink-0 overflow-hidden border-b-2 border-indigo-100 bg-gradient-to-r from-slate-50 via-indigo-50/50 to-violet-50/30 px-4 py-3 pr-12 sm:px-6 sm:py-4 sm:pr-14 dark:border-indigo-900/50 dark:from-slate-800 dark:via-indigo-950/30 dark:to-slate-800">
                    {/* Subtle decorative element */}
                    <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-indigo-200/20 blur-3xl dark:bg-indigo-500/10" />
                    <div className="relative flex items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 shadow-md shadow-indigo-500/30">
                                <FileText className="h-4 w-4 text-white" />
                            </div>
                            <div className="min-w-0">
                                <DialogTitle className="truncate text-sm font-semibold text-slate-800 sm:text-base dark:text-slate-100">
                                    Revenue Report
                                </DialogTitle>
                                <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70">{jobName}</p>
                            </div>
                        </div>
                        <Button
                            onClick={handlePrint}
                            size="sm"
                            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-indigo-500/30 transition-all hover:from-indigo-600 hover:to-violet-600"
                        >
                            <Printer className="h-4 w-4" />
                            <span className="hidden sm:inline">Print Report</span>
                        </Button>
                    </div>
                </div>

                <DialogHeader className="sr-only">
                    <DialogTitle>Revenue Report</DialogTitle>
                </DialogHeader>

                <div ref={reportRef} className="min-h-0 flex-1 space-y-6 overflow-auto bg-white px-4 py-4 sm:px-6 dark:bg-slate-900">
                    {/* Report Header */}
                    <div className="report-header border-b border-slate-200 pb-6 text-center dark:border-slate-700">
                        <img src="/logo.png" alt="Company Logo" className="mx-auto mb-4 h-16" />
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{jobName}</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Job Number: {jobNumber}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Report Generated: {new Date().toLocaleDateString()}</p>
                    </div>

                    {/* Summary Boxes */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800/50">
                        <div className="mb-4 flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
                            <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Project Summary</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                            <div className="rounded-lg border-l-4 border-blue-500 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:bg-slate-800">
                                <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Contract Value</label>
                                <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                                    ${totalRevenueBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </div>
                            </div>

                            <div className="rounded-lg border-l-4 border-green-500 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:bg-slate-800">
                                <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Actuals to Date</label>
                                <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                                    ${actualsToDate.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </div>
                                <div className="mt-1 text-xs font-medium text-green-600 dark:text-green-400">{actualsPercent.toFixed(1)}% Complete</div>
                            </div>

                            <div className="rounded-lg border-l-4 border-slate-400 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-slate-500 dark:bg-slate-800">
                                <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Remaining</label>
                                <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                                    ${(totalRevenueBudget - finalRevenue).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </div>
                            </div>

                            <div className="rounded-lg border-l-4 border-violet-500 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:bg-slate-800">
                                <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Projected Margin</label>
                                <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                                    ${finalMargin.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </div>
                                <div className="mt-1 text-xs font-medium text-violet-600 dark:text-violet-400">{marginPercent.toFixed(1)}% of Revenue</div>
                            </div>
                        </div>
                    </div>

                    {/* Revenue Forecast Table */}
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/50">
                        <div className="mb-3 flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
                            <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Revenue Forecast</h2>
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                            <table className="w-full text-sm">
                                <thead className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-700 dark:to-slate-800">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Month</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">Monthly Claim</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">Monthly Cost</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">Monthly Profit</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">Claimed to Date</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">Cost to Date</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">Profit to Date</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">Claimed %</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">Remaining ($)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tableData.map((row, idx) => (
                                        <tr
                                            key={row.monthKey}
                                            className={`transition-colors ${
                                                row.isActual
                                                    ? 'bg-amber-50/70 dark:bg-amber-900/20'
                                                    : idx % 2 === 0
                                                      ? 'bg-white dark:bg-slate-800'
                                                      : 'bg-slate-50/50 dark:bg-slate-800/50'
                                            }`}
                                        >
                                            <td className="border-t border-slate-100 px-4 py-2.5 font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">
                                                {row.month}
                                                {row.isActual && (
                                                    <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                                                        Actual
                                                    </span>
                                                )}
                                            </td>
                                            <td className="border-t border-slate-100 px-4 py-2.5 text-right text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                                {row.monthlyRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </td>
                                            <td className="border-t border-slate-100 px-4 py-2.5 text-right text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                                {row.monthlyCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </td>
                                            <td className="border-t border-slate-100 px-4 py-2.5 text-right text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                                {(row.monthlyRevenue - row.monthlyCost).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </td>
                                            <td className="border-t border-slate-100 px-4 py-2.5 text-right font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">
                                                {row.cumulativeRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </td>
                                            <td className="border-t border-slate-100 px-4 py-2.5 text-right font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">
                                                {row.cumulativeCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </td>
                                            <td className="border-t border-slate-100 px-4 py-2.5 text-right font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">
                                                {(row.cumulativeRevenue - row.cumulativeCost).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </td>
                                            <td className="border-t border-slate-100 px-4 py-2.5 text-right text-slate-600 dark:border-slate-700 dark:text-slate-300">{row.percentComplete.toFixed(1)}%</td>
                                            <td className="border-t border-slate-100 px-4 py-2.5 text-right text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                                {row.remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-100 font-bold dark:bg-slate-700">
                                    <tr>
                                        <td className="border-t-2 border-slate-300 px-4 py-3 text-slate-800 dark:border-slate-600 dark:text-slate-100">TOTAL</td>
                                        <td className="border-t-2 border-slate-300 px-4 py-3 text-right text-slate-600 dark:border-slate-600 dark:text-slate-300">Total to Claim:</td>
                                        <td className="border-t-2 border-slate-300 px-4 py-3 text-right text-slate-800 dark:border-slate-600 dark:text-slate-100">
                                            {totalRevenueBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </td>
                                        <td className="border-t-2 border-slate-300 px-4 py-3 text-right text-slate-600 dark:border-slate-600 dark:text-slate-300">Total Claimed:</td>
                                        <td className="border-t-2 border-slate-300 px-4 py-3 text-right text-slate-800 dark:border-slate-600 dark:text-slate-100">
                                            {finalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} (
                                            {((finalRevenue / totalRevenueBudget) * 100).toFixed(1)}%)
                                        </td>
                                        <td className="border-t-2 border-slate-300 px-4 py-3 text-right dark:border-slate-600"></td>
                                        <td className="border-t-2 border-slate-300 px-4 py-3 text-right dark:border-slate-600"></td>
                                        <td className="border-t-2 border-slate-300 px-4 py-3 text-right text-slate-600 dark:border-slate-600 dark:text-slate-300">Remaining:</td>
                                        <td className="border-t-2 border-slate-300 px-4 py-3 text-right text-slate-800 dark:border-slate-600 dark:text-slate-100">
                                            {(totalRevenueBudget - finalRevenue).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Charts Grid */}
                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Chart Section - Accrual $ */}
                        <div className="chart-section rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/50">
                            <div className="mb-3 flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
                                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Accrual Progression ($)</h2>
                            </div>
                            <div className="h-72 rounded-lg bg-slate-50/50 p-3 dark:bg-slate-900/50">
                                <Line ref={chartRefDollar} data={chartDataDollar} options={chartOptionsDollar} key={`dollar-${isDark}`} />
                            </div>
                        </div>

                        {/* Chart Section - Accrual % */}
                        <div className="chart-section rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/50">
                            <div className="mb-3 flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
                                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Accrual Progression (%)</h2>
                            </div>
                            <div className="h-72 rounded-lg bg-slate-50/50 p-3 dark:bg-slate-900/50">
                                <Line ref={chartRefPercent} data={chartDataPercent} options={chartOptionsPercent} key={`percent-${isDark}`} />
                            </div>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-800/50">
                        <p className="mb-3 font-semibold text-slate-700 dark:text-slate-200">Legend</p>
                        <div className="flex flex-wrap gap-6 text-xs">
                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS.costActual }}></span>
                                <span className="text-slate-600 dark:text-slate-300">Cost</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS.revenueActual }}></span>
                                <span className="text-slate-600 dark:text-slate-300">Revenue</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS.marginActual }}></span>
                                <span className="text-slate-600 dark:text-slate-300">Margin</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-6 border-t-2 border-dashed border-slate-400"></span>
                                <span className="text-slate-600 dark:text-slate-300">Forecast period</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                                    Actual
                                </span>
                                <span className="text-slate-600 dark:text-slate-300">Actual values</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-2.5 sm:px-6 dark:border-slate-700 dark:bg-slate-800/50">
                    <p className="text-[10px] text-slate-500 sm:text-xs dark:text-slate-400">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Tip:</span> Solid lines represent actuals, dashed lines represent forecast values. Click legend items to toggle visibility.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
