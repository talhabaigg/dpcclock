/**
 * Turnover Report Dialog - Generates a professional turnover report with summarized data
 * for all filtered jobs including monthly, month-to-date cumulative, and remaining figures
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
import { useRef } from 'react';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTooltip, Filler, Legend);

type MonthlyData = {
    [month: string]: number;
};

type TurnoverRow = {
    id: number;
    type: 'location' | 'forecast_project';
    job_name: string;
    job_number: string;
    claimed_to_date: number;
    revenue_contract_fy: number;
    total_contract_value: number;
    remaining_revenue_value_fy: number;
    remaining_order_book: number;
    cost_to_date: number;
    cost_contract_fy: number;
    budget: number;
    remaining_cost_value_fy: number;
    remaining_budget: number;
    revenue_actuals: MonthlyData;
    revenue_forecast: MonthlyData;
    cost_actuals: MonthlyData;
    cost_forecast: MonthlyData;
};

interface TurnoverReportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    data: TurnoverRow[];
    months: string[];
    lastActualMonth: string | null;
    fyLabel: string;
    allMonths: string[]; // All available months (not filtered)
}

const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
        return '$0';
    }
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

const formatMonthHeader = (month: string): string => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
    return date.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' });
};

export function TurnoverReportDialog({ open, onOpenChange, data, months, lastActualMonth, fyLabel, allMonths }: TurnoverReportDialogProps) {
    const reportRef = useRef<HTMLDivElement>(null);
    const chartRefRevenue = useRef<any>(null);
    const chartRefCost = useRef<any>(null);
    const chartRefProfit = useRef<any>(null);

    // Calculate monthly totals and cumulative values
    const monthlyData = months.map((month, index) => {
        // Calculate monthly totals
        let monthlyRevenue = 0;
        let monthlyCost = 0;

        data.forEach((row) => {
            const actualRevenue = Number(row.revenue_actuals?.[month]) || 0;
            const forecastRevenue = Number(row.revenue_forecast?.[month]) || 0;
            const revenue = actualRevenue || forecastRevenue;

            const actualCost = Number(row.cost_actuals?.[month]) || 0;
            const forecastCost = Number(row.cost_forecast?.[month]) || 0;
            const cost = actualCost || forecastCost;

            monthlyRevenue += revenue;
            monthlyCost += cost;
        });

        const monthlyProfit = monthlyRevenue - monthlyCost;

        // Calculate cumulative up to this point
        const cumulativeRevenue = months.slice(0, index + 1).reduce((sum, m) => {
            let monthTotal = 0;
            data.forEach((row) => {
                const actualRevenue = Number(row.revenue_actuals?.[m]) || 0;
                const forecastRevenue = Number(row.revenue_forecast?.[m]) || 0;
                monthTotal += actualRevenue || forecastRevenue;
            });
            return sum + monthTotal;
        }, 0);

        const cumulativeCost = months.slice(0, index + 1).reduce((sum, m) => {
            let monthTotal = 0;
            data.forEach((row) => {
                const actualCost = Number(row.cost_actuals?.[m]) || 0;
                const forecastCost = Number(row.cost_forecast?.[m]) || 0;
                monthTotal += actualCost || forecastCost;
            });
            return sum + monthTotal;
        }, 0);

        const cumulativeProfit = cumulativeRevenue - cumulativeCost;

        const isActualMonth = lastActualMonth && month <= lastActualMonth;

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
            acc.claimedToDate += row.claimed_to_date || 0;
            acc.costToDate += row.cost_to_date || 0;
            acc.revenueContractFY += row.revenue_contract_fy || 0;
            acc.costContractFY += row.cost_contract_fy || 0;
            acc.totalContractValue += row.total_contract_value || 0;
            acc.budget += row.budget || 0;
            acc.remainingRevenueFY += row.remaining_revenue_value_fy || 0;
            acc.remainingCostFY += row.remaining_cost_value_fy || 0;
            acc.remainingOrderBook += row.remaining_order_book || 0;
            acc.remainingBudget += row.remaining_budget || 0;
            return acc;
        },
        {
            claimedToDate: 0,
            costToDate: 0,
            revenueContractFY: 0,
            costContractFY: 0,
            totalContractValue: 0,
            budget: 0,
            remainingRevenueFY: 0,
            remainingCostFY: 0,
            remainingOrderBook: 0,
            remainingBudget: 0,
        },
    );

    const profitToDate = totals.claimedToDate - totals.costToDate;
    const profitContractFY = totals.revenueContractFY - totals.costContractFY;
    const profitTotal = totals.totalContractValue - totals.budget;
    const marginPercent = totals.revenueContractFY > 0 ? (profitContractFY / totals.revenueContractFY) * 100 : 0;

    // Calculate remaining based on cumulative up to last actual month (not filtered months)
    // Use all months up to the last actual month to calculate what's actually been completed
    const monthsUpToLastActual = lastActualMonth ? allMonths.filter((m) => m <= lastActualMonth) : [];

    const cumulativeRevenueToDate = monthsUpToLastActual.reduce((sum, m) => {
        let monthTotal = 0;
        data.forEach((row) => {
            const actualRevenue = Number(row.revenue_actuals?.[m]) || 0;
            const forecastRevenue = Number(row.revenue_forecast?.[m]) || 0;
            monthTotal += actualRevenue || forecastRevenue;
        });
        return sum + monthTotal;
    }, 0);

    const cumulativeCostToDate = monthsUpToLastActual.reduce((sum, m) => {
        let monthTotal = 0;
        data.forEach((row) => {
            const actualCost = Number(row.cost_actuals?.[m]) || 0;
            const forecastCost = Number(row.cost_forecast?.[m]) || 0;
            monthTotal += actualCost || forecastCost;
        });
        return sum + monthTotal;
    }, 0);

    const remainingRevenue = totals.totalContractValue - cumulativeRevenueToDate;
    const remainingCost = totals.budget - cumulativeCostToDate;
    const remainingProfit = remainingRevenue - remainingCost;

    // Chart data for Revenue
    const chartDataRevenue = {
        labels: monthlyData.map((d) => d.monthLabel),
        datasets: [
            {
                label: 'Monthly Revenue',
                data: monthlyData.map((d) => d.monthlyRevenue),
                borderColor: '#10B981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 2.5,
                tension: 0.25,
                pointRadius: 4,
                pointBackgroundColor: monthlyData.map((d) => (d.isActual ? '#d1c700' : '#10B981')),
                segment: {
                    borderDash: (ctx: any) => {
                        const point = monthlyData[ctx.p1DataIndex];
                        return point && !point.isActual ? [4, 4] : [];
                    },
                },
            },
            {
                label: 'Cumulative Revenue',
                data: monthlyData.map((d) => d.cumulativeRevenue),
                borderColor: '#059669',
                backgroundColor: 'rgba(5, 150, 105, 0.1)',
                borderWidth: 2,
                tension: 0.25,
                pointRadius: 3,
                borderDash: [2, 2],
            },
        ],
    };

    // Chart data for Cost
    const chartDataCost = {
        labels: monthlyData.map((d) => d.monthLabel),
        datasets: [
            {
                label: 'Monthly Cost',
                data: monthlyData.map((d) => d.monthlyCost),
                borderColor: '#EF4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderWidth: 2.5,
                tension: 0.25,
                pointRadius: 4,
                pointBackgroundColor: monthlyData.map((d) => (d.isActual ? '#d1c700' : '#EF4444')),
                segment: {
                    borderDash: (ctx: any) => {
                        const point = monthlyData[ctx.p1DataIndex];
                        return point && !point.isActual ? [4, 4] : [];
                    },
                },
            },
            {
                label: 'Cumulative Cost',
                data: monthlyData.map((d) => d.cumulativeCost),
                borderColor: '#DC2626',
                backgroundColor: 'rgba(220, 38, 38, 0.1)',
                borderWidth: 2,
                tension: 0.25,
                pointRadius: 3,
                borderDash: [2, 2],
            },
        ],
    };

    // Chart data for Profit
    const chartDataProfit = {
        labels: monthlyData.map((d) => d.monthLabel),
        datasets: [
            {
                label: 'Monthly Profit',
                data: monthlyData.map((d) => d.monthlyProfit),
                borderColor: '#A855F7',
                backgroundColor: 'rgba(168, 85, 247, 0.1)',
                borderWidth: 2.5,
                tension: 0.25,
                pointRadius: 4,
                pointBackgroundColor: monthlyData.map((d) => (d.isActual ? '#d1c700' : '#A855F7')),
                segment: {
                    borderDash: (ctx: any) => {
                        const point = monthlyData[ctx.p1DataIndex];
                        return point && !point.isActual ? [4, 4] : [];
                    },
                },
            },
            {
                label: 'Cumulative Profit',
                data: monthlyData.map((d) => d.cumulativeProfit),
                borderColor: '#9333EA',
                backgroundColor: 'rgba(147, 51, 234, 0.1)',
                borderWidth: 2,
                tension: 0.25,
                pointRadius: 3,
                borderDash: [2, 2],
            },
        ],
    };

    const chartOptions: ChartOptions<'line'> = {
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

    const handlePrint = async () => {
        if (!reportRef.current) return;

        try {
            // Helper function to format currency for print
            const formatPrintCurrency = (value: number) => {
                if (isNaN(value) || !isFinite(value)) {
                    return '0';
                }
                return new Intl.NumberFormat('en-AU', {
                    style: 'currency',
                    currency: 'AUD',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                })
                    .format(value)
                    .replace('$', '');
            };

            // Helper to safely format percentage
            const formatPercent = (numerator: number, denominator: number) => {
                if (denominator > 0 && isFinite(numerator / denominator)) {
                    return ((numerator / denominator) * 100).toFixed(1);
                }
                return '0.0';
            };

            // Convert charts to images
            const chartRevenueImg = chartRefRevenue.current?.toBase64Image();
            const chartCostImg = chartRefCost.current?.toBase64Image();
            const chartProfitImg = chartRefProfit.current?.toBase64Image();

            const printWindow = window.open('', '', 'width=1200,height=800');
            if (printWindow) {
                printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                        <head>
                            <title>Turnover Forecast Report - ${fyLabel}</title>
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
                                    grid-template-columns: repeat(3, 1fr);
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
                                .summary-item.cost {
                                    border-left-color: #EF4444;
                                }
                                .summary-item.profit {
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
                                    font-size: 20px;
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
                                    font-size: 11px;
                                }
                                .data-table thead {
                                    background: #0891b2;
                                    color: white;
                                }
                                .data-table th {
                                    padding: 8px 6px;
                                    text-align: right;
                                    font-weight: 600;
                                    border: 1px solid #0e7490;
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
                                <h1>Turnover Forecast Report</h1>
                                <p class="meta">Financial Year: ${fyLabel}</p>
                                <p class="meta">Report Generated: ${new Date().toLocaleDateString()}</p>
                                <p class="meta">Projects Included: ${data.length} (${data.filter((d) => d.type === 'location').length} locations, ${data.filter((d) => d.type === 'forecast_project').length} forecast projects)</p>
                            </div>

                            <div class="summary-box">
                                <h2>Summary</h2>
                                <div class="summary-grid">
                                    <div class="summary-item revenue">
                                        <label>Total Contract Value</label>
                                        <div class="value">$${totals.totalContractValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                    </div>
                                    <div class="summary-item cost">
                                        <label>Total Budget</label>
                                        <div class="value">$${totals.budget.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                    </div>
                                    <div class="summary-item profit">
                                        <label>Total Projected Profit</label>
                                        <div class="value">$${profitTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                    </div>

                                    <div class="summary-item revenue">
                                        <label>Claimed to Date</label>
                                        <div class="value">$${totals.claimedToDate.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                        <div class="sub-value">${totals.totalContractValue > 0 ? ((totals.claimedToDate / totals.totalContractValue) * 100).toFixed(1) : '0.0'}% of total</div>
                                    </div>
                                    <div class="summary-item cost">
                                        <label>Cost to Date</label>
                                        <div class="value">$${totals.costToDate.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                        <div class="sub-value">${totals.budget > 0 ? ((totals.costToDate / totals.budget) * 100).toFixed(1) : '0.0'}% of budget</div>
                                    </div>
                                    <div class="summary-item profit">
                                        <label>Profit to Date</label>
                                        <div class="value">$${profitToDate.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                        <div class="sub-value">${totals.claimedToDate > 0 ? ((profitToDate / totals.claimedToDate) * 100).toFixed(1) : '0.0'}% margin</div>
                                    </div>

                                    <div class="summary-item revenue">
                                        <label>Contract ${fyLabel}</label>
                                        <div class="value">$${totals.revenueContractFY.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                    </div>
                                    <div class="summary-item cost">
                                        <label>Cost Contract ${fyLabel}</label>
                                        <div class="value">$${totals.costContractFY.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                    </div>
                                    <div class="summary-item profit">
                                        <label>Profit Contract ${fyLabel}</label>
                                        <div class="value">$${profitContractFY.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                        <div class="sub-value">${marginPercent.toFixed(1)}% margin</div>
                                    </div>
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
                                            <td>${formatPrintCurrency(row.monthlyRevenue)}</td>
                                            <td>${formatPrintCurrency(row.monthlyCost)}</td>
                                            <td>${formatPrintCurrency(row.monthlyProfit)}</td>
                                            <td>${formatPrintCurrency(row.cumulativeRevenue)}</td>
                                            <td>${formatPrintCurrency(row.cumulativeCost)}</td>
                                            <td>${formatPrintCurrency(row.cumulativeProfit)}</td>
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
                                        <td>${formatPrintCurrency(remainingRevenue)}</td>
                                        <td>${formatPrintCurrency(remainingCost)}</td>
                                        <td>${formatPrintCurrency(remainingProfit)}</td>
                                        <td colspan="2"></td>
                                    </tr>
                                </tfoot>
                            </table>

                            ${
                                chartRevenueImg
                                    ? `
                            <div class="chart-section">
                                <h2>Revenue Progression</h2>
                                <img src="${chartRevenueImg}" alt="Revenue Chart" />
                            </div>
                            `
                                    : ''
                            }

                            ${
                                chartCostImg
                                    ? `
                            <div class="chart-section">
                                <h2>Cost Progression</h2>
                                <img src="${chartCostImg}" alt="Cost Chart" />
                            </div>
                            `
                                    : ''
                            }

                            ${
                                chartProfitImg
                                    ? `
                            <div class="chart-section">
                                <h2>Profit Progression</h2>
                                <img src="${chartProfitImg}" alt="Profit Chart" />
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
                                        Colored points indicate forecasted values
                                    </li>
                                    <li>Dashed lines represent forecast periods. Highlighted rows indicate actuals.</li>
                                    <li>Dotted lines show cumulative totals</li>
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
        } catch {
            // Error generating print view
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[95vh] max-w-[95vw] min-w-5xl overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle>Turnover Forecast Report</DialogTitle>
                        <Button onClick={handlePrint} variant="outline" size="sm">
                            Print Report
                        </Button>
                    </div>
                </DialogHeader>

                <div ref={reportRef} className="space-y-6">
                    {/* Report Header */}
                    <div className="report-header border-b pb-6 text-center">
                        <img src="/logo.png" alt="Company Logo" className="mx-auto mb-4 h-16" />
                        <h1 className="text-2xl font-bold text-gray-900">Turnover Forecast Report</h1>
                        <p className="text-muted-foreground text-sm">Financial Year: {fyLabel}</p>
                        <p className="text-muted-foreground text-sm">Report Generated: {new Date().toLocaleDateString()}</p>
                        <p className="text-muted-foreground text-sm">
                            Projects Included: {data.length} ({data.filter((d) => d.type === 'location').length} locations,{' '}
                            {data.filter((d) => d.type === 'forecast_project').length} forecast projects)
                        </p>
                    </div>

                    {/* Summary Boxes */}
                    <div className="rounded-lg bg-gray-50 p-6">
                        <h2 className="mb-4 text-lg font-semibold">Summary</h2>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="rounded border-l-4 border-green-500 bg-white p-4">
                                <label className="text-muted-foreground block text-xs font-medium uppercase">Total Contract Value</label>
                                <div className="text-xl font-bold">{formatCurrency(totals.totalContractValue)}</div>
                            </div>
                            <div className="rounded border-l-4 border-red-500 bg-white p-4">
                                <label className="text-muted-foreground block text-xs font-medium uppercase">Total Budget</label>
                                <div className="text-xl font-bold">{formatCurrency(totals.budget)}</div>
                            </div>
                            <div className="rounded border-l-4 border-purple-500 bg-white p-4">
                                <label className="text-muted-foreground block text-xs font-medium uppercase">Total Projected Profit</label>
                                <div className="text-xl font-bold">{formatCurrency(profitTotal)}</div>
                            </div>

                            <div className="rounded border-l-4 border-green-500 bg-white p-4">
                                <label className="text-muted-foreground block text-xs font-medium uppercase">Claimed to Date</label>
                                <div className="text-xl font-bold">{formatCurrency(totals.claimedToDate)}</div>
                                <div className="text-muted-foreground mt-1 text-xs">
                                    {totals.totalContractValue > 0 ? ((totals.claimedToDate / totals.totalContractValue) * 100).toFixed(1) : '0.0'}%
                                    of total
                                </div>
                            </div>
                            <div className="rounded border-l-4 border-red-500 bg-white p-4">
                                <label className="text-muted-foreground block text-xs font-medium uppercase">Cost to Date</label>
                                <div className="text-xl font-bold">{formatCurrency(totals.costToDate)}</div>
                                <div className="text-muted-foreground mt-1 text-xs">
                                    {totals.budget > 0 ? ((totals.costToDate / totals.budget) * 100).toFixed(1) : '0.0'}% of budget
                                </div>
                            </div>
                            <div className="rounded border-l-4 border-purple-500 bg-white p-4">
                                <label className="text-muted-foreground block text-xs font-medium uppercase">Profit to Date</label>
                                <div className="text-xl font-bold">{formatCurrency(profitToDate)}</div>
                                <div className="text-muted-foreground mt-1 text-xs">
                                    {totals.claimedToDate > 0 ? ((profitToDate / totals.claimedToDate) * 100).toFixed(1) : '0.0'}% margin
                                </div>
                            </div>

                            <div className="rounded border-l-4 border-green-500 bg-white p-4">
                                <label className="text-muted-foreground block text-xs font-medium uppercase">Contract {fyLabel}</label>
                                <div className="text-xl font-bold">{formatCurrency(totals.revenueContractFY)}</div>
                            </div>
                            <div className="rounded border-l-4 border-red-500 bg-white p-4">
                                <label className="text-muted-foreground block text-xs font-medium uppercase">Cost Contract {fyLabel}</label>
                                <div className="text-xl font-bold">{formatCurrency(totals.costContractFY)}</div>
                            </div>
                            <div className="rounded border-l-4 border-purple-500 bg-white p-4">
                                <label className="text-muted-foreground block text-xs font-medium uppercase">Profit Contract {fyLabel}</label>
                                <div className="text-xl font-bold">{formatCurrency(profitContractFY)}</div>
                                <div className="text-muted-foreground mt-1 text-xs">{marginPercent.toFixed(1)}% margin</div>
                            </div>
                        </div>
                    </div>

                    {/* Monthly Breakdown Table */}
                    <div>
                        <h2 className="mb-3 text-lg font-semibold">Monthly Breakdown</h2>
                        <div className="overflow-x-auto rounded-lg border">
                            <table className="w-full text-xs">
                                <thead className="bg-cyan-600 text-white">
                                    <tr>
                                        <th className="px-2 py-2 text-left font-semibold">Month</th>
                                        <th className="px-2 py-2 text-right font-semibold">Monthly Revenue</th>
                                        <th className="px-2 py-2 text-right font-semibold">Monthly Cost</th>
                                        <th className="px-2 py-2 text-right font-semibold">Monthly Profit</th>
                                        <th className="px-2 py-2 text-right font-semibold">Cumulative Revenue</th>
                                        <th className="px-2 py-2 text-right font-semibold">Cumulative Cost</th>
                                        <th className="px-2 py-2 text-right font-semibold">Cumulative Profit</th>
                                        <th className="px-2 py-2 text-right font-semibold">Revenue %</th>
                                        <th className="px-2 py-2 text-right font-semibold">Cost %</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {monthlyData.map((row, idx) => (
                                        <tr key={row.month} className={row.isActual ? 'bg-yellow-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                            <td className="border-t px-2 py-1.5">{row.monthLabel}</td>
                                            <td className="border-t px-2 py-1.5 text-right">{formatCurrency(row.monthlyRevenue)}</td>
                                            <td className="border-t px-2 py-1.5 text-right">{formatCurrency(row.monthlyCost)}</td>
                                            <td className="border-t px-2 py-1.5 text-right">{formatCurrency(row.monthlyProfit)}</td>
                                            <td className="border-t px-2 py-1.5 text-right">{formatCurrency(row.cumulativeRevenue)}</td>
                                            <td className="border-t px-2 py-1.5 text-right">{formatCurrency(row.cumulativeCost)}</td>
                                            <td className="border-t px-2 py-1.5 text-right">{formatCurrency(row.cumulativeProfit)}</td>
                                            <td className="border-t px-2 py-1.5 text-right">
                                                {totals.totalContractValue > 0 && isFinite(row.cumulativeRevenue / totals.totalContractValue)
                                                    ? ((row.cumulativeRevenue / totals.totalContractValue) * 100).toFixed(1)
                                                    : '0.0'}
                                                %
                                            </td>
                                            <td className="border-t px-2 py-1.5 text-right">
                                                {totals.budget > 0 && isFinite(row.cumulativeCost / totals.budget)
                                                    ? ((row.cumulativeCost / totals.budget) * 100).toFixed(1)
                                                    : '0.0'}
                                                %
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-100 font-bold">
                                    <tr>
                                        <td className="border-t-2 border-cyan-600 px-2 py-2">REMAINING</td>
                                        <td className="border-t-2 border-cyan-600 px-2 py-2" colSpan={3}></td>
                                        <td className="border-t-2 border-cyan-600 px-2 py-2 text-right">{formatCurrency(remainingRevenue)}</td>
                                        <td className="border-t-2 border-cyan-600 px-2 py-2 text-right">{formatCurrency(remainingCost)}</td>
                                        <td className="border-t-2 border-cyan-600 px-2 py-2 text-right">{formatCurrency(remainingProfit)}</td>
                                        <td className="border-t-2 border-cyan-600 px-2 py-2" colSpan={2}></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Chart Section - Revenue */}
                    <div className="chart-section">
                        <h2 className="mb-3 text-lg font-semibold">Revenue Progression</h2>
                        <div className="h-80 rounded border bg-white p-4">
                            <Line ref={chartRefRevenue} data={chartDataRevenue} options={chartOptions} />
                        </div>
                    </div>

                    {/* Chart Section - Cost */}
                    <div className="chart-section">
                        <h2 className="mb-3 text-lg font-semibold">Cost Progression</h2>
                        <div className="h-80 rounded border bg-white p-4">
                            <Line ref={chartRefCost} data={chartDataCost} options={chartOptions} />
                        </div>
                    </div>

                    {/* Chart Section - Profit */}
                    <div className="chart-section">
                        <h2 className="mb-3 text-lg font-semibold">Profit Progression</h2>
                        <div className="h-80 rounded border bg-white p-4">
                            <Line ref={chartRefProfit} data={chartDataProfit} options={chartOptions} />
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
                                <span className="h-3 w-3 rounded-full bg-[#10B981]"></span>
                                <span className="h-3 w-3 rounded-full bg-[#EF4444]"></span>
                                <span className="h-3 w-3 rounded-full bg-[#A855F7]"></span>
                                Colored points indicate forecasted values
                            </li>
                            <li>Dashed lines represent forecast periods</li>
                            <li>Dotted lines show cumulative totals</li>
                        </ul>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
