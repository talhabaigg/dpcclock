/**
 * Revenue Report Dialog - Generates a professional revenue report with charts and detailed table
 */

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { ChartOptions } from 'chart.js';
import { useRef } from 'react';
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
    displayMonths: string[];
    forecastMonths: string[];
}

export function RevenueReportDialog({
    open,
    onOpenChange,
    jobName,
    jobNumber,
    accrualData,
    totalCostBudget,
    totalRevenueBudget,
    displayMonths,
    forecastMonths,
}: RevenueReportDialogProps) {
    const reportRef = useRef<HTMLDivElement>(null);
    const chartRefDollar = useRef<any>(null);
    const chartRefPercent = useRef<any>(null);

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

            // Track colors
            const costIsActual = point.costActual !== null;
            const revenueIsActual = point.revenueActual !== null;
            acc.pointColors.cost.push(costIsActual ? '#d1c700' : '#60A5FA');
            acc.pointColors.revenue.push(revenueIsActual ? '#d1c700' : '#10B981');
            acc.pointColors.margin.push(costIsActual && revenueIsActual ? '#d1c700' : '#A855F7');

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

    // Chart data for dollar view
    const chartDataDollar = {
        labels: cumulativeData.labels,
        datasets: [
            {
                label: 'Revenue',
                data: cumulativeData.revenueValues,
                borderColor: '#10B981',
                backgroundColor: '#10B981',
                borderWidth: 2.5,
                tension: 0.25,
                pointRadius: 3,
                pointBackgroundColor: cumulativeData.pointColors.revenue,
                pointBorderColor: cumulativeData.pointColors.revenue,
                segment: {
                    borderDash: (ctx: any) => {
                        const point = accrualData[ctx.p1DataIndex];
                        return point && point.revenueActual === null ? [4, 4] : [];
                    },
                },
            },
            {
                label: 'Cost',
                data: cumulativeData.costValues,
                borderColor: '#60A5FA',
                backgroundColor: '#60A5FA',
                borderWidth: 2.5,
                tension: 0.25,
                pointRadius: 3,
                pointBackgroundColor: cumulativeData.pointColors.cost,
                pointBorderColor: cumulativeData.pointColors.cost,
                segment: {
                    borderDash: (ctx: any) => {
                        const point = accrualData[ctx.p1DataIndex];
                        return point && point.costActual === null ? [4, 4] : [];
                    },
                },
            },
            {
                label: 'Margin',
                data: cumulativeData.marginValues,
                borderColor: '#A855F7',
                backgroundColor: '#A855F7',
                borderWidth: 2.5,
                tension: 0.25,
                pointRadius: 3,
                pointBackgroundColor: cumulativeData.pointColors.margin,
                pointBorderColor: cumulativeData.pointColors.margin,
                segment: {
                    borderDash: (ctx: any) => {
                        const point = accrualData[ctx.p1DataIndex];
                        const costIsActual = point && point.costActual !== null;
                        const revenueIsActual = point && point.revenueActual !== null;
                        return costIsActual && revenueIsActual ? [] : [4, 4];
                    },
                },
            },
        ],
    };

    // Chart data for percentage view
    const chartDataPercent = {
        labels: cumulativeData.labels,
        datasets: [
            {
                label: 'Revenue %',
                data: cumulativeData.revenueValues.map((v) => (totalRevenueBudget > 0 ? (v / totalRevenueBudget) * 100 : 0)),
                borderColor: '#10B981',
                backgroundColor: '#10B981',
                borderWidth: 2.5,
                tension: 0.25,
                pointRadius: 3,
                pointBackgroundColor: cumulativeData.pointColors.revenue,
                pointBorderColor: cumulativeData.pointColors.revenue,
            },
            {
                label: 'Cost %',
                data: cumulativeData.costValues.map((v) => (totalCostBudget > 0 ? (v / totalCostBudget) * 100 : 0)),
                borderColor: '#60A5FA',
                backgroundColor: '#60A5FA',
                borderWidth: 2.5,
                tension: 0.25,
                pointRadius: 3,
                pointBackgroundColor: cumulativeData.pointColors.cost,
                pointBorderColor: cumulativeData.pointColors.cost,
            },
            {
                label: 'Margin %',
                data: cumulativeData.marginValues.map((v) => (totalRevenueBudget > 0 ? (v / totalRevenueBudget) * 100 : 0)),
                borderColor: '#A855F7',
                backgroundColor: '#A855F7',
                borderWidth: 2.5,
                tension: 0.25,
                pointRadius: 3,
                pointBackgroundColor: cumulativeData.pointColors.margin,
                pointBorderColor: cumulativeData.pointColors.margin,
            },
        ],
    };

    const chartOptionsDollar: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
            legend: { display: true, position: 'top' },
            tooltip: {
                callbacks: {
                    label: (ctx) => `${ctx.dataset.label}: $${Number(ctx.parsed.y).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                },
            },
        },
        scales: {
            x: { grid: { display: false }, ticks: { maxRotation: 45, autoSkip: true } },
            y: {
                grid: {},
                ticks: {
                    callback: (v) => `$${Number(v).toLocaleString()}`,
                },
            },
        },
    };

    const chartOptionsPercent: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
            legend: { display: true, position: 'top' },
            tooltip: {
                callbacks: {
                    label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.y).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`,
                },
            },
        },
        scales: {
            x: { grid: { display: false }, ticks: { maxRotation: 45, autoSkip: true } },
            y: {
                grid: {},
                ticks: {
                    callback: (v) => `${Number(v).toLocaleString()}%`,
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
                                    font-family: Arial, sans-serif;
                                    padding: 20px;
                                    color: #333;
                                }
                                .report-header {
                                    text-align: center;
                                    margin-bottom: 30px;
                                    padding-bottom: 20px;
                                    border-bottom: 2px solid #ddd;
                                }
                                .logo {
                                    max-width: 200px;
                                    margin-bottom: 10px;
                                }
                                h1 {
                                    color: #1a1a1a;
                                    margin: 10px 0;
                                    font-size: 28px;
                                }
                                h2 {
                                    color: #1a1a1a;
                                    margin: 20px 0 10px 0;
                                    font-size: 18px;
                                }
                                .meta {
                                    color: #666;
                                    font-size: 14px;
                                    margin: 5px 0;
                                }
                                .summary-box {
                                    background: #f5f5f5;
                                    padding: 20px;
                                    border-radius: 8px;
                                    margin-bottom: 30px;
                                }
                                .summary-grid {
                                    display: grid;
                                    grid-template-columns: repeat(2, 1fr);
                                    gap: 15px;
                                }
                                .summary-item {
                                    background: white;
                                    padding: 15px;
                                    border-radius: 4px;
                                    border-left: 4px solid #60A5FA;
                                }
                                .summary-item.revenue {
                                    border-left-color: #10B981;
                                }
                                .summary-item.margin {
                                    border-left-color: #A855F7;
                                }
                                .summary-item label {
                                    font-size: 11px;
                                    color: #666;
                                    text-transform: uppercase;
                                    letter-spacing: 0.5px;
                                    display: block;
                                    margin-bottom: 5px;
                                }
                                .summary-item .value {
                                    font-size: 24px;
                                    font-weight: bold;
                                    color: #1a1a1a;
                                }
                                .summary-item .sub-value {
                                    font-size: 11px;
                                    color: #666;
                                    margin-top: 5px;
                                }

                                /* Table Styles */
                                .data-table {
                                    width: 100%;
                                    border-collapse: collapse;
                                    margin: 20px 0;
                                    font-size: 12px;
                                }
                                .data-table thead {
                                    background: #0891b2;
                                    color: white;
                                }
                                .data-table th {
                                    padding: 10px 8px;
                                    text-align: right;
                                    font-weight: 600;
                                    border: 1px solid #0e7490;
                                }
                                .data-table th:first-child {
                                    text-align: left;
                                }
                                .data-table td {
                                    padding: 8px;
                                    text-align: right;
                                    border: 1px solid #ddd;
                                }
                                .data-table td:first-child {
                                    text-align: left;
                                }
                                .data-table tbody tr:nth-child(even) {
                                    background: #f9f9f9;
                                }
                                .data-table tbody tr.actual-row {
                                    background: #fefce8;
                                }
                                .data-table tfoot {
                                    background: #f1f5f9;
                                    font-weight: bold;
                                }
                                .data-table tfoot td {
                                    border-top: 2px solid #0891b2;
                                }

                                .chart-section {
                                    margin-top: 30px;
                                    page-break-inside: avoid;
                                }
                                .chart-section img {
                                    max-width: 100%;
                                    height: auto;
                                    border: 1px solid #ddd;
                                    border-radius: 4px;
                                }
                                .legend {
                                    background: #f9f9f9;
                                    padding: 15px;
                                    border-radius: 4px;
                                    margin-top: 20px;
                                    font-size: 11px;
                                }
                                .legend p {
                                    margin-bottom: 8px;
                                    font-weight: bold;
                                }
                                .legend ul {
                                    list-style: none;
                                    padding-left: 0;
                                }
                                .legend li {
                                    margin: 5px 0;
                                    display: flex;
                                    align-items: center;
                                    gap: 8px;
                                }
                                .legend-dot {
                                    width: 12px;
                                    height: 12px;
                                    border-radius: 50%;
                                    display: inline-block;
                                }
                                @media print {
                                    body {
                                        padding: 10px;
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

                                    <div class="summary-item revenue">
                                        <label>Actuals to Date</label>
                                        <div class="value">$${actualsToDate.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                        <div class="sub-value">${actualsPercent.toFixed(1)}% Complete</div>
                                    </div>

                                    <div class="summary-item">
                                        <label>Remaining</label>
                                        <div class="value">$${(totalRevenueBudget - finalRevenue).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                    </div>

                                    <div class="summary-item margin">
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
                                        <th>Monthly</th>
                                        <th>Actuals to Date</th>
                                        <th>Actuals %</th>
                                        <th>Remaining ($)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableData
                                        .map(
                                            (row) => `
                                        <tr class="${row.isActual ? 'actual-row' : ''}">
                                            <td>${row.month}</td>
                                            <td>${row.monthlyRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                            <td>${row.cumulativeRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
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
                                        <td>${totalRevenueBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                        <td>${finalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
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
                                <p>Chart Legend:</p>
                                <ul>
                                    <li>
                                        <span class="legend-dot" style="background: #d1c700;"></span>
                                        Yellow points indicate actual values
                                    </li>
                                    <li>
                                        <span class="legend-dot" style="background: #10B981;"></span>
                                        <span class="legend-dot" style="background: #60A5FA;"></span>
                                        <span class="legend-dot" style="background: #A855F7;"></span>
                                        Colored points indicate forecasted values
                                    </li>
                                    <li>Dashed lines represent forecast periods. Highlighted rows indicate actuals.</li>
                                </ul>
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
        } catch (error) {
            console.error('Error generating print view:', error);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] w-full max-w-6xl min-w-5xl overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle>Revenue Report</DialogTitle>
                        <Button onClick={handlePrint} variant="outline" size="sm">
                            Print Report
                        </Button>
                    </div>
                </DialogHeader>

                <div ref={reportRef} className="space-y-6">
                    {/* Report Header */}
                    <div className="report-header border-b pb-6 text-center">
                        <img src="/logo.png" alt="Company Logo" className="mx-auto mb-4 h-16" />
                        <h1 className="text-2xl font-bold text-gray-900">{jobName}</h1>
                        <p className="text-muted-foreground text-sm">Job Number: {jobNumber}</p>
                        <p className="text-muted-foreground text-sm">Report Generated: {new Date().toLocaleDateString()}</p>
                    </div>

                    {/* Summary Boxes */}
                    <div className="rounded-lg bg-gray-50 p-6">
                        <h2 className="mb-4 text-lg font-semibold">Project Summary</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="rounded border-l-4 border-blue-400 bg-white p-4">
                                <label className="text-muted-foreground block text-xs font-medium uppercase">Contract Value</label>
                                <div className="text-2xl font-bold">
                                    ${totalRevenueBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </div>
                            </div>

                            <div className="rounded border-l-4 border-green-500 bg-white p-4">
                                <label className="text-muted-foreground block text-xs font-medium uppercase">Actuals to Date</label>
                                <div className="text-2xl font-bold">${actualsToDate.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                <div className="text-muted-foreground mt-1 text-xs">{actualsPercent.toFixed(1)}% Complete</div>
                            </div>

                            <div className="rounded border-l-4 border-gray-400 bg-white p-4">
                                <label className="text-muted-foreground block text-xs font-medium uppercase">Remaining</label>
                                <div className="text-2xl font-bold">
                                    ${(totalRevenueBudget - finalRevenue).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </div>
                            </div>

                            <div className="rounded border-l-4 border-purple-500 bg-white p-4">
                                <label className="text-muted-foreground block text-xs font-medium uppercase">Projected Margin</label>
                                <div className="text-2xl font-bold">${finalMargin.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                <div className="text-muted-foreground mt-1 text-xs">{marginPercent.toFixed(1)}% of Revenue</div>
                            </div>
                        </div>
                    </div>

                    {/* Revenue Forecast Table */}
                    <div>
                        <h2 className="mb-3 text-lg font-semibold">Revenue Forecast</h2>
                        <div className="overflow-x-auto rounded-lg border">
                            <table className="w-full text-sm">
                                <thead className="bg-cyan-600 text-white">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold">Month</th>
                                        <th className="px-4 py-3 text-right font-semibold">Monthly Claim</th>
                                        <th className="px-4 py-3 text-right font-semibold">Monthly Cost</th>
                                        <th className="px-4 py-3 text-right font-semibold">Monthly Profit</th>
                                        <th className="px-4 py-3 text-right font-semibold">Claimed to Date</th>
                                        <th className="px-4 py-3 text-right font-semibold">Cost to Date</th>
                                        <th className="px-4 py-3 text-right font-semibold">Profit to Date</th>
                                        <th className="px-4 py-3 text-right font-semibold">Claimed %</th>
                                        <th className="px-4 py-3 text-right font-semibold">Remaining ($)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tableData.map((row, idx) => (
                                        <tr key={row.monthKey} className={row.isActual ? 'bg-yellow-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                            <td className="border-t px-4 py-2">{row.month}</td>
                                            <td className="border-t px-4 py-2 text-right">
                                                {row.monthlyRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </td>
                                            <td className="border-t px-4 py-2 text-right">
                                                {row.monthlyCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </td>
                                            <td className="border-t px-4 py-2 text-right">
                                                {(row.monthlyRevenue - row.monthlyCost).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </td>
                                            <td className="border-t px-4 py-2 text-right">
                                                {row.cumulativeRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </td>
                                            <td className="border-t px-4 py-2 text-right">
                                                {row.cumulativeCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </td>
                                            <td className="border-t px-4 py-2 text-right">
                                                {(row.cumulativeRevenue - row.cumulativeCost).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </td>
                                            <td className="border-t px-4 py-2 text-right">{row.percentComplete.toFixed(1)}%</td>
                                            <td className="border-t px-4 py-2 text-right">
                                                {row.remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </td>
                                            <td></td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-100 font-bold">
                                    <tr>
                                        <td className="border-t-2 border-cyan-600 px-4 py-3">TOTAL</td>
                                        <td className="border-t-2 border-cyan-600 px-4 py-3 text-right">Total to Claim:</td>
                                        <td className="border-t-2 border-cyan-600 px-4 py-3 text-right">
                                            {totalRevenueBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </td>
                                        <td className="border-t-2 border-cyan-600 px-4 py-3 text-right">Total Claimed:</td>
                                        <td className="border-t-2 border-cyan-600 px-4 py-3 text-right">
                                            {finalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} (
                                            {((finalRevenue / totalRevenueBudget) * 100).toFixed(1)}%)
                                        </td>
                                        <td className="border-t-2 border-cyan-600 px-4 py-3 text-right"></td>
                                        <td className="border-t-2 border-cyan-600 px-4 py-3 text-right"></td>
                                        <td className="border-t-2 border-cyan-600 px-4 py-3 text-right">Remaining to Claim:</td>
                                        <td className="border-t-2 border-cyan-600 px-4 py-3 text-right">
                                            {(totalRevenueBudget - finalRevenue).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Chart Section - Accrual $ */}
                    <div className="chart-section">
                        <h2 className="mb-3 text-lg font-semibold">Accrual Progression ($)</h2>
                        <div className="h-80 rounded border bg-white p-4">
                            <Line ref={chartRefDollar} data={chartDataDollar} options={chartOptionsDollar} />
                        </div>
                    </div>

                    {/* Chart Section - Accrual % */}
                    <div className="chart-section">
                        <h2 className="mb-3 text-lg font-semibold">Accrual Progression (%)</h2>
                        <div className="h-80 rounded border bg-white p-4">
                            <Line ref={chartRefPercent} data={chartDataPercent} options={chartOptionsPercent} />
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="text-muted-foreground rounded border bg-gray-50 p-4 text-sm">
                        <p className="mb-2 font-semibold">Legend:</p>
                        <ul className="space-y-1 text-xs">
                            <li className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full bg-[#d1c700]"></span>
                                Yellow points/rows indicate actual values
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full bg-[#60A5FA]"></span>
                                <span className="h-3 w-3 rounded-full bg-[#10B981]"></span>
                                <span className="h-3 w-3 rounded-full bg-[#A855F7]"></span>
                                Colored points indicate forecasted values
                            </li>
                            <li>Dashed lines represent forecast periods</li>
                        </ul>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
