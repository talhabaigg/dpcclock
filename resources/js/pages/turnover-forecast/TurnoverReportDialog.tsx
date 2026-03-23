/**
 * Cumulative Turnover Forecast Report Dialog - Generates a professional report with summarized data
 * for all filtered jobs including monthly, month-to-date cumulative, and remaining figures.
 * Styled to match the Print Report's slate design system.
 */

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    CategoryScale,
    Chart as ChartJS,
    Tooltip as ChartTooltip,
    Filler,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    type ChartOptions,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Printer } from 'lucide-react';
import { useRef } from 'react';
import { Line } from 'react-chartjs-2';
import type { TurnoverRow } from './lib/data-transformer';
import { currentMonthStr, formatCurrency, safeNumber } from './lib/utils';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTooltip, Filler, Legend, ChartDataLabels);

const formatMonthHeader = (month: string): string => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
    return date.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' });
};

const formatCompactCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value as number) || !isFinite(value as number) || value === 0) {
        return '-';
    }
    return formatCurrency(value);
};

const formatPercent = (numerator: number, denominator: number): string => {
    if (denominator > 0 && isFinite(numerator / denominator)) {
        return ((numerator / denominator) * 100).toFixed(1);
    }
    return '0.0';
};

interface TurnoverReportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    data: TurnoverRow[];
    months: string[];
    lastActualMonth: string | null;
    fyLabel: string;
    allMonths: string[];
}

export function TurnoverReportDialog({ open, onOpenChange, data, months, lastActualMonth, fyLabel, allMonths }: TurnoverReportDialogProps) {
    const reportRef = useRef<HTMLDivElement>(null);
    const chartRefRevenue = useRef<any>(null);
    const chartRefCost = useRef<any>(null);
    const chartRefProfit = useRef<any>(null);

    // Calculate monthly totals and cumulative values
    const monthlyData = months.map((month, index) => {
        let monthlyRevenue = 0;
        let monthlyCost = 0;

        data.forEach((row) => {
            const actualRevenue = safeNumber(row.revenue_actuals?.[month]);
            const forecastRevenue = safeNumber(row.revenue_forecast?.[month]);
            let revenue: number;
            if (month === currentMonthStr) {
                revenue = forecastRevenue !== 0 ? forecastRevenue : actualRevenue;
            } else {
                revenue = actualRevenue !== 0 ? actualRevenue : forecastRevenue;
            }

            const actualCost = safeNumber(row.cost_actuals?.[month]);
            const forecastCost = safeNumber(row.cost_forecast?.[month]);
            let cost: number;
            if (month === currentMonthStr) {
                cost = forecastCost !== 0 ? forecastCost : actualCost;
            } else {
                cost = actualCost !== 0 ? actualCost : forecastCost;
            }

            monthlyRevenue += revenue;
            monthlyCost += cost;
        });

        const monthlyProfit = monthlyRevenue - monthlyCost;

        // Calculate cumulative up to this point
        const cumulativeRevenue = months.slice(0, index + 1).reduce((sum, m) => {
            let monthTotal = 0;
            data.forEach((row) => {
                const av = safeNumber(row.revenue_actuals?.[m]);
                const fv = safeNumber(row.revenue_forecast?.[m]);
                if (m === currentMonthStr) {
                    monthTotal += fv !== 0 ? fv : av;
                } else {
                    monthTotal += av !== 0 ? av : fv;
                }
            });
            return sum + monthTotal;
        }, 0);

        const cumulativeCost = months.slice(0, index + 1).reduce((sum, m) => {
            let monthTotal = 0;
            data.forEach((row) => {
                const av = safeNumber(row.cost_actuals?.[m]);
                const fv = safeNumber(row.cost_forecast?.[m]);
                if (m === currentMonthStr) {
                    monthTotal += fv !== 0 ? fv : av;
                } else {
                    monthTotal += av !== 0 ? av : fv;
                }
            });
            return sum + monthTotal;
        }, 0);

        const cumulativeProfit = cumulativeRevenue - cumulativeCost;
        const isActualMonth = lastActualMonth ? month <= lastActualMonth && month !== currentMonthStr : false;

        return {
            month,
            monthLabel: formatMonthHeader(month),
            isActual: isActualMonth,
            monthlyRevenue,
            monthlyCost,
            monthlyProfit,
            cumulativeRevenue,
            cumulativeCost,
            cumulativeProfit,
        };
    });

    // Calculate totals
    const totals = data.reduce(
        (acc, row) => {
            acc.claimedToDate += safeNumber(row.claimed_to_date);
            acc.costToDate += safeNumber(row.cost_to_date);
            // Compute FY values from filtered months instead of backend's fixed current FY
            months.forEach((m) => {
                const rActual = safeNumber(row.revenue_actuals?.[m]);
                const rForecast = safeNumber(row.revenue_forecast?.[m]);
                const rValue = m === currentMonthStr ? (rForecast !== 0 ? rForecast : rActual) : (rActual !== 0 ? rActual : rForecast);
                acc.revenueContractFY += rValue;
                if (rActual !== 0 && m !== currentMonthStr) acc.revenueActualsFY += rActual;
                else if (m === currentMonthStr && rForecast === 0 && rActual !== 0) acc.revenueActualsFY += rActual;

                const cActual = safeNumber(row.cost_actuals?.[m]);
                const cForecast = safeNumber(row.cost_forecast?.[m]);
                const cValue = m === currentMonthStr ? (cForecast !== 0 ? cForecast : cActual) : (cActual !== 0 ? cActual : cForecast);
                acc.costContractFY += cValue;
                if (cActual !== 0 && m !== currentMonthStr) acc.costActualsFY += cActual;
                else if (m === currentMonthStr && cForecast === 0 && cActual !== 0) acc.costActualsFY += cActual;
            });
            acc.totalContractValue += safeNumber(row.total_contract_value);
            acc.budget += safeNumber(row.budget);
            acc.remainingOrderBook += safeNumber(row.remaining_order_book);
            acc.remainingBudget += safeNumber(row.remaining_budget);
            return acc;
        },
        {
            claimedToDate: 0,
            costToDate: 0,
            revenueContractFY: 0,
            costContractFY: 0,
            revenueActualsFY: 0,
            costActualsFY: 0,
            totalContractValue: 0,
            budget: 0,
            remainingOrderBook: 0,
            remainingBudget: 0,
        },
    );

    const profitToDate = totals.claimedToDate - totals.costToDate;
    const profitContractFY = totals.revenueContractFY - totals.costContractFY;
    const profitTotal = totals.totalContractValue - totals.budget;
    const marginPercent = totals.revenueContractFY > 0 ? (profitContractFY / totals.revenueContractFY) * 100 : 0;

    // Remaining based on cumulative up to last actual month
    const monthsUpToLastActual = lastActualMonth ? allMonths.filter((m) => m <= lastActualMonth) : [];

    const cumulativeRevenueToDate = monthsUpToLastActual.reduce((sum, m) => {
        let monthTotal = 0;
        data.forEach((row) => {
            const av = safeNumber(row.revenue_actuals?.[m]);
            const fv = safeNumber(row.revenue_forecast?.[m]);
            monthTotal += av !== 0 ? av : fv;
        });
        return sum + monthTotal;
    }, 0);

    const cumulativeCostToDate = monthsUpToLastActual.reduce((sum, m) => {
        let monthTotal = 0;
        data.forEach((row) => {
            const av = safeNumber(row.cost_actuals?.[m]);
            const fv = safeNumber(row.cost_forecast?.[m]);
            monthTotal += av !== 0 ? av : fv;
        });
        return sum + monthTotal;
    }, 0);

    const remainingRevenue = totals.totalContractValue - cumulativeRevenueToDate;
    const remainingCost = totals.budget - cumulativeCostToDate;
    const remainingProfit = remainingRevenue - remainingCost;

    // Shared segment helper — dashed line for forecast months
    const forecastSegment = {
        borderDash: (ctx: any) => {
            const point = monthlyData[ctx.p1DataIndex];
            return point && !point.isActual ? [5, 3] : [];
        },
    };

    // Chart data for Revenue — slate-toned greens
    const chartDataRevenue = {
        labels: monthlyData.map((d) => d.monthLabel),
        datasets: [
            {
                label: 'Monthly Revenue',
                data: monthlyData.map((d) => d.monthlyRevenue),
                borderColor: '#047857',
                backgroundColor: 'rgba(4, 120, 87, 0.08)',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 3,
                pointHoverRadius: 5,
                pointBackgroundColor: monthlyData.map((d) => (d.isActual ? '#334155' : '#047857')),
                pointBorderColor: monthlyData.map((d) => (d.isActual ? '#334155' : '#047857')),
                segment: forecastSegment,
                fill: false,
            },
            {
                label: 'Cumulative Revenue',
                data: monthlyData.map((d) => d.cumulativeRevenue),
                borderColor: '#94a3b8',
                backgroundColor: 'transparent',
                borderWidth: 1.5,
                tension: 0.3,
                pointRadius: 2,
                pointHoverRadius: 4,
                pointBackgroundColor: '#94a3b8',
                borderDash: [3, 3],
            },
        ],
    };

    // Chart data for Cost — slate-toned reds
    const chartDataCost = {
        labels: monthlyData.map((d) => d.monthLabel),
        datasets: [
            {
                label: 'Monthly Cost',
                data: monthlyData.map((d) => d.monthlyCost),
                borderColor: '#dc2626',
                backgroundColor: 'rgba(220, 38, 38, 0.08)',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 3,
                pointHoverRadius: 5,
                pointBackgroundColor: monthlyData.map((d) => (d.isActual ? '#334155' : '#dc2626')),
                pointBorderColor: monthlyData.map((d) => (d.isActual ? '#334155' : '#dc2626')),
                segment: forecastSegment,
                fill: false,
            },
            {
                label: 'Cumulative Cost',
                data: monthlyData.map((d) => d.cumulativeCost),
                borderColor: '#94a3b8',
                backgroundColor: 'transparent',
                borderWidth: 1.5,
                tension: 0.3,
                pointRadius: 2,
                pointHoverRadius: 4,
                pointBackgroundColor: '#94a3b8',
                borderDash: [3, 3],
            },
        ],
    };

    // Chart data for Profit — slate-toned
    const chartDataProfit = {
        labels: monthlyData.map((d) => d.monthLabel),
        datasets: [
            {
                label: 'Monthly Profit',
                data: monthlyData.map((d) => d.monthlyProfit),
                borderColor: '#334155',
                backgroundColor: 'rgba(51, 65, 85, 0.08)',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 3,
                pointHoverRadius: 5,
                pointBackgroundColor: monthlyData.map((d) => (d.isActual ? '#1e293b' : '#64748b')),
                pointBorderColor: monthlyData.map((d) => (d.isActual ? '#1e293b' : '#64748b')),
                segment: forecastSegment,
                fill: false,
            },
            {
                label: 'Cumulative Profit',
                data: monthlyData.map((d) => d.cumulativeProfit),
                borderColor: '#94a3b8',
                backgroundColor: 'transparent',
                borderWidth: 1.5,
                tension: 0.3,
                pointRadius: 2,
                pointHoverRadius: 4,
                pointBackgroundColor: '#94a3b8',
                borderDash: [3, 3],
            },
        ],
    };

    const chartOptions: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
            datalabels: {
                display: 'auto',
                clip: false,
                clamp: true,
                anchor: 'end',
                align: 'top',
                offset: 4,
                font: { size: 9, weight: 'bold' as const },
                color: '#475569',
                formatter: (value: number) => {
                    if (value === 0) return '';
                    if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
                    if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
                    return `$${value.toFixed(0)}`;
                },
            },
            legend: { display: false },
            tooltip: {
                backgroundColor: '#1e293b',
                titleColor: '#f8fafc',
                bodyColor: '#e2e8f0',
                borderColor: '#475569',
                borderWidth: 1,
                padding: 10,
                cornerRadius: 4,
                titleFont: { size: 11, weight: 'bold' as const },
                bodyFont: { size: 11 },
                callbacks: {
                    label: (ctx) => `${ctx.dataset.label}: $${Number(ctx.parsed.y).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                },
            },
        },
        layout: {
            padding: { top: 20, right: 10 },
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { maxRotation: 45, autoSkip: true, color: '#64748b', font: { size: 10 } },
                border: { color: '#e2e8f0' },
            },
            y: {
                grid: { color: '#f1f5f9' },
                ticks: {
                    color: '#64748b',
                    font: { size: 10 },
                    callback: (v) => `$${Number(v).toLocaleString()}`,
                },
                border: { color: '#e2e8f0' },
            },
        },
    };

    const handlePrint = async () => {
        if (!reportRef.current) return;

        try {
            const chartRevenueImg = chartRefRevenue.current?.toBase64Image();
            const chartCostImg = chartRefCost.current?.toBase64Image();
            const chartProfitImg = chartRefProfit.current?.toBase64Image();

            const printWindow = window.open('', '', 'width=1200,height=800');
            if (printWindow) {
                printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                        <head>
                            <title>Cumulative Turnover Forecast Report - ${fyLabel}</title>
                            <style>
                                * { margin: 0; padding: 0; box-sizing: border-box; }
                                body { font-family: Arial, sans-serif; padding: 15px; color: #1e293b; font-size: 10px; }
                                h2 { color: #1e293b; margin: 20px 0 10px 0; font-size: 14px; }

                                .summary-grid {
                                    display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px;
                                }
                                .summary-item {
                                    background: #f8fafc; border-left: 3px solid #334155; padding: 10px;
                                }
                                .summary-item label {
                                    font-size: 9px; color: #334155; text-transform: uppercase; font-weight: 600;
                                    letter-spacing: 0.5px; display: block; margin-bottom: 4px;
                                }
                                .summary-item .value { font-size: 16px; font-weight: 700; color: #1e293b; }
                                .summary-item .sub-value { font-size: 9px; color: #64748b; margin-top: 4px; }

                                .data-table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 10px; }
                                .data-table thead { background: #334155; color: white; }
                                .data-table th { padding: 6px 8px; text-align: right; font-weight: 600; border: 1px solid #334155; font-size: 9px; }
                                .data-table th:first-child { text-align: left; }
                                .data-table td { padding: 5px 8px; text-align: right; border: 1px solid #e2e8f0; font-size: 9px; }
                                .data-table td:first-child { text-align: left; }
                                .data-table tbody tr:nth-child(even) { background: #f8fafc; }
                                .data-table tbody tr.actual-row { background: #fef9c3; }
                                .data-table tfoot { background: #334155; color: white; font-weight: 600; }
                                .data-table tfoot td { border-top: 2px solid #334155; }

                                .chart-section { margin-top: 25px; page-break-inside: avoid; }
                                .chart-section img { max-width: 100%; height: auto; border: 1px solid #e2e8f0; border-radius: 4px; }

                                .legend {
                                    background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 4px;
                                    margin-top: 20px; font-size: 9px;
                                }
                                .legend p { margin-bottom: 6px; font-weight: 700; color: #334155; font-size: 10px; }
                                .legend ul { list-style: none; padding-left: 0; }
                                .legend li { margin: 3px 0; display: flex; align-items: center; gap: 6px; color: #475569; }
                                .legend-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0; }

                                /* Repeating header via table thead */
                                .report-table { width: 100%; border-collapse: collapse; }
                                .report-table thead td { padding-bottom: 10px; }
                                .report-table tbody td { padding: 0; }

                                .report-header {
                                    display: flex; align-items: center; justify-content: space-between;
                                    padding-bottom: 10px; border-bottom: 2px solid #334155; margin-bottom: 15px;
                                }

                                @media print {
                                    body { padding: 0; }
                                    .no-print { display: none !important; }
                                    .report-table thead { display: table-header-group; }
                                    .chart-section {
                                        page-break-before: always;
                                        height: 85vh;
                                        display: flex;
                                        flex-direction: column;
                                        justify-content: center;
                                        margin-top: 0;
                                    }
                                    .chart-section h2 { margin-bottom: 10px; }
                                    .chart-section img { height: 80vh; width: 100%; object-fit: contain; }
                                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                                }
                            </style>
                        </head>
                        <body>
                            <table class="report-table">
                            <thead><tr><td>
                                <div class="report-header">
                                    <img src="/logo.png" alt="Company Logo" style="height: 40px;" />
                                    <div style="text-align: center; flex: 1;">
                                        <h1 style="font-size: 22px; color: #1e293b; margin-bottom: 4px; font-weight: 700;">Cumulative Turnover Forecast Report</h1>
                                        <p style="font-size: 11px; color: #64748b;">Financial Year: ${fyLabel}</p>
                                    </div>
                                    <div style="text-align: right;">
                                        <p style="font-size: 9px; color: #94a3b8;">Generated: ${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                        <p style="font-size: 9px; color: #94a3b8;">${data.length} projects (${data.filter((d) => d.type === 'location').length} locations, ${data.filter((d) => d.type === 'forecast_project').length} forecast)</p>
                                    </div>
                                </div>
                            </td></tr></thead>
                            <tbody><tr><td>

                            <div class="summary-grid">
                                <div class="summary-item">
                                    <label>Total Contract Value</label>
                                    <div class="value">${formatCurrency(totals.totalContractValue)}</div>
                                </div>
                                <div class="summary-item">
                                    <label>Total Budget</label>
                                    <div class="value">${formatCurrency(totals.budget)}</div>
                                </div>
                                <div class="summary-item">
                                    <label>Total Projected Profit</label>
                                    <div class="value">${formatCurrency(profitTotal)}</div>
                                </div>
                                <div class="summary-item">
                                    <label>Claimed to Date</label>
                                    <div class="value">${formatCurrency(totals.claimedToDate)}</div>
                                    <div class="sub-value">${formatPercent(totals.claimedToDate, totals.totalContractValue)}% of total</div>
                                </div>
                                <div class="summary-item">
                                    <label>Cost to Date</label>
                                    <div class="value">${formatCurrency(totals.costToDate)}</div>
                                    <div class="sub-value">${formatPercent(totals.costToDate, totals.budget)}% of budget</div>
                                </div>
                                <div class="summary-item">
                                    <label>Profit to Date</label>
                                    <div class="value">${formatCurrency(profitToDate)}</div>
                                    <div class="sub-value">${formatPercent(profitToDate, totals.claimedToDate)}% margin</div>
                                </div>
                                <div class="summary-item">
                                    <label>Contract ${fyLabel}</label>
                                    <div class="value">${formatCurrency(totals.revenueContractFY)}</div>
                                </div>
                                <div class="summary-item">
                                    <label>Cost Contract ${fyLabel}</label>
                                    <div class="value">${formatCurrency(totals.costContractFY)}</div>
                                </div>
                                <div class="summary-item">
                                    <label>Profit Contract ${fyLabel}</label>
                                    <div class="value">${formatCurrency(profitContractFY)}</div>
                                    <div class="sub-value">${marginPercent.toFixed(1)}% margin</div>
                                </div>
                            </div>

                            <h2>Monthly Breakdown</h2>
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Month</th>
                                        <th>Monthly Revenue</th>
                                        <th>Monthly Cost</th>
                                        <th>Monthly Profit</th>
                                        <th>Cumulative Revenue</th>
                                        <th>Cumulative Cost</th>
                                        <th>Cumulative Profit</th>
                                        <th>Revenue %</th>
                                        <th>Cost %</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${monthlyData
                                        .map(
                                            (row) => `
                                        <tr class="${row.isActual ? 'actual-row' : ''}">
                                            <td>${row.monthLabel}</td>
                                            <td>${formatCompactCurrency(row.monthlyRevenue)}</td>
                                            <td>${formatCompactCurrency(row.monthlyCost)}</td>
                                            <td>${formatCompactCurrency(row.monthlyProfit)}</td>
                                            <td>${formatCompactCurrency(row.cumulativeRevenue)}</td>
                                            <td>${formatCompactCurrency(row.cumulativeCost)}</td>
                                            <td>${formatCompactCurrency(row.cumulativeProfit)}</td>
                                            <td>${formatPercent(row.cumulativeRevenue, totals.totalContractValue)}%</td>
                                            <td>${formatPercent(row.cumulativeCost, totals.budget)}%</td>
                                        </tr>
                                    `,
                                        )
                                        .join('')}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td>REMAINING</td>
                                        <td colspan="3"></td>
                                        <td>${formatCompactCurrency(remainingRevenue)}</td>
                                        <td>${formatCompactCurrency(remainingCost)}</td>
                                        <td>${formatCompactCurrency(remainingProfit)}</td>
                                        <td colspan="2"></td>
                                    </tr>
                                </tfoot>
                            </table>

                            ${chartRevenueImg ? `<div class="chart-section"><h2>Revenue Progression</h2><img src="${chartRevenueImg}" alt="Revenue Chart" /></div>` : ''}
                            ${chartCostImg ? `<div class="chart-section"><h2>Cost Progression</h2><img src="${chartCostImg}" alt="Cost Chart" /></div>` : ''}
                            ${chartProfitImg ? `<div class="chart-section"><h2>Profit Progression</h2><img src="${chartProfitImg}" alt="Profit Chart" /></div>` : ''}
                            </td></tr></tbody></table>
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
            <DialogContent className="max-h-[95vh] max-w-[95vw] min-w-full overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle>Cumulative Turnover Forecast Report</DialogTitle>
                        <Button onClick={handlePrint} variant="default" size="sm">
                            <Printer className="mr-2 h-4 w-4" />
                            Print Report
                        </Button>
                    </div>
                </DialogHeader>

                <div ref={reportRef} className="space-y-6">
                    {/* Header - matches print report layout */}
                    <div className="flex items-center justify-between border-b-2 border-slate-700 pb-3">
                        <img src="/logo.png" alt="Company Logo" className="h-10" />
                        <div className="flex-1 text-center">
                            <h1 className="text-2xl font-bold text-slate-800">Cumulative Turnover Forecast Report</h1>
                            <p className="text-[11px] text-slate-500">Financial Year: {fyLabel}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] text-slate-400">
                                Generated: {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                            <p className="text-[9px] text-slate-400">
                                {data.length} projects ({data.filter((d) => d.type === 'location').length} locations,{' '}
                                {data.filter((d) => d.type === 'forecast_project').length} forecast)
                            </p>
                        </div>
                    </div>

                    {/* Summary - slate stat cards matching print report */}
                    <div className="grid grid-cols-3 gap-2.5">
                        <div className="border-l-[3px] border-l-slate-700 bg-slate-50 p-2.5">
                            <div className="mb-1 text-[9px] font-semibold uppercase text-slate-700">Total Contract Value</div>
                            <div className="text-base font-bold text-slate-800">{formatCurrency(totals.totalContractValue)}</div>
                        </div>
                        <div className="border-l-[3px] border-l-slate-700 bg-slate-50 p-2.5">
                            <div className="mb-1 text-[9px] font-semibold uppercase text-slate-700">Total Budget</div>
                            <div className="text-base font-bold text-slate-800">{formatCurrency(totals.budget)}</div>
                        </div>
                        <div className="border-l-[3px] border-l-slate-700 bg-slate-50 p-2.5">
                            <div className="mb-1 text-[9px] font-semibold uppercase text-slate-700">Total Projected Profit</div>
                            <div className="text-base font-bold text-slate-800">{formatCurrency(profitTotal)}</div>
                        </div>

                        <div className="border-l-[3px] border-l-slate-700 bg-slate-50 p-2.5">
                            <div className="mb-1 text-[9px] font-semibold uppercase text-slate-700">Claimed to Date</div>
                            <div className="text-base font-bold text-slate-800">{formatCurrency(totals.claimedToDate)}</div>
                            <div className="mt-1 text-[9px] text-slate-500">
                                {formatPercent(totals.claimedToDate, totals.totalContractValue)}% of total
                            </div>
                        </div>
                        <div className="border-l-[3px] border-l-slate-700 bg-slate-50 p-2.5">
                            <div className="mb-1 text-[9px] font-semibold uppercase text-slate-700">Cost to Date</div>
                            <div className="text-base font-bold text-slate-800">{formatCurrency(totals.costToDate)}</div>
                            <div className="mt-1 text-[9px] text-slate-500">
                                {formatPercent(totals.costToDate, totals.budget)}% of budget
                            </div>
                        </div>
                        <div className="border-l-[3px] border-l-slate-700 bg-slate-50 p-2.5">
                            <div className="mb-1 text-[9px] font-semibold uppercase text-slate-700">Profit to Date</div>
                            <div className="text-base font-bold text-slate-800">{formatCurrency(profitToDate)}</div>
                            <div className="mt-1 text-[9px] text-slate-500">
                                {formatPercent(profitToDate, totals.claimedToDate)}% margin
                            </div>
                        </div>

                        <div className="border-l-[3px] border-l-slate-700 bg-slate-50 p-2.5">
                            <div className="mb-1 text-[9px] font-semibold uppercase text-slate-700">Contract {fyLabel}</div>
                            <div className="text-base font-bold text-slate-800">{formatCurrency(totals.revenueContractFY)}</div>
                        </div>
                        <div className="border-l-[3px] border-l-slate-700 bg-slate-50 p-2.5">
                            <div className="mb-1 text-[9px] font-semibold uppercase text-slate-700">Cost Contract {fyLabel}</div>
                            <div className="text-base font-bold text-slate-800">{formatCurrency(totals.costContractFY)}</div>
                        </div>
                        <div className="border-l-[3px] border-l-slate-700 bg-slate-50 p-2.5">
                            <div className="mb-1 text-[9px] font-semibold uppercase text-slate-700">Profit Contract {fyLabel}</div>
                            <div className="text-base font-bold text-slate-800">{formatCurrency(profitContractFY)}</div>
                            <div className="mt-1 text-[9px] text-slate-500">{marginPercent.toFixed(1)}% margin</div>
                        </div>
                    </div>

                    {/* Monthly Breakdown Table - slate header matching print report */}
                    <div>
                        <div className="border border-slate-700 bg-slate-700 px-3 py-2 text-white">
                            <h3 className="text-[11px] font-semibold">Monthly Breakdown</h3>
                        </div>
                        <div className="overflow-x-auto border border-t-0 border-slate-200">
                            <table className="w-full border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-700">
                                        <th className="border border-slate-700 px-2 py-1.5 text-left text-[9px] font-semibold text-white">Month</th>
                                        <th className="border border-slate-700 px-2 py-1.5 text-right text-[9px] font-semibold text-white">Monthly Revenue</th>
                                        <th className="border border-slate-700 px-2 py-1.5 text-right text-[9px] font-semibold text-white">Monthly Cost</th>
                                        <th className="border border-slate-700 px-2 py-1.5 text-right text-[9px] font-semibold text-white">Monthly Profit</th>
                                        <th className="border border-slate-700 px-2 py-1.5 text-right text-[9px] font-semibold text-white">Cumulative Revenue</th>
                                        <th className="border border-slate-700 px-2 py-1.5 text-right text-[9px] font-semibold text-white">Cumulative Cost</th>
                                        <th className="border border-slate-700 px-2 py-1.5 text-right text-[9px] font-semibold text-white">Cumulative Profit</th>
                                        <th className="border border-slate-700 px-2 py-1.5 text-right text-[9px] font-semibold text-white">Revenue %</th>
                                        <th className="border border-slate-700 px-2 py-1.5 text-right text-[9px] font-semibold text-white">Cost %</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {monthlyData.map((row, idx) => (
                                        <tr key={row.month} className={row.isActual ? 'bg-yellow-50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                            <td className="border border-slate-200 px-2 py-1.5 text-[9px] font-medium text-slate-700">{row.monthLabel}</td>
                                            <td className="border border-slate-200 px-2 py-1.5 text-right text-[9px]">{formatCompactCurrency(row.monthlyRevenue)}</td>
                                            <td className="border border-slate-200 px-2 py-1.5 text-right text-[9px]">{formatCompactCurrency(row.monthlyCost)}</td>
                                            <td className={`border border-slate-200 px-2 py-1.5 text-right text-[9px] font-semibold ${row.monthlyProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                                {formatCompactCurrency(row.monthlyProfit)}
                                            </td>
                                            <td className="border border-slate-200 px-2 py-1.5 text-right text-[9px]">{formatCompactCurrency(row.cumulativeRevenue)}</td>
                                            <td className="border border-slate-200 px-2 py-1.5 text-right text-[9px]">{formatCompactCurrency(row.cumulativeCost)}</td>
                                            <td className={`border border-slate-200 px-2 py-1.5 text-right text-[9px] font-semibold ${row.cumulativeProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                                {formatCompactCurrency(row.cumulativeProfit)}
                                            </td>
                                            <td className="border border-slate-200 px-2 py-1.5 text-right text-[9px] text-slate-500">
                                                {formatPercent(row.cumulativeRevenue, totals.totalContractValue)}%
                                            </td>
                                            <td className="border border-slate-200 px-2 py-1.5 text-right text-[9px] text-slate-500">
                                                {formatPercent(row.cumulativeCost, totals.budget)}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-700 font-semibold text-white">
                                        <td className="border border-slate-200 px-2 py-1.5 text-[9px]">REMAINING</td>
                                        <td className="border border-slate-200 px-2 py-1.5" colSpan={3}></td>
                                        <td className="border border-slate-200 px-2 py-1.5 text-right text-[9px]">{formatCompactCurrency(remainingRevenue)}</td>
                                        <td className="border border-slate-200 px-2 py-1.5 text-right text-[9px]">{formatCompactCurrency(remainingCost)}</td>
                                        <td className="border border-slate-200 px-2 py-1.5 text-right text-[9px]">{formatCompactCurrency(remainingProfit)}</td>
                                        <td className="border border-slate-200 px-2 py-1.5" colSpan={2}></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Charts - with slate section headers */}
                    <div>
                        <div className="border border-slate-700 bg-slate-700 px-3 py-2 text-white">
                            <h3 className="text-[11px] font-semibold">Revenue Progression</h3>
                        </div>
                        <div className="h-[70vh] border border-t-0 border-slate-200 bg-white p-4">
                            <Line ref={chartRefRevenue} data={chartDataRevenue} options={chartOptions} />
                        </div>
                    </div>

                    <div>
                        <div className="border border-slate-700 bg-slate-700 px-3 py-2 text-white">
                            <h3 className="text-[11px] font-semibold">Cost Progression</h3>
                        </div>
                        <div className="h-[70vh] border border-t-0 border-slate-200 bg-white p-4">
                            <Line ref={chartRefCost} data={chartDataCost} options={chartOptions} />
                        </div>
                    </div>

                    <div>
                        <div className="border border-slate-700 bg-slate-700 px-3 py-2 text-white">
                            <h3 className="text-[11px] font-semibold">Profit Progression</h3>
                        </div>
                        <div className="h-[70vh] border border-t-0 border-slate-200 bg-white p-4">
                            <Line ref={chartRefProfit} data={chartDataProfit} options={chartOptions} />
                        </div>
                    </div>


                    {/* Footer */}
                    <div className="border-t border-slate-200 pt-2.5 text-center">
                        <p className="text-[8px] text-slate-500">This report was generated from the Turnover Forecast system. Data reflects the current state at time of generation.</p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
