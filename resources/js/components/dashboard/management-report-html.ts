/**
 * Pure function that generates a complete HTML document string for the
 * Monthly Management Report. Designed for A4 portrait print via
 * window.open() + document.write().
 */

import type { JobSummary, Location } from '@/types';
import type { LabourBudgetRow } from './labour-budget-card';
import type { ProductionCostCode } from './budget-donut-card';

/* ─── helpers ─── */

const audFmt = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});

const numFmt = new Intl.NumberFormat('en-AU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
});

const n = (v: number | string | null | undefined): number => {
    if (v === null || v === undefined) return 0;
    const x = Number(v);
    return isNaN(x) || !isFinite(x) ? 0 : x;
};

const $ = (v: number | string | null | undefined): string => {
    const x = n(v);
    return x === 0 ? '-' : audFmt.format(x);
};

const pct = (v: number | string | null | undefined): string => {
    const x = n(v);
    return x === 0 ? '-' : `${x.toFixed(1)}%`;
};

const hrs = (v: number | string | null | undefined): string => {
    const x = n(v);
    return x === 0 ? '-' : numFmt.format(x);
};

const fmtDate = (d: string | null | undefined): string => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
};


/* ─── types ─── */

interface TimelineData {
    start_date: string;
    estimated_end_date: string;
    actual_end_date: string | null;
    actual_start_date: string | null;
    status: string;
}

interface IncomePeriod {
    income: number;
    cost: number;
    profit: number;
    profitPercent: number;
}

interface ProjectIncomeData {
    originalContractSum: IncomePeriod;
    currentContractSum: IncomePeriod;
    thisMonth: IncomePeriod;
    previousMonth: IncomePeriod;
    projectToDate: IncomePeriod;
    remainingBalance: IncomePeriod;
}

interface VariationRow {
    status: string;
    type: string;
    qty: number;
    value: number;
    percent_of_total: number;
    aging_over_30: number | null;
    aging_over_30_value: number | null;
}

interface VendorCommitmentsSummary {
    po_outstanding: number;
    sc_outstanding: number;
    sc_summary: { value: number; variations: number; invoiced_to_date: number; remaining_balance: number };
}

interface EmployeesOnSite {
    by_type: { worktype: string; count: number }[];
    weekly_trend: { week_ending: string; month: string; count: number }[];
    total_workers: number;
    prev_workers: number;
}

export interface ManagementReportData {
    location: Location & { job_summary?: JobSummary };
    timelineData: TimelineData | null;
    asOfDate?: string;
    claimedToDate?: number;
    cashRetention?: number;
    projectIncomeData: ProjectIncomeData;
    variationsSummary: VariationRow[];
    labourBudgetData: LabourBudgetRow[];
    vendorCommitmentsSummary: VendorCommitmentsSummary | null;
    employeesOnSite: EmployeesOnSite | null;
    productionCostCodes: ProductionCostCode[] | null;
    industrialActionHours: number;
    dpcPercentComplete: number | null;
}

/* ─── CSS ─── */

const CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
@page { size: A4 portrait; margin: 10mm; }
@media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body { margin: 0; padding: 0; }
}
body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9px;
    color: #1e293b;
    line-height: 1.45;
    padding: 15px;
}

/* ── page structure ── */
.page {}
@media print {
    .page + .page { page-break-before: always; }
}
@media screen {
    .page { margin-bottom: 20px; padding-bottom: 16px; }
}

/* ── header ── */
.report-header {
    border-bottom: 2px solid #334155;
    padding-bottom: 8px;
    margin-bottom: 14px;
}
.report-header h1 {
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
}
.report-header .subtitle {
    font-size: 10px;
    color: #475569;
}

/* ── KPI strip ── */
.kpi-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 16px;
}
.kpi-box {
    background: #f8fafc;
    border-left: 3px solid #334155;
    padding: 8px 10px;
}
.kpi-box.green  { border-left-color: #16a34a; }
.kpi-box.amber  { border-left-color: #d97706; }
.kpi-box.red    { border-left-color: #dc2626; }
.kpi-label {
    font-size: 7.5px;
    color: #64748b;
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.4px;
    margin-bottom: 3px;
}
.kpi-value {
    font-size: 15px;
    font-weight: 700;
    color: #1e293b;
}
.kpi-sub {
    font-size: 8px;
    color: #64748b;
    margin-top: 2px;
}

/* ── section headers ── */
.section-title {
    background: #334155;
    color: white;
    padding: 5px 10px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.3px;
    margin-top: 16px;
    margin-bottom: 4px;
}
.section-title:first-child {
    margin-top: 0;
}

/* ── tables ── */
table.data {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12px;
    font-size: 9px;
    font-variant-numeric: tabular-nums;
}
table.data thead {
    background: #334155;
    color: white;
}
table.data th {
    padding: 4px 8px;
    text-align: right;
    font-weight: 600;
    font-size: 8px;
    border: 1px solid #334155;
    white-space: nowrap;
}
table.data th:first-child { text-align: left; }
table.data td {
    padding: 3px 8px;
    text-align: right;
    border: 1px solid #e2e8f0;
}
table.data td:first-child { text-align: left; font-weight: 500; }
table.data tbody tr:nth-child(even) { background: #f8fafc; }
table.data tfoot td {
    background: #334155;
    color: white;
    font-weight: 600;
    border: 1px solid #334155;
}

/* ── inline pair ── */
.pair-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 12px;
}

/* ── misc ── */
.metric-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 8px;
    border-bottom: 1px solid #e2e8f0;
}
.metric-row:last-child { border-bottom: none; }
.metric-row .label { color: #475569; }
.metric-row .value { font-weight: 600; }

.card {
    border: 1px solid #e2e8f0;
    padding: 8px;
    margin-bottom: 12px;
}
.card-title {
    font-size: 9px;
    font-weight: 600;
    color: #334155;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
}

`;

/* ─── section renderers ─── */

function renderHeader(d: ManagementReportData): string {
    return `
    <div class="report-header" style="display:flex; align-items:center;">
        <div style="width:100px;">
            <img src="/logo.png" alt="Logo" style="height:36px;" />
        </div>
        <div style="flex:1; text-align:center;">
            <h1>MONTHLY PROJECT REPORT</h1>
            <div class="subtitle">
                ${d.location.name} &nbsp;|&nbsp; As at: ${fmtDate(d.asOfDate)}
            </div>
        </div>
        <div style="width:100px; text-align:right;">
            <div style="font-size:16px; font-weight:600; color:#0f172a; letter-spacing:0.3px;">${d.location.external_id || '-'}</div>
            <div style="font-size:8px; color:#64748b; text-transform:uppercase; letter-spacing:0.3px;">Job Number</div>
        </div>
    </div>`;
}

function renderKpiStrip(d: ManagementReportData): string {
    const tl = d.timelineData;
    const income = d.projectIncomeData;
    const emp = d.employeesOnSite;
    const varTotal = d.variationsSummary.reduce((s, r) => s + n(r.value), 0);

    // Timeline overrun
    let overrunDays = 0;
    let overrunColor = 'green';
    if (tl) {
        const end = tl.actual_end_date ?? tl.estimated_end_date;
        if (end && tl.estimated_end_date) {
            overrunDays = Math.round((new Date(end).getTime() - new Date(tl.estimated_end_date).getTime()) / 86400000);
        }
        overrunColor = overrunDays > 30 ? 'red' : overrunDays > 0 ? 'amber' : 'green';
    }

    // Margin
    const marginPct = n(income.currentContractSum.profitPercent);
    const origMargin = n(income.originalContractSum.profitPercent);
    const marginColor = marginPct >= origMargin ? 'green' : marginPct >= origMargin - 3 ? 'amber' : 'red';

    // DPC
    const dpc = d.dpcPercentComplete;
    const dpcStr = dpc !== null && dpc !== undefined ? `${n(dpc).toFixed(1)}%` : 'N/A';

    // Workers
    const workers = emp ? emp.total_workers : 0;
    const delta = emp ? emp.total_workers - emp.prev_workers : 0;
    const deltaStr = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '0';

    // Claimed
    const claimed = n(d.claimedToDate);

    return `
    <div class="kpi-grid">
        <div class="kpi-box ${overrunColor}">
            <div class="kpi-label">Timeline</div>
            <div class="kpi-value">${overrunDays > 0 ? `+${overrunDays}d` : overrunDays < 0 ? `${overrunDays}d` : 'On Track'}</div>
            <div class="kpi-sub">${fmtDate(tl?.actual_start_date ?? tl?.start_date)} &rarr; ${fmtDate(tl?.actual_end_date ?? tl?.estimated_end_date)}</div>
        </div>
        <div class="kpi-box ${marginColor}">
            <div class="kpi-label">Forecast Margin</div>
            <div class="kpi-value">${pct(marginPct)}</div>
            <div class="kpi-sub">Original: ${pct(origMargin)}</div>
        </div>
        <div class="kpi-box">
            <div class="kpi-label">DPC % Complete</div>
            <div class="kpi-value">${dpcStr}</div>
        </div>
        <div class="kpi-box">
            <div class="kpi-label">Workers on Site</div>
            <div class="kpi-value">${workers}</div>
            <div class="kpi-sub">${deltaStr} from prev period</div>
        </div>
        <div class="kpi-box">
            <div class="kpi-label">Variations Total</div>
            <div class="kpi-value">${$(varTotal)}</div>
            <div class="kpi-sub">${d.variationsSummary.reduce((s, r) => s + n(r.qty), 0)} items</div>
        </div>
        <div class="kpi-box">
            <div class="kpi-label">Claimed to Date</div>
            <div class="kpi-value">${$(claimed)}</div>
            ${d.cashRetention ? `<div class="kpi-sub">Retention: ${$(d.cashRetention)}</div>` : ''}
        </div>
    </div>`;
}

function renderIncomeTable(d: ManagementReportData): string {
    const rows = [
        { label: 'Original Contract Sum', data: d.projectIncomeData.originalContractSum },
        { label: 'Current Contract Sum', data: d.projectIncomeData.currentContractSum },
        { label: 'This Month', data: d.projectIncomeData.thisMonth },
        { label: 'Previous Month', data: d.projectIncomeData.previousMonth },
        { label: 'Project to Date', data: d.projectIncomeData.projectToDate },
        { label: 'Remaining Balance', data: d.projectIncomeData.remainingBalance },
    ];

    return `
    <div class="section-title">Project Income Summary</div>
    <table class="data">
        <thead>
            <tr>
                <th>Period</th>
                <th>Income</th>
                <th>Cost</th>
                <th>Profit</th>
                <th>Margin %</th>
            </tr>
        </thead>
        <tbody>
            ${rows.map((r) => `
                <tr>
                    <td>${r.label}</td>
                    <td>${$(r.data.income)}</td>
                    <td>${$(r.data.cost)}</td>
                    <td>${$(r.data.profit)}</td>
                    <td>${pct(r.data.profitPercent)}</td>
                </tr>`).join('')}
        </tbody>
    </table>`;
}

function renderVariations(d: ManagementReportData): string {
    // Match dashboard card: filter to pending & approved only, group by type
    const VISIBLE_STATUSES = ['pending', 'approved'];
    const filtered = d.variationsSummary.filter(
        (r) => VISIBLE_STATUSES.includes(r.status?.toLowerCase() ?? ''),
    );

    if (filtered.length === 0) {
        return `
        <div class="section-title">Variations</div>
        <p style="padding:6px 0; color:#64748b; font-style:italic;">No active variations (pending/approved).</p>`;
    }

    // Group by type (aggregate across statuses)
    const typeMap = new Map<string, { type: string; qty: number; value: number; aging: number }>();
    for (const row of filtered) {
        const key = row.type?.toLowerCase() ?? 'unknown';
        if (!typeMap.has(key)) {
            typeMap.set(key, { type: row.type, qty: 0, value: 0, aging: 0 });
        }
        const g = typeMap.get(key)!;
        g.qty += n(row.qty);
        g.value += n(row.value);
        g.aging += n(row.aging_over_30);
    }
    const groups = [...typeMap.values()].sort((a, b) => b.value - a.value);

    const totalQty = groups.reduce((s, g) => s + g.qty, 0);
    const totalVal = groups.reduce((s, g) => s + g.value, 0);
    const totalAging = groups.reduce((s, g) => s + g.aging, 0);

    return `
    <div class="section-title">Variations</div>
    <table class="data">
        <thead>
            <tr>
                <th>Type</th>
                <th>Qty</th>
                <th>Value</th>
                <th>%</th>
                <th>&gt;30d</th>
            </tr>
        </thead>
        <tbody>
            ${groups.map((g) => `
                <tr>
                    <td>${g.type}</td>
                    <td>${g.qty}</td>
                    <td>${$(g.value)}</td>
                    <td>${totalVal > 0 ? pct((g.value / totalVal) * 100) : '-'}</td>
                    <td>${g.aging || '-'}</td>
                </tr>`).join('')}
        </tbody>
        <tfoot>
            <tr>
                <td>Total</td>
                <td>${totalQty}</td>
                <td>${$(totalVal)}</td>
                <td>100%</td>
                <td>${totalAging || '-'}</td>
            </tr>
        </tfoot>
    </table>`;
}

function renderCostUtilisation(d: ManagementReportData): string {
    if (d.labourBudgetData.length === 0) {
        return `
        <div class="section-title">Cost Utilisation</div>
        <p style="padding:6px 0; color:#64748b; font-style:italic;">No cost data available.</p>`;
    }

    // Match the card's default grouping: direct labour items + All Material + All Oncosts
    const LABOUR_PREFIXES = ['01', '03', '05', '07'];
    const ONCOST_PREFIXES = ['02', '04', '06', '08'];

    // Direct labour items (individual rows matching default: 01-01, 03-01, 05-01, 07-01)
    const directLabourItems = d.labourBudgetData
        .filter((r) => LABOUR_PREFIXES.includes(r.cost_item.split('-')[0]))
        .sort((a, b) => a.cost_item.localeCompare(b.cost_item));

    // Material = everything NOT in labour prefixes
    const materialItems = d.labourBudgetData.filter(
        (r) => !LABOUR_PREFIXES.includes(r.cost_item.split('-')[0]),
    );
    const matBudget = materialItems.reduce((s, r) => s + n(r.budget), 0);
    const matSpent = materialItems.reduce((s, r) => s + n(r.spent), 0);

    // Oncosts = items in oncost prefixes
    const oncostItems = d.labourBudgetData.filter(
        (r) => ONCOST_PREFIXES.includes(r.cost_item.split('-')[0]),
    );
    const oncBudget = oncostItems.reduce((s, r) => s + n(r.budget), 0);
    const oncSpent = oncostItems.reduce((s, r) => s + n(r.spent), 0);

    // Build display rows
    type DisplayRow = { code: string; label: string; budget: number; spent: number };
    const rows: DisplayRow[] = [
        ...directLabourItems.map((r) => ({ code: r.cost_item, label: r.label, budget: n(r.budget), spent: n(r.spent) })),
        { code: '', label: 'All Material', budget: matBudget, spent: matSpent },
        { code: '', label: 'All Oncosts', budget: oncBudget, spent: oncSpent },
    ];

    return `
    <div class="section-title">Cost Utilisation</div>
    <table class="data">
        <thead>
            <tr>
                <th>Item</th>
                <th>Budget</th>
                <th>Spent</th>
                <th>Remaining</th>
                <th>Util %</th>
            </tr>
        </thead>
        <tbody>
            ${rows.map((r) => {
                const remaining = r.budget - r.spent;
                const utilPct = r.budget > 0 ? (r.spent / r.budget) * 100 : 0;
                return `
                <tr>
                    <td>${r.code ? `${r.code} — ` : ''}${r.label}</td>
                    <td>${$(r.budget)}</td>
                    <td>${$(r.spent)}</td>
                    <td>${$(remaining)}</td>
                    <td>${pct(utilPct)}</td>
                </tr>`;
            }).join('')}
        </tbody>
    </table>`;
}

function renderCommitments(d: ManagementReportData): string {
    const vc = d.vendorCommitmentsSummary;
    if (!vc) {
        return `
        <div class="section-title">Vendor Commitments</div>
        <p style="padding:6px 0; color:#64748b; font-style:italic;">No commitment data available.</p>`;
    }

    return `
    <div class="section-title">Vendor Commitments</div>
    <div class="pair-grid">
        <div class="card">
            <div class="card-title">Purchase Orders</div>
            <div class="metric-row">
                <span class="label">Outstanding</span>
                <span class="value">${$(vc.po_outstanding)}</span>
            </div>
        </div>
        <div class="card">
            <div class="card-title">Subcontracts</div>
            <div class="metric-row">
                <span class="label">Outstanding</span>
                <span class="value">${$(vc.sc_outstanding)}</span>
            </div>
        </div>
    </div>
    ${vc.sc_summary ? `
    <table class="data">
        <thead>
            <tr>
                <th>Subcontract Summary</th>
                <th>Value</th>
            </tr>
        </thead>
        <tbody>
            <tr><td>Original Value</td><td>${$(vc.sc_summary.value)}</td></tr>
            <tr><td>Variations</td><td>${$(vc.sc_summary.variations)}</td></tr>
            <tr><td>Invoiced to Date</td><td>${$(vc.sc_summary.invoiced_to_date)}</td></tr>
            <tr><td>Remaining Balance</td><td>${$(vc.sc_summary.remaining_balance)}</td></tr>
        </tbody>
    </table>` : ''}`;
}

function renderEmployees(d: ManagementReportData): string {
    const emp = d.employeesOnSite;
    if (!emp || emp.by_type.length === 0) {
        return `
        <div class="section-title">Employees on Site</div>
        <p style="padding:6px 0; color:#64748b; font-style:italic;">No employee data available.</p>`;
    }

    const delta = emp.total_workers - emp.prev_workers;
    const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;
    const sorted = [...emp.by_type].sort((a, b) => a.worktype.localeCompare(b.worktype));

    return `
    <div class="section-title">Employees on Site</div>
    <div style="margin-bottom:8px; padding:4px 8px; background:#f8fafc; border-left:3px solid #334155;">
        <strong>${emp.total_workers}</strong> workers &nbsp;(${deltaStr} from previous period)
    </div>
    <table class="data">
        <thead>
            <tr>
                <th>Worktype</th>
                <th>Count</th>
            </tr>
        </thead>
        <tbody>
            ${sorted.map((w) => `
                <tr>
                    <td>${w.worktype}</td>
                    <td>${w.count}</td>
                </tr>`).join('')}
        </tbody>
        <tfoot>
            <tr>
                <td>Total</td>
                <td>${emp.total_workers}</td>
            </tr>
        </tfoot>
    </table>`;
}

function renderProduction(d: ManagementReportData): string {
    const codes = d.productionCostCodes;
    if (!codes || codes.length === 0) {
        return `
        <div class="section-title">DPC Production Summary</div>
        <p style="padding:6px 0; color:#64748b; font-style:italic;">No DPC production data available.</p>`;
    }

    // Only show cost codes with negative actual_variance (over budget), sorted by cost code
    const overUsed = codes
        .filter((c) => n(c.actual_variance) < 0)
        .sort((a, b) => a.cost_code.localeCompare(b.cost_code));

    const totalEst = codes.reduce((s, c) => s + n(c.est_hours), 0);
    const totalUsed = codes.reduce((s, c) => s + n(c.used_hours), 0);
    const totalVariance = codes.reduce((s, c) => s + n(c.actual_variance), 0);

    return `
    <div class="section-title">DPC Production Summary</div>
    ${d.dpcPercentComplete !== null && d.dpcPercentComplete !== undefined
        ? `<div style="margin-bottom:8px; padding:4px 8px; background:#f8fafc; border-left:3px solid #334155;">
            Overall DPC % Complete: <strong>${n(d.dpcPercentComplete).toFixed(1)}%</strong>
            &nbsp;|&nbsp; Total Est: ${hrs(totalEst)} &nbsp;|&nbsp; Total Used: ${hrs(totalUsed)}
            &nbsp;|&nbsp; Variance: ${hrs(totalVariance)}
          </div>`
        : ''}
    ${overUsed.length === 0
        ? `<p style="padding:6px 0; color:#16a34a; font-style:italic;">No cost codes with negative variance.</p>`
        : `<p style="padding:4px 0 4px 0; color:#64748b; font-size:8px;">Showing ${overUsed.length} cost code${overUsed.length > 1 ? 's' : ''} with negative variance (hours over budget)</p>
    <table class="data">
        <thead>
            <tr>
                <th>Cost Code</th>
                <th>Description</th>
                <th>Est Hours</th>
                <th>Used Hours</th>
                <th>Variance</th>
                <th>% Complete</th>
            </tr>
        </thead>
        <tbody>
            ${overUsed.map((c) => {
                const pctComplete = n(c.est_hours) > 0 ? (n(c.used_hours) / n(c.est_hours)) * 100 : 0;
                return `
                <tr>
                    <td>${c.cost_code}</td>
                    <td>${c.code_description}</td>
                    <td>${hrs(c.est_hours)}</td>
                    <td>${hrs(c.used_hours)}</td>
                    <td style="color:#dc2626; font-weight:600;">${hrs(c.actual_variance)}</td>
                    <td>${pct(pctComplete)}</td>
                </tr>`;
            }).join('')}
        </tbody>
    </table>`}`;
}

function renderClaimVsProduction(d: ManagementReportData): string {
    const js = d.location.job_summary;
    if (!js) return '';

    const claimedPct = n(js.current_estimate_revenue) > 0 && d.claimedToDate
        ? (n(d.claimedToDate) / n(js.current_estimate_revenue)) * 100
        : 0;
    const dpcPct = n(d.dpcPercentComplete);
    const variance = claimedPct - dpcPct;
    const indicator = Math.abs(variance) < 3 ? 'On Track' : variance > 0 ? 'Over-claimed' : 'Under-claimed';

    return `
    <div class="section-title">Claim vs Production Alignment</div>
    <table class="data">
        <thead>
            <tr><th>Metric</th><th>Value</th></tr>
        </thead>
        <tbody>
            <tr><td>Claimed % of Contract</td><td>${pct(claimedPct)}</td></tr>
            <tr><td>DPC % Complete</td><td>${dpcPct ? pct(dpcPct) : 'N/A'}</td></tr>
            <tr><td>Variance</td><td>${variance > 0 ? '+' : ''}${variance.toFixed(1)}% &mdash; ${indicator}</td></tr>
        </tbody>
    </table>`;
}

function renderSafety(d: ManagementReportData): string {
    return `
    <div class="section-title">Safety &amp; Industrial Impacts</div>
    <table class="data">
        <thead>
            <tr><th>Impact</th><th>Hours</th></tr>
        </thead>
        <tbody>
            <tr><td>Industrial Action</td><td>${hrs(d.industrialActionHours)}</td></tr>
        </tbody>
    </table>`;
}

/* ─── main export ─── */

export function generateReportHtml(data: ManagementReportData): string {
    const header = renderHeader(data);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Monthly Project Report - ${data.location.name}</title>
    <style>${CSS}</style>
</head>
<body>
    <!-- Page 1: Executive Summary -->
    <div class="page">
        ${header}
        ${renderKpiStrip(data)}
        ${renderIncomeTable(data)}
        ${renderVariations(data)}
    </div>

    <!-- Page 2: Cost & Commitments -->
    <div class="page">
        ${renderCostUtilisation(data)}
        ${renderCommitments(data)}
        ${renderEmployees(data)}
    </div>

    <!-- Page 3: Production & Safety -->
    <div class="page">
        ${renderProduction(data)}
        ${renderClaimVsProduction(data)}
        ${renderSafety(data)}
    </div>
</body>
</html>`;
}
