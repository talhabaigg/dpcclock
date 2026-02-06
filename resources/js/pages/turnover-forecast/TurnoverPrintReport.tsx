/**
 * Turnover Print Report - Professional A3 printable report for turnover forecast data
 * Displays SWCP, GRE, and Forecasted Projects with subtotals and FY summary
 */

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Printer } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { TurnoverRow } from './lib/data-transformer';

interface TurnoverPrintReportProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    data: TurnoverRow[];
    months: string[];
    lastActualMonth: string | null;
    fyLabel: string;
    monthlyTargets: Record<string, number>;
    allMonths: string[];
    selectedFY: string;
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

const formatNumber = (value: number | null | undefined, decimals: number = 0): string => {
    if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
        return '0';
    }
    return value.toLocaleString('en-AU', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
};

const safeNumber = (value: number | null | undefined): number => {
    if (value === null || value === undefined || Number.isNaN(value)) return 0;
    return Number(value);
};

const formatMonthHeader = (month: string): string => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
    return date.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' });
};

const formatCompactCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value) || !isFinite(value) || value === 0) {
        return '-';
    }
    return formatCurrency(value);
};

type ReportRow = {
    id: number;
    job_name: string;
    fy_contract: number;
    claimed_to_date: number;
    remaining_for_year: number;
    total_contract_value: number;
    remaining_order_book: number;
    monthly_values: Record<string, { value: number; isActual: boolean }>;
};

type SectionTotals = {
    fy_contract: number;
    claimed_to_date: number;
    remaining_for_year: number;
    total_contract_value: number;
    remaining_order_book: number;
    monthly_values: Record<string, number>;
};

export function TurnoverPrintReport({
    open,
    onOpenChange,
    data,
    months,
    lastActualMonth,
    fyLabel,
    monthlyTargets,
    allMonths,
    selectedFY,
}: TurnoverPrintReportProps) {
    // State for configurable overhead
    const [overheadAmount, setOverheadAmount] = useState(200000);

    // Transform data for report
    const reportData = useMemo(() => {
        const transformRow = (row: TurnoverRow): ReportRow => {
            // Get monthly values (prefer actuals over forecast)
            const monthly_values: Record<string, { value: number; isActual: boolean }> = {};
            months.forEach((month) => {
                const actualValue = safeNumber(row.revenue_actuals?.[month]);
                const forecastValue = safeNumber(row.revenue_forecast?.[month]);
                if (actualValue !== 0) {
                    monthly_values[month] = { value: actualValue, isActual: true };
                } else {
                    monthly_values[month] = { value: forecastValue, isActual: false };
                }
            });

            return {
                id: row.id,
                job_name: row.job_name,
                fy_contract: safeNumber(row.revenue_contract_fy),
                claimed_to_date: safeNumber(row.claimed_to_date),
                remaining_for_year: safeNumber(row.remaining_revenue_value_fy),
                total_contract_value: safeNumber(row.total_contract_value),
                remaining_order_book: safeNumber(row.remaining_order_book),
                monthly_values,
            };
        };

        const calculateTotals = (rows: ReportRow[]): SectionTotals => {
            const monthly_values: Record<string, number> = {};
            months.forEach((month) => {
                monthly_values[month] = rows.reduce((sum, row) => sum + (row.monthly_values[month]?.value || 0), 0);
            });

            return rows.reduce(
                (acc, row) => ({
                    fy_contract: acc.fy_contract + row.fy_contract,
                    claimed_to_date: acc.claimed_to_date + row.claimed_to_date,
                    remaining_for_year: acc.remaining_for_year + row.remaining_for_year,
                    total_contract_value: acc.total_contract_value + row.total_contract_value,
                    remaining_order_book: acc.remaining_order_book + row.remaining_order_book,
                    monthly_values,
                }),
                {
                    fy_contract: 0,
                    claimed_to_date: 0,
                    remaining_for_year: 0,
                    total_contract_value: 0,
                    remaining_order_book: 0,
                    monthly_values,
                },
            );
        };

        // Filter and transform by company
        const swcpRows = data.filter((r) => r.company === 'SWCP').map(transformRow);
        const greRows = data.filter((r) => r.company === 'GRE').map(transformRow);
        const forecastRows = data.filter((r) => r.company === 'Forecast').map(transformRow);

        const swcpTotals = calculateTotals(swcpRows);
        const greTotals = calculateTotals(greRows);
        const forecastTotals = calculateTotals(forecastRows);

        // Combined totals (SWCP + GRE only, not forecast projects)
        const combinedMonthlyValues: Record<string, number> = {};
        months.forEach((month) => {
            combinedMonthlyValues[month] = (swcpTotals.monthly_values[month] || 0) + (greTotals.monthly_values[month] || 0);
        });

        const combinedTotals: SectionTotals = {
            fy_contract: swcpTotals.fy_contract + greTotals.fy_contract,
            claimed_to_date: swcpTotals.claimed_to_date + greTotals.claimed_to_date,
            remaining_for_year: swcpTotals.remaining_for_year + greTotals.remaining_for_year,
            total_contract_value: swcpTotals.total_contract_value + greTotals.total_contract_value,
            remaining_order_book: swcpTotals.remaining_order_book + greTotals.remaining_order_book,
            monthly_values: combinedMonthlyValues,
        };

        // Labour calculations - monthly breakdown
        const labourRequirementByMonth: Record<string, number> = {};
        const labourForecastByMonth: Record<string, number> = {};
        const labourVarianceByMonth: Record<string, number> = {};

        months.forEach((month) => {
            // Labour requirement = combined revenue for month / 26000
            const monthRevenue = combinedMonthlyValues[month] || 0;
            const required = Math.ceil(monthRevenue / 26000);
            labourRequirementByMonth[month] = required;

            // Labour forecast = sum of labour_forecast_headcount for all SWCP/GRE jobs
            let forecast = 0;
            data.filter((r) => r.company === 'SWCP' || r.company === 'GRE').forEach((row) => {
                forecast += safeNumber(row.labour_forecast_headcount?.[month]);
            });
            labourForecastByMonth[month] = Math.round(forecast * 10) / 10;

            // Variance = forecast - required
            labourVarianceByMonth[month] = labourForecastByMonth[month] - labourRequirementByMonth[month];
        });

        return {
            swcp: { rows: swcpRows, totals: swcpTotals },
            gre: { rows: greRows, totals: greTotals },
            forecast: { rows: forecastRows, totals: forecastTotals },
            combined: combinedTotals,
            labourRequirementByMonth,
            labourForecastByMonth,
            labourVarianceByMonth,
        };
    }, [data, months]);

    // Widget/Summary data calculations
    const widgetData = useMemo(() => {
        let completedTurnoverYTD = 0;
        let forecastWorkFY = 0;

        data.forEach((row) => {
            months.forEach((month) => {
                const actualValue = safeNumber(row.revenue_actuals?.[month]);
                const forecastValue = safeNumber(row.revenue_forecast?.[month]);

                if (actualValue !== 0) {
                    completedTurnoverYTD += actualValue;
                } else if (forecastValue !== 0) {
                    forecastWorkFY += forecastValue;
                }
            });
        });

        const completedAndWorkInHand = completedTurnoverYTD + forecastWorkFY;

        // Budget calculations
        const targetMonthsToDate = lastActualMonth ? months.filter((month) => month < lastActualMonth) : months;
        const budgetTurnoverYTD = targetMonthsToDate.reduce((sum, month) => sum + safeNumber(monthlyTargets?.[month]), 0);
        const budgetTurnover = months.reduce((sum, month) => sum + safeNumber(monthlyTargets?.[month]), 0);
        const budgetBalanceToAchieve = Math.max(budgetTurnover - completedAndWorkInHand, 0);

        return {
            completedTurnoverYTD,
            budgetTurnoverYTD,
            forecastWorkFY,
            completedAndWorkInHand,
            budgetTurnover,
            budgetBalanceToAchieve,
        };
    }, [data, months, lastActualMonth, monthlyTargets]);

    // Get current month label
    const currentMonth = useMemo(() => {
        const now = new Date();
        return now.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
    }, []);

    // Calculate sustainability metrics for next 12 months
    const sustainabilityData = useMemo(() => {
        const KPI_THRESHOLD = 6; // Months threshold for sustainability

        // Get the next 12 months from current date
        const now = new Date();
        const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // Filter to get only future months (next 12 months from allMonths)
        const next12Months = allMonths.filter((month) => month >= currentYearMonth).slice(0, 12);

        let totalProfit = 0;
        let totalCost = 0;
        const monthlyProfits: Record<string, number> = {};
        const monthlyCosts: Record<string, number> = {};

        // Calculate profit and cost for each of the next 12 months
        next12Months.forEach((month) => {
            let monthRevenue = 0;
            let monthCost = 0;

            data.forEach((row) => {
                // Revenue: prefer actuals over forecast
                const actualRevenue = safeNumber(row.revenue_actuals?.[month]);
                const forecastRevenue = safeNumber(row.revenue_forecast?.[month]);
                monthRevenue += actualRevenue !== 0 ? actualRevenue : forecastRevenue;

                // Cost: prefer actuals over forecast
                const actualCost = safeNumber(row.cost_actuals?.[month]);
                const forecastCost = safeNumber(row.cost_forecast?.[month]);
                monthCost += actualCost !== 0 ? actualCost : forecastCost;
            });

            const monthProfit = monthRevenue - monthCost;
            monthlyProfits[month] = monthProfit;
            monthlyCosts[month] = monthCost;
            totalProfit += monthProfit;
            totalCost += monthCost;
        });

        const monthCount = next12Months.length || 1;
        const averageMonthlyCost = totalCost / monthCount;
        const averageOperationalCost = averageMonthlyCost + overheadAmount;
        const monthsSustainable = averageOperationalCost > 0 ? totalProfit / averageOperationalCost : 0;

        // Status tiers: green (>=6), amber (>=4 but <6), red (<4)
        const status: 'healthy' | 'warning' | 'critical' = monthsSustainable >= 6 ? 'healthy' : monthsSustainable >= 4 ? 'warning' : 'critical';

        return {
            next12Months,
            monthlyProfits,
            monthlyCosts,
            totalProfit,
            totalCost,
            averageMonthlyCost,
            overhead: overheadAmount,
            averageOperationalCost,
            monthsSustainable,
            kpiThreshold: KPI_THRESHOLD,
            status,
        };
    }, [data, allMonths, overheadAmount]);

    // Calculate summary data for next 2 FYs
    const futureFYSummaries = useMemo(() => {
        if (selectedFY === 'all') return [];

        const currentFYYear = parseInt(selectedFY);
        const summaries: Array<{
            fyYear: number;
            fyLabel: string;
            completedAndWorkInHand: number;
            budgetTurnover: number;
        }> = [];

        // Calculate for next 2 FYs
        for (let i = 1; i <= 2; i++) {
            const fyYear = currentFYYear + i;
            const fyStart = `${fyYear}-07`;
            const fyEnd = `${fyYear + 1}-06`;
            const fyMonths = allMonths.filter((month) => month >= fyStart && month <= fyEnd);

            let totalRevenue = 0;
            data.forEach((row) => {
                fyMonths.forEach((month) => {
                    const actualValue = safeNumber(row.revenue_actuals?.[month]);
                    const forecastValue = safeNumber(row.revenue_forecast?.[month]);
                    totalRevenue += actualValue !== 0 ? actualValue : forecastValue;
                });
            });

            const budgetTurnover = fyMonths.reduce((sum, month) => sum + safeNumber(monthlyTargets?.[month]), 0);

            summaries.push({
                fyYear,
                fyLabel: `FY${fyYear}-${String(fyYear + 1).slice(2)}`,
                completedAndWorkInHand: totalRevenue,
                budgetTurnover,
            });
        }

        return summaries;
    }, [selectedFY, allMonths, data, monthlyTargets]);

    const handlePrint = () => {
        const printWindow = window.open('', '', 'width=1400,height=900');
        if (!printWindow) return;

        // Generate monthly header cells
        const monthlyHeaders = months
            .map(
                (month) => `
                <th style="padding: 4px 2px; border: 1px solid #334155; text-align: right; font-size: 8px; color: white; font-weight: 600; white-space: nowrap;">${formatMonthHeader(month)}</th>
            `,
            )
            .join('');

        const generateTableRows = (rows: ReportRow[]) => {
            return rows
                .map(
                    (row, idx) => `
                <tr style="background: ${idx % 2 === 0 ? 'white' : '#f8fafc'};">
                    <td style="padding: 4px 6px; border: 1px solid #e2e8f0; text-align: left; font-size: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;">${row.job_name}</td>
                    <td style="padding: 4px 4px; border: 1px solid #e2e8f0; text-align: right; font-size: 9px;">${formatCompactCurrency(row.fy_contract)}</td>
                    <td style="padding: 4px 4px; border: 1px solid #e2e8f0; text-align: right; font-size: 9px;">${formatCompactCurrency(row.claimed_to_date)}</td>
                    <td style="padding: 4px 4px; border: 1px solid #e2e8f0; text-align: right; font-size: 9px;">${formatCompactCurrency(row.remaining_for_year)}</td>
                    <td style="padding: 4px 4px; border: 1px solid #e2e8f0; text-align: right; font-size: 9px;">${formatCompactCurrency(row.total_contract_value)}</td>
                    <td style="padding: 4px 4px; border: 1px solid #e2e8f0; text-align: right; font-size: 9px;">${formatCompactCurrency(row.remaining_order_book)}</td>
                    ${months
                        .map((month) => {
                            const monthData = row.monthly_values[month];
                            const value = monthData?.value || 0;
                            const isActual = monthData?.isActual || false;
                            const bgColor = isActual ? '#fef9c3' : 'transparent';
                            return `<td style="padding: 4px 2px; border: 1px solid #e2e8f0; text-align: right; font-size: 8px; background: ${bgColor};">${formatCompactCurrency(value)}</td>`;
                        })
                        .join('')}
                </tr>
            `,
                )
                .join('');
        };

        const generateSubtotalRow = (label: string, totals: SectionTotals, bgColor: string, textColor: string = '#1e3a5f') => `
            <tr style="background: ${bgColor}; font-weight: 600;">
                <td style="padding: 5px 6px; border: 1px solid #e2e8f0; text-align: left; font-size: 9px; color: ${textColor};">${label}</td>
                <td style="padding: 5px 4px; border: 1px solid #e2e8f0; text-align: right; font-size: 9px; color: ${textColor};">${formatCompactCurrency(totals.fy_contract)}</td>
                <td style="padding: 5px 4px; border: 1px solid #e2e8f0; text-align: right; font-size: 9px; color: ${textColor};">${formatCompactCurrency(totals.claimed_to_date)}</td>
                <td style="padding: 5px 4px; border: 1px solid #e2e8f0; text-align: right; font-size: 9px; color: ${textColor};">${formatCompactCurrency(totals.remaining_for_year)}</td>
                <td style="padding: 5px 4px; border: 1px solid #e2e8f0; text-align: right; font-size: 9px; color: ${textColor};">${formatCompactCurrency(totals.total_contract_value)}</td>
                <td style="padding: 5px 4px; border: 1px solid #e2e8f0; text-align: right; font-size: 9px; color: ${textColor};">${formatCompactCurrency(totals.remaining_order_book)}</td>
                ${months
                    .map(
                        (month) =>
                            `<td style="padding: 4px 2px; border: 1px solid #e2e8f0; text-align: right; font-size: 8px; color: ${textColor};">${formatCompactCurrency(totals.monthly_values[month] || 0)}</td>`,
                    )
                    .join('')}
            </tr>
        `;

        const tableHeader = `
            <tr style="background: #334155;">
                <th style="padding: 5px 6px; border: 1px solid #334155; text-align: left; font-size: 9px; color: white; font-weight: 600; min-width: 120px;">Job Name</th>
                <th style="padding: 5px 4px; border: 1px solid #334155; text-align: right; font-size: 8px; color: white; font-weight: 600;">FY Contract</th>
                <th style="padding: 5px 4px; border: 1px solid #334155; text-align: right; font-size: 8px; color: white; font-weight: 600;">Claimed</th>
                <th style="padding: 5px 4px; border: 1px solid #334155; text-align: right; font-size: 8px; color: white; font-weight: 600;">Rem. Year</th>
                <th style="padding: 5px 4px; border: 1px solid #334155; text-align: right; font-size: 8px; color: white; font-weight: 600;">Total Value</th>
                <th style="padding: 5px 4px; border: 1px solid #334155; text-align: right; font-size: 8px; color: white; font-weight: 600;">Order Book</th>
                ${monthlyHeaders}
            </tr>
        `;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Turnover Forecast - ${fyLabel}</title>
                    <style>
                        @page {
                            size: A3 landscape;
                            margin: 12mm;
                        }
                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                        }
                        body {
                            font-family: Arial, sans-serif;
                            padding: 15px;
                            color: #1e293b;
                            font-size: 10px;
                        }
                        @media print {
                            body {
                                padding: 0;
                            }
                            .no-print {
                                display: none !important;
                            }
                            * {
                                -webkit-print-color-adjust: exact !important;
                                print-color-adjust: exact !important;
                            }
                        }
                    </style>
                </head>
                <body>
                    <!-- Header -->
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #334155;">
                        <img src="/logo.png" alt="Superior Wall & Ceiling Professionals" style="height: 40px;" />
                        <div style="text-align: center; flex: 1;">
                            <h1 style="font-size: 24px; color: #1e293b; margin-bottom: 4px; font-weight: 700;">Turnover Forecast</h1>
                            <p style="font-size: 11px; color: #64748b;">Current Month: ${currentMonth} | Financial Year: ${fyLabel}</p>
                        </div>
                        <p style="font-size: 9px; color: #94a3b8; text-align: right;">Generated: ${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>

                    <!-- Table 1: SWCP and GRE Data -->
                    <div style="margin-bottom: 25px;">
                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 0;">
                            <thead>
                                ${tableHeader}
                            </thead>
                            <tbody>
                                <!-- SWCP Section Header -->
                                <tr style="background: #f8fafc;">
                                    <td colspan="${6 + months.length}" style="padding: 6px 10px; font-weight: 700; font-size: 10px; color: #1e293b; border: 1px solid #e2e8f0;">
                                        SWCP (${reportData.swcp.rows.length} projects)
                                    </td>
                                </tr>
                                ${generateTableRows(reportData.swcp.rows)}
                                ${generateSubtotalRow('SWCP Sub-total', reportData.swcp.totals, '#e2e8f0', '#1e293b')}

                                <!-- GRE Section Header -->
                                <tr style="background: #f1f5f9;">
                                    <td colspan="${6 + months.length}" style="padding: 6px 10px; font-weight: 700; font-size: 10px; color: #334155; border: 1px solid #e2e8f0;">
                                        GRE (${reportData.gre.rows.length} projects)
                                    </td>
                                </tr>
                                ${generateTableRows(reportData.gre.rows)}
                                ${generateSubtotalRow('GRE Sub-total', reportData.gre.totals, '#e2e8f0', '#1e293b')}

                                <!-- Combined Totals -->
                                ${generateSubtotalRow('Combined Total (SWCP + GRE)', reportData.combined, '#334155', 'white')}

                                <!-- Labour Requirement Row -->
                                <tr style="background: #f8fafc;">
                                    <td style="padding: 5px 6px; border: 1px solid #e2e8f0; font-size: 9px; color: #334155; font-weight: 600;">Labour Requirement</td>
                                    <td colspan="5" style="padding: 5px; border: 1px solid #e2e8f0; font-size: 9px;"></td>
                                    ${months.map((month) => `<td style="padding: 4px 2px; border: 1px solid #e2e8f0; text-align: right; font-size: 8px; color: #334155; font-weight: 600;">${formatNumber(reportData.labourRequirementByMonth[month], 0)}</td>`).join('')}
                                </tr>
                                <!-- Labour Forecast Row -->
                                <tr style="background: #f8fafc;">
                                    <td style="padding: 5px 6px; border: 1px solid #e2e8f0; font-size: 9px; color: #334155; font-weight: 600;">Labour Forecast</td>
                                    <td colspan="5" style="padding: 5px; border: 1px solid #e2e8f0; font-size: 9px;"></td>
                                    ${months.map((month) => `<td style="padding: 4px 2px; border: 1px solid #e2e8f0; text-align: right; font-size: 8px; color: #334155; font-weight: 600;">${formatNumber(reportData.labourForecastByMonth[month], 1)}</td>`).join('')}
                                </tr>
                                <!-- Labour Variance Row -->
                                <tr style="background: #f8fafc;">
                                    <td style="padding: 5px 6px; border: 1px solid #e2e8f0; font-size: 9px; color: #334155; font-weight: 600;">Labour Variance</td>
                                    <td colspan="5" style="padding: 5px; border: 1px solid #e2e8f0; font-size: 9px;"></td>
                                    ${months
                                        .map((month) => {
                                            const variance = reportData.labourVarianceByMonth[month];
                                            const color = variance < 0 ? '#991b1b' : '#166534';
                                            return `<td style="padding: 4px 2px; border: 1px solid #e2e8f0; text-align: right; font-size: 8px; color: ${color}; font-weight: 700;">${variance > 0 ? '+' : ''}${formatNumber(variance, 1)}</td>`;
                                        })
                                        .join('')}
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Table 2: Forecasted Projects -->
                    <div style="margin-bottom: 25px;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                ${tableHeader}
                            </thead>
                            <tbody>
                                <!-- Forecast Section Header -->
                                <tr style="background: #f1f5f9;">
                                    <td colspan="${6 + months.length}" style="padding: 6px 10px; font-weight: 700; font-size: 10px; color: #334155; border: 1px solid #e2e8f0;">
                                        Forecasted Projects (${reportData.forecast.rows.length} projects)
                                    </td>
                                </tr>
                                ${generateTableRows(reportData.forecast.rows)}
                                ${generateSubtotalRow('Forecasted Projects Total', reportData.forecast.totals, '#e2e8f0', '#1e293b')}
                            </tbody>
                        </table>
                    </div>

                    <!-- Sustainability KPI Section -->
                    <div style="margin-top: 20px; margin-bottom: 20px;">
                        <div style="border: 2px solid ${sustainabilityData.status === 'healthy' ? '#10b981' : sustainabilityData.status === 'warning' ? '#f59e0b' : '#ef4444'}; border-radius: 8px; overflow: hidden;">
                            <div style="background: ${sustainabilityData.status === 'healthy' ? '#059669' : sustainabilityData.status === 'warning' ? '#d97706' : '#dc2626'}; color: white; padding: 12px 16px;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <h3 style="font-size: 14px; font-weight: 700; margin: 0;">
                                            Business Sustainability Analysis (Next 12 Months)
                                        </h3>
                                        <p style="font-size: 11px; margin: 4px 0 0 0; opacity: 0.9;">
                                            ${sustainabilityData.status === 'healthy' ? 'HEALTHY - Business is Sustainable' : sustainabilityData.status === 'warning' ? 'CAUTION - Monitor Closely' : 'CRITICAL - Action Required'}
                                        </p>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="font-size: 24px; font-weight: 700;">${formatNumber(sustainabilityData.monthsSustainable, 1)} months</div>
                                        <div style="font-size: 10px; opacity: 0.9;">KPI Target: ${sustainabilityData.kpiThreshold} months</div>
                                    </div>
                                </div>
                            </div>
                            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 12px 16px; background: ${sustainabilityData.status === 'healthy' ? '#ecfdf5' : sustainabilityData.status === 'warning' ? '#fffbeb' : '#fef2f2'};">
                                <div>
                                    <div style="font-size: 9px; font-weight: 600; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">Total Profit (12mo)</div>
                                    <div style="font-size: 14px; font-weight: 700; color: ${sustainabilityData.totalProfit >= 0 ? '#047857' : '#dc2626'};">${formatCurrency(sustainabilityData.totalProfit)}</div>
                                </div>
                                <div>
                                    <div style="font-size: 9px; font-weight: 600; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">Avg Monthly Cost</div>
                                    <div style="font-size: 14px; font-weight: 700; color: #334155;">${formatCurrency(sustainabilityData.averageMonthlyCost)}</div>
                                </div>
                                <div>
                                    <div style="font-size: 9px; font-weight: 600; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">Overhead</div>
                                    <div style="font-size: 14px; font-weight: 700; color: #334155;">${formatCurrency(sustainabilityData.overhead)}</div>
                                </div>
                                <div>
                                    <div style="font-size: 9px; font-weight: 600; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">Avg Operational Cost</div>
                                    <div style="font-size: 14px; font-weight: 700; color: #334155;">${formatCurrency(sustainabilityData.averageOperationalCost)}</div>
                                </div>
                            </div>
                            <div style="background: white; border-top: 1px solid #e2e8f0; padding: 8px 16px; font-size: 9px; color: #64748b;">
                                <strong>Formula:</strong> Months Sustainable = Total Profit / Avg Operational Cost | Avg Operational Cost = Avg Monthly Cost + ${formatCurrency(overheadAmount)} Overhead
                            </div>
                        </div>
                    </div>

                    <!-- Widget/Summary Section -->
                    <div style="margin-top: 20px; display: flex; gap: 20px;">
                        <div style="flex: 1;">
                            <!-- Current FY Summary -->
                            <div style="margin-bottom: 12px;">
                                <div style="background: #334155; color: white; padding: 8px 12px; border: 1px solid #334155;">
                                    <h3 style="font-size: 11px; font-weight: 600; margin: 0;">${fyLabel} Summary</h3>
                                </div>
                                <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-top: none;">
                                    <tbody>
                                        <tr style="background: white;">
                                            <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-size: 10px; font-weight: 500; color: #334155;">Completed Turnover YTD</td>
                                            <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-size: 10px; font-weight: 700; text-align: right; color: #1e293b;">${formatCurrency(widgetData.completedTurnoverYTD)}</td>
                                        </tr>
                                        <tr style="background: #f8fafc;">
                                            <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-size: 10px; font-weight: 500; color: #334155;">Budget Turnover YTD</td>
                                            <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-size: 10px; font-weight: 700; text-align: right; color: #1e293b;">${formatCurrency(widgetData.budgetTurnoverYTD)}</td>
                                        </tr>
                                        <tr style="background: white;">
                                            <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-size: 10px; font-weight: 500; color: #334155;">Forecast Work FY</td>
                                            <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-size: 10px; font-weight: 700; text-align: right; color: #1e293b;">${formatCurrency(widgetData.forecastWorkFY)}</td>
                                        </tr>
                                        <tr style="background: #f8fafc;">
                                            <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-size: 10px; font-weight: 600; color: #1e293b;">Completed Turnover + Work in Hand</td>
                                            <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: 700; text-align: right; color: #1e293b;">${formatCurrency(widgetData.completedAndWorkInHand)}</td>
                                        </tr>
                                        <tr style="background: white;">
                                            <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-size: 10px; font-weight: 500; color: #334155;">Budget Turnover</td>
                                            <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-size: 10px; font-weight: 700; text-align: right; color: #1e293b;">${formatCurrency(widgetData.budgetTurnover)}</td>
                                        </tr>
                                        <tr style="background: #f8fafc;">
                                            <td style="padding: 6px 10px; font-size: 10px; font-weight: 600; color: #1e293b;">Budget Balance to Achieve</td>
                                            <td style="padding: 6px 10px; font-size: 11px; font-weight: 700; text-align: right; color: #1e293b;">${formatCurrency(widgetData.budgetBalanceToAchieve)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <!-- Future FYs Summary -->
                            ${
                                futureFYSummaries.length > 0
                                    ? `
                            <div style="display: flex; gap: 10px;">
                                ${futureFYSummaries
                                    .map(
                                        (fy) => `
                                <div style="flex: 1;">
                                    <div style="background: #64748b; color: white; padding: 6px 10px; border: 1px solid #64748b;">
                                        <h4 style="font-size: 10px; font-weight: 600; margin: 0;">${fy.fyLabel}</h4>
                                    </div>
                                    <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-top: none;">
                                        <tbody>
                                            <tr style="background: white;">
                                                <td style="padding: 5px 8px; border-bottom: 1px solid #e2e8f0; font-size: 9px; font-weight: 500; color: #334155;">Forecast Revenue</td>
                                                <td style="padding: 5px 8px; border-bottom: 1px solid #e2e8f0; font-size: 9px; font-weight: 700; text-align: right; color: #1e293b;">${formatCurrency(fy.completedAndWorkInHand)}</td>
                                            </tr>
                                            <tr style="background: #f8fafc;">
                                                <td style="padding: 5px 8px; font-size: 9px; font-weight: 500; color: #334155;">Budget Target</td>
                                                <td style="padding: 5px 8px; font-size: 9px; font-weight: 700; text-align: right; color: #1e293b;">${formatCurrency(fy.budgetTurnover)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                `,
                                    )
                                    .join('')}
                            </div>
                            `
                                    : ''
                            }
                        </div>

                        <!-- Summary Stats -->
                        <div style="flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; align-content: start;">
                            <div style="background: #f8fafc; border-left: 3px solid #334155; padding: 10px;">
                                <div style="font-size: 9px; color: #334155; text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">SWCP Projects</div>
                                <div style="font-size: 16px; font-weight: 700; color: #1e293b;">${reportData.swcp.rows.length}</div>
                            </div>
                            <div style="background: #f8fafc; border-left: 3px solid #334155; padding: 10px;">
                                <div style="font-size: 9px; color: #334155; text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">GRE Projects</div>
                                <div style="font-size: 16px; font-weight: 700; color: #1e293b;">${reportData.gre.rows.length}</div>
                            </div>
                            <div style="background: #f8fafc; border-left: 3px solid #334155; padding: 10px;">
                                <div style="font-size: 9px; color: #334155; text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">Forecast Projects</div>
                                <div style="font-size: 16px; font-weight: 700; color: #1e293b;">${reportData.forecast.rows.length}</div>
                            </div>
                            <div style="background: #f8fafc; border-left: 3px solid #334155; padding: 10px;">
                                <div style="font-size: 9px; color: #334155; text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">Total FY Contract</div>
                                <div style="font-size: 11px; font-weight: 700; color: #1e293b;">${formatCurrency(reportData.combined.fy_contract)}</div>
                            </div>
                            <div style="background: #f8fafc; border-left: 3px solid #334155; padding: 10px;">
                                <div style="font-size: 9px; color: #334155; text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">Total Contract Value</div>
                                <div style="font-size: 11px; font-weight: 700; color: #1e293b;">${formatCurrency(reportData.combined.total_contract_value)}</div>
                            </div>
                            <div style="background: #f8fafc; border-left: 3px solid #334155; padding: 10px;">
                                <div style="font-size: 9px; color: #334155; text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">Order Book</div>
                                <div style="font-size: 11px; font-weight: 700; color: #1e293b;">${formatCurrency(reportData.combined.remaining_order_book)}</div>
                            </div>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #e2e8f0; text-align: center;">
                        <p style="font-size: 8px; color: #64748b;">This report was generated from the Turnover Forecast system. Data reflects the current state at time of generation.</p>
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
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="h-[95vh] min-w-[95vw] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle>Turnover Forecast - {fyLabel}</DialogTitle>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Label htmlFor="overhead" className="text-sm font-medium whitespace-nowrap">
                                    Monthly Overhead:
                                </Label>
                                <div className="relative">
                                    <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm">$</span>
                                    <Input
                                        id="overhead"
                                        type="number"
                                        value={overheadAmount}
                                        onChange={(e) => setOverheadAmount(Number(e.target.value) || 0)}
                                        className="h-9 w-32 pl-7"
                                        min={0}
                                        step={10000}
                                    />
                                </div>
                            </div>
                            <Button onClick={handlePrint} variant="default" size="sm">
                                <Printer className="mr-2 h-4 w-4" />
                                Print Report
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Preview Header */}
                    <div className="border-b pb-4 text-center">
                        <h1 className="text-2xl font-bold text-slate-800">Turnover Forecast</h1>
                        <p className="text-muted-foreground text-sm">
                            Current Month: {currentMonth} | Financial Year: {fyLabel}
                        </p>
                    </div>

                    {/* Table 1: SWCP & GRE */}
                    <div>
                        <h2 className="mb-3 text-lg font-semibold">Current Projects</h2>
                        <div className="overflow-x-auto rounded-lg border">
                            <table className="w-full text-xs">
                                <thead className="bg-slate-800 text-white">
                                    <tr>
                                        <th className="px-2 py-2 text-left font-semibold">Job Name</th>
                                        <th className="px-2 py-2 text-right text-[10px] font-semibold">FY Contract</th>
                                        <th className="px-2 py-2 text-right text-[10px] font-semibold">Claimed</th>
                                        <th className="px-2 py-2 text-right text-[10px] font-semibold">Rem. Year</th>
                                        <th className="px-2 py-2 text-right text-[10px] font-semibold">Total Value</th>
                                        <th className="px-2 py-2 text-right text-[10px] font-semibold">Order Book</th>
                                        {months.map((month) => (
                                            <th key={month} className="px-1 py-2 text-right text-[9px] font-semibold">
                                                {formatMonthHeader(month)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* SWCP Section */}
                                    <tr className="border-l-4 border-l-emerald-500 bg-emerald-50">
                                        <td colSpan={6 + months.length} className="px-3 py-2 font-semibold text-emerald-800">
                                            SWCP ({reportData.swcp.rows.length} projects)
                                        </td>
                                    </tr>
                                    {reportData.swcp.rows.map((row, idx) => (
                                        <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                            <td className="max-w-[180px] truncate border-t px-2 py-1">{row.job_name}</td>
                                            <td className="border-t px-2 py-1 text-right text-[10px]">{formatCompactCurrency(row.fy_contract)}</td>
                                            <td className="border-t px-2 py-1 text-right text-[10px]">
                                                {formatCompactCurrency(row.claimed_to_date)}
                                            </td>
                                            <td className="border-t px-2 py-1 text-right text-[10px]">
                                                {formatCompactCurrency(row.remaining_for_year)}
                                            </td>
                                            <td className="border-t px-2 py-1 text-right text-[10px]">
                                                {formatCompactCurrency(row.total_contract_value)}
                                            </td>
                                            <td className="border-t px-2 py-1 text-right text-[10px]">
                                                {formatCompactCurrency(row.remaining_order_book)}
                                            </td>
                                            {months.map((month) => {
                                                const monthData = row.monthly_values[month];
                                                return (
                                                    <td
                                                        key={month}
                                                        className={`border-t px-1 py-1 text-right text-[9px] ${monthData?.isActual ? 'bg-yellow-100' : ''}`}
                                                    >
                                                        {formatCompactCurrency(monthData?.value || 0)}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                    <tr className="bg-emerald-100 font-semibold text-emerald-800">
                                        <td className="border-t px-2 py-2">SWCP Sub-total</td>
                                        <td className="border-t px-2 py-2 text-right text-[10px]">
                                            {formatCompactCurrency(reportData.swcp.totals.fy_contract)}
                                        </td>
                                        <td className="border-t px-2 py-2 text-right text-[10px]">
                                            {formatCompactCurrency(reportData.swcp.totals.claimed_to_date)}
                                        </td>
                                        <td className="border-t px-2 py-2 text-right text-[10px]">
                                            {formatCompactCurrency(reportData.swcp.totals.remaining_for_year)}
                                        </td>
                                        <td className="border-t px-2 py-2 text-right text-[10px]">
                                            {formatCompactCurrency(reportData.swcp.totals.total_contract_value)}
                                        </td>
                                        <td className="border-t px-2 py-2 text-right text-[10px]">
                                            {formatCompactCurrency(reportData.swcp.totals.remaining_order_book)}
                                        </td>
                                        {months.map((month) => (
                                            <td key={month} className="border-t px-1 py-2 text-right text-[9px]">
                                                {formatCompactCurrency(reportData.swcp.totals.monthly_values[month] || 0)}
                                            </td>
                                        ))}
                                    </tr>

                                    {/* GRE Section */}
                                    <tr className="border-l-4 border-l-blue-500 bg-blue-50">
                                        <td colSpan={6 + months.length} className="px-3 py-2 font-semibold text-blue-800">
                                            GRE ({reportData.gre.rows.length} projects)
                                        </td>
                                    </tr>
                                    {reportData.gre.rows.map((row, idx) => (
                                        <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                            <td className="max-w-[180px] truncate border-t px-2 py-1">{row.job_name}</td>
                                            <td className="border-t px-2 py-1 text-right text-[10px]">{formatCompactCurrency(row.fy_contract)}</td>
                                            <td className="border-t px-2 py-1 text-right text-[10px]">
                                                {formatCompactCurrency(row.claimed_to_date)}
                                            </td>
                                            <td className="border-t px-2 py-1 text-right text-[10px]">
                                                {formatCompactCurrency(row.remaining_for_year)}
                                            </td>
                                            <td className="border-t px-2 py-1 text-right text-[10px]">
                                                {formatCompactCurrency(row.total_contract_value)}
                                            </td>
                                            <td className="border-t px-2 py-1 text-right text-[10px]">
                                                {formatCompactCurrency(row.remaining_order_book)}
                                            </td>
                                            {months.map((month) => {
                                                const monthData = row.monthly_values[month];
                                                return (
                                                    <td
                                                        key={month}
                                                        className={`border-t px-1 py-1 text-right text-[9px] ${monthData?.isActual ? 'bg-yellow-100' : ''}`}
                                                    >
                                                        {formatCompactCurrency(monthData?.value || 0)}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                    <tr className="bg-blue-100 font-semibold text-blue-800">
                                        <td className="border-t px-2 py-2">GRE Sub-total</td>
                                        <td className="border-t px-2 py-2 text-right text-[10px]">
                                            {formatCompactCurrency(reportData.gre.totals.fy_contract)}
                                        </td>
                                        <td className="border-t px-2 py-2 text-right text-[10px]">
                                            {formatCompactCurrency(reportData.gre.totals.claimed_to_date)}
                                        </td>
                                        <td className="border-t px-2 py-2 text-right text-[10px]">
                                            {formatCompactCurrency(reportData.gre.totals.remaining_for_year)}
                                        </td>
                                        <td className="border-t px-2 py-2 text-right text-[10px]">
                                            {formatCompactCurrency(reportData.gre.totals.total_contract_value)}
                                        </td>
                                        <td className="border-t px-2 py-2 text-right text-[10px]">
                                            {formatCompactCurrency(reportData.gre.totals.remaining_order_book)}
                                        </td>
                                        {months.map((month) => (
                                            <td key={month} className="border-t px-1 py-2 text-right text-[9px]">
                                                {formatCompactCurrency(reportData.gre.totals.monthly_values[month] || 0)}
                                            </td>
                                        ))}
                                    </tr>

                                    {/* Combined Totals */}
                                    <tr className="bg-slate-800 font-bold text-white">
                                        <td className="border-t px-2 py-2">Combined Total (SWCP + GRE)</td>
                                        <td className="border-t px-2 py-2 text-right text-[10px]">
                                            {formatCompactCurrency(reportData.combined.fy_contract)}
                                        </td>
                                        <td className="border-t px-2 py-2 text-right text-[10px]">
                                            {formatCompactCurrency(reportData.combined.claimed_to_date)}
                                        </td>
                                        <td className="border-t px-2 py-2 text-right text-[10px]">
                                            {formatCompactCurrency(reportData.combined.remaining_for_year)}
                                        </td>
                                        <td className="border-t px-2 py-2 text-right text-[10px]">
                                            {formatCompactCurrency(reportData.combined.total_contract_value)}
                                        </td>
                                        <td className="border-t px-2 py-2 text-right text-[10px]">
                                            {formatCompactCurrency(reportData.combined.remaining_order_book)}
                                        </td>
                                        {months.map((month) => (
                                            <td key={month} className="border-t px-1 py-2 text-right text-[9px]">
                                                {formatCompactCurrency(reportData.combined.monthly_values[month] || 0)}
                                            </td>
                                        ))}
                                    </tr>

                                    {/* Labour Requirement Row */}
                                    <tr className="bg-violet-50 text-violet-800">
                                        <td className="border-t px-2 py-2 font-semibold">Labour Requirement</td>
                                        <td colSpan={5} className="border-t px-2 py-2"></td>
                                        {months.map((month) => (
                                            <td key={month} className="border-t px-1 py-2 text-right text-[9px] font-semibold">
                                                {formatNumber(reportData.labourRequirementByMonth[month], 0)}
                                            </td>
                                        ))}
                                    </tr>
                                    {/* Labour Forecast Row */}
                                    <tr className="bg-violet-50 text-violet-800">
                                        <td className="border-t px-2 py-2 font-semibold">Labour Forecast</td>
                                        <td colSpan={5} className="border-t px-2 py-2"></td>
                                        {months.map((month) => (
                                            <td key={month} className="border-t px-1 py-2 text-right text-[9px] font-semibold">
                                                {formatNumber(reportData.labourForecastByMonth[month], 1)}
                                            </td>
                                        ))}
                                    </tr>
                                    {/* Labour Variance Row */}
                                    <tr className="bg-violet-50">
                                        <td className="border-t px-2 py-2 font-semibold text-violet-800">Labour Variance</td>
                                        <td colSpan={5} className="border-t px-2 py-2"></td>
                                        {months.map((month) => {
                                            const variance = reportData.labourVarianceByMonth[month];
                                            return (
                                                <td
                                                    key={month}
                                                    className={`border-t px-1 py-2 text-right text-[9px] font-bold ${
                                                        variance < 0 ? 'text-red-600' : 'text-green-600'
                                                    }`}
                                                >
                                                    {variance > 0 ? '+' : ''}
                                                    {formatNumber(variance, 1)}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Table 2: Forecasted Projects */}
                    <div>
                        <h2 className="mb-3 text-lg font-semibold">Forecasted Projects</h2>
                        <div className="overflow-x-auto rounded-lg border">
                            <table className="w-full text-xs">
                                <thead className="bg-slate-800 text-white">
                                    <tr>
                                        <th className="px-2 py-2 text-left font-semibold">Job Name</th>
                                        <th className="px-2 py-2 text-right text-[10px] font-semibold">FY Contract</th>
                                        <th className="px-2 py-2 text-right text-[10px] font-semibold">Claimed</th>
                                        <th className="px-2 py-2 text-right text-[10px] font-semibold">Rem. Year</th>
                                        <th className="px-2 py-2 text-right text-[10px] font-semibold">Total Value</th>
                                        <th className="px-2 py-2 text-right text-[10px] font-semibold">Order Book</th>
                                        {months.map((month) => (
                                            <th key={month} className="px-1 py-2 text-right text-[9px] font-semibold">
                                                {formatMonthHeader(month)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-l-4 border-l-violet-500 bg-violet-50">
                                        <td colSpan={6 + months.length} className="px-3 py-2 font-semibold text-violet-800">
                                            Forecasted Projects ({reportData.forecast.rows.length} projects)
                                        </td>
                                    </tr>
                                    {reportData.forecast.rows.map((row, idx) => (
                                        <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                            <td className="max-w-[180px] truncate border-t px-2 py-1">{row.job_name}</td>
                                            <td className="border-t px-2 py-1 text-right text-[10px]">{formatCompactCurrency(row.fy_contract)}</td>
                                            <td className="border-t px-2 py-1 text-right text-[10px]">
                                                {formatCompactCurrency(row.claimed_to_date)}
                                            </td>
                                            <td className="border-t px-2 py-1 text-right text-[10px]">
                                                {formatCompactCurrency(row.remaining_for_year)}
                                            </td>
                                            <td className="border-t px-2 py-1 text-right text-[10px]">
                                                {formatCompactCurrency(row.total_contract_value)}
                                            </td>
                                            <td className="border-t px-2 py-1 text-right text-[10px]">
                                                {formatCompactCurrency(row.remaining_order_book)}
                                            </td>
                                            {months.map((month) => {
                                                const monthData = row.monthly_values[month];
                                                return (
                                                    <td
                                                        key={month}
                                                        className={`border-t px-1 py-1 text-right text-[9px] ${monthData?.isActual ? 'bg-yellow-100' : ''}`}
                                                    >
                                                        {formatCompactCurrency(monthData?.value || 0)}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                    <tr className="bg-violet-100 font-semibold text-violet-800">
                                        <td className="border-t px-2 py-2">Total</td>
                                        <td className="border-t px-2 py-2 text-right text-[10px]">
                                            {formatCompactCurrency(reportData.forecast.totals.fy_contract)}
                                        </td>
                                        <td className="border-t px-2 py-2 text-right text-[10px]">
                                            {formatCompactCurrency(reportData.forecast.totals.claimed_to_date)}
                                        </td>
                                        <td className="border-t px-2 py-2 text-right text-[10px]">
                                            {formatCompactCurrency(reportData.forecast.totals.remaining_for_year)}
                                        </td>
                                        <td className="border-t px-2 py-2 text-right text-[10px]">
                                            {formatCompactCurrency(reportData.forecast.totals.total_contract_value)}
                                        </td>
                                        <td className="border-t px-2 py-2 text-right text-[10px]">
                                            {formatCompactCurrency(reportData.forecast.totals.remaining_order_book)}
                                        </td>
                                        {months.map((month) => (
                                            <td key={month} className="border-t px-1 py-2 text-right text-[9px]">
                                                {formatCompactCurrency(reportData.forecast.totals.monthly_values[month] || 0)}
                                            </td>
                                        ))}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Sustainability KPI Widget */}
                    <div className="mb-6">
                        <h2 className="mb-3 text-lg font-semibold">Business Sustainability Analysis (Next 12 Months)</h2>
                        <div
                            className={`overflow-hidden rounded-lg border-2 ${
                                sustainabilityData.status === 'healthy'
                                    ? 'border-emerald-500 bg-emerald-50'
                                    : sustainabilityData.status === 'warning'
                                      ? 'border-amber-500 bg-amber-50'
                                      : 'border-red-500 bg-red-50'
                            }`}
                        >
                            <div
                                className={`px-4 py-3 text-white ${
                                    sustainabilityData.status === 'healthy'
                                        ? 'bg-emerald-600'
                                        : sustainabilityData.status === 'warning'
                                          ? 'bg-amber-600'
                                          : 'bg-red-600'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold">
                                        {sustainabilityData.status === 'healthy'
                                            ? 'HEALTHY - Business is Sustainable'
                                            : sustainabilityData.status === 'warning'
                                              ? 'CAUTION - Monitor Closely'
                                              : 'CRITICAL - Action Required'}
                                    </h3>
                                    <span className="text-2xl font-bold">{formatNumber(sustainabilityData.monthsSustainable, 1)} months</span>
                                </div>
                                <p className="mt-1 text-sm opacity-90">
                                    KPI Target: {sustainabilityData.kpiThreshold} months | Status:{' '}
                                    {sustainabilityData.status === 'healthy'
                                        ? 'Above threshold (6+ months)'
                                        : sustainabilityData.status === 'warning'
                                          ? 'Warning zone (4-6 months)'
                                          : 'Below threshold (<4 months)'}
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-4">
                                <div>
                                    <div className="text-xs font-medium text-slate-500 uppercase">Total Profit (12mo)</div>
                                    <div className={`text-lg font-bold ${sustainabilityData.totalProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                        {formatCurrency(sustainabilityData.totalProfit)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs font-medium text-slate-500 uppercase">Avg Monthly Cost</div>
                                    <div className="text-lg font-bold text-slate-700">{formatCurrency(sustainabilityData.averageMonthlyCost)}</div>
                                </div>
                                <div>
                                    <div className="text-xs font-medium text-slate-500 uppercase">Overhead</div>
                                    <div className="text-lg font-bold text-slate-700">{formatCurrency(sustainabilityData.overhead)}</div>
                                </div>
                                <div>
                                    <div className="text-xs font-medium text-slate-500 uppercase">Avg Operational Cost</div>
                                    <div className="text-lg font-bold text-slate-700">
                                        {formatCurrency(sustainabilityData.averageOperationalCost)}
                                    </div>
                                </div>
                            </div>
                            <div className="border-t bg-white/50 px-4 py-2 text-xs text-slate-600">
                                <strong>Formula:</strong> Months Sustainable = Total Profit / Avg Operational Cost | Avg Operational Cost = Avg
                                Monthly Cost + {formatCurrency(overheadAmount)} Overhead
                            </div>
                        </div>
                    </div>

                    {/* Widget Summary */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-4">
                            {/* Current FY Summary */}
                            <div>
                                <h2 className="mb-3 text-lg font-semibold">{fyLabel} Summary</h2>
                                <div className="overflow-hidden rounded-lg border">
                                    <table className="w-full text-sm">
                                        <tbody>
                                            <tr className="bg-white">
                                                <td className="border-b px-4 py-3 font-medium text-slate-600">Completed Turnover YTD</td>
                                                <td className="border-b px-4 py-3 text-right font-bold">
                                                    {formatCurrency(widgetData.completedTurnoverYTD)}
                                                </td>
                                            </tr>
                                            <tr className="bg-slate-50">
                                                <td className="border-b px-4 py-3 font-medium text-slate-600">Budget Turnover YTD</td>
                                                <td className="border-b px-4 py-3 text-right font-bold">
                                                    {formatCurrency(widgetData.budgetTurnoverYTD)}
                                                </td>
                                            </tr>
                                            <tr className="bg-white">
                                                <td className="border-b px-4 py-3 font-medium text-slate-600">Forecast Work FY</td>
                                                <td className="border-b px-4 py-3 text-right font-bold">
                                                    {formatCurrency(widgetData.forecastWorkFY)}
                                                </td>
                                            </tr>
                                            <tr className="bg-blue-50">
                                                <td className="border-b px-4 py-3 font-semibold text-blue-700">Completed Turnover + Work in Hand</td>
                                                <td className="border-b px-4 py-3 text-right text-lg font-bold text-blue-700">
                                                    {formatCurrency(widgetData.completedAndWorkInHand)}
                                                </td>
                                            </tr>
                                            <tr className="bg-white">
                                                <td className="border-b px-4 py-3 font-medium text-slate-600">Budget Turnover</td>
                                                <td className="border-b px-4 py-3 text-right font-bold">
                                                    {formatCurrency(widgetData.budgetTurnover)}
                                                </td>
                                            </tr>
                                            <tr className={widgetData.budgetBalanceToAchieve > 0 ? 'bg-amber-50' : 'bg-emerald-50'}>
                                                <td
                                                    className={`px-4 py-3 font-semibold ${widgetData.budgetBalanceToAchieve > 0 ? 'text-amber-700' : 'text-emerald-700'}`}
                                                >
                                                    Budget Balance to Achieve
                                                </td>
                                                <td
                                                    className={`px-4 py-3 text-right text-lg font-bold ${widgetData.budgetBalanceToAchieve > 0 ? 'text-amber-700' : 'text-emerald-700'}`}
                                                >
                                                    {formatCurrency(widgetData.budgetBalanceToAchieve)}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Future FYs Summary */}
                            {futureFYSummaries.length > 0 && (
                                <div className="grid grid-cols-2 gap-3">
                                    {futureFYSummaries.map((fy) => (
                                        <div key={fy.fyYear} className="overflow-hidden rounded-lg border">
                                            <div className="bg-slate-600 px-3 py-2 text-white">
                                                <h4 className="text-sm font-semibold">{fy.fyLabel}</h4>
                                            </div>
                                            <table className="w-full text-sm">
                                                <tbody>
                                                    <tr className="bg-white">
                                                        <td className="border-b px-3 py-2 text-xs font-medium text-slate-600">Forecast Revenue</td>
                                                        <td className="border-b px-3 py-2 text-right text-sm font-bold">
                                                            {formatCurrency(fy.completedAndWorkInHand)}
                                                        </td>
                                                    </tr>
                                                    <tr className="bg-slate-50">
                                                        <td className="px-3 py-2 text-xs font-medium text-slate-600">Budget Target</td>
                                                        <td className="px-3 py-2 text-right text-sm font-bold">
                                                            {formatCurrency(fy.budgetTurnover)}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Project Counts */}
                        <div>
                            <h2 className="mb-3 text-lg font-semibold">Project Summary</h2>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="rounded-lg border-l-4 border-l-emerald-500 bg-emerald-50 p-4">
                                    <div className="text-xs font-semibold text-emerald-700 uppercase">SWCP Projects</div>
                                    <div className="text-2xl font-bold text-emerald-700">{reportData.swcp.rows.length}</div>
                                </div>
                                <div className="rounded-lg border-l-4 border-l-blue-500 bg-blue-50 p-4">
                                    <div className="text-xs font-semibold text-blue-700 uppercase">GRE Projects</div>
                                    <div className="text-2xl font-bold text-blue-700">{reportData.gre.rows.length}</div>
                                </div>
                                <div className="rounded-lg border-l-4 border-l-violet-500 bg-violet-50 p-4">
                                    <div className="text-xs font-semibold text-violet-700 uppercase">Forecast Projects</div>
                                    <div className="text-2xl font-bold text-violet-700">{reportData.forecast.rows.length}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
