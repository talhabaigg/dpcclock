import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { useMemo } from 'react';
import { buildLabourForecastColumnDefs } from './column-builders';

ModuleRegistry.registerModules([AllCommunityModule]);

interface Location {
    id: number;
    name: string;
    eh_location_id: number;
    eh_parent_id: number;
    state: string;
    job_number: string;
    forecast_status: string | null;
    forecast_submitted_at: string | null;
    forecast_approved_at: string | null;
    current_week_headcount: number;
    current_week_cost: number;
}

interface LabourForecastIndexProps {
    locations: Location[];
    currentMonth: string;
    currentWeekEnding: string;
}

const LabourForecastIndex = ({ locations, currentMonth, currentWeekEnding }: LabourForecastIndexProps) => {
    const breadcrumbs: BreadcrumbItem[] = [{ title: 'Labour Forecast', href: '/labour-forecast' }];

    // Calculate summary stats
    const stats = useMemo(() => {
        const total = locations.length;
        const draft = locations.filter((l) => l.forecast_status === 'draft').length;
        const submitted = locations.filter((l) => l.forecast_status === 'submitted').length;
        const approved = locations.filter((l) => l.forecast_status === 'approved').length;
        const notStarted = locations.filter((l) => !l.forecast_status).length;
        const currentWeekCost = locations.reduce((sum, l) => sum + (l.current_week_cost || 0), 0);
        const currentWeekHeadcount = locations.reduce((sum, l) => sum + (l.current_week_headcount || 0), 0);
        return { total, draft, submitted, approved, notStarted, currentWeekCost, currentWeekHeadcount };
    }, [locations]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: 'AUD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="p-4">
                {/* Header */}
                <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-xl font-semibold">Labour Forecast</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Forecast period: {currentMonth}</p>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Jobs</p>
                        <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Not Started</p>
                        <p className="mt-1 text-xl font-bold text-slate-600 dark:text-slate-300">{stats.notStarted}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Draft</p>
                        <p className="mt-1 text-xl font-bold text-slate-700 dark:text-slate-200">{stats.draft}</p>
                    </div>
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                        <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Submitted</p>
                        <p className="mt-1 text-xl font-bold text-blue-700 dark:text-blue-300">{stats.submitted}</p>
                    </div>
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
                        <p className="text-xs font-medium text-green-600 dark:text-green-400">Approved</p>
                        <p className="mt-1 text-xl font-bold text-green-700 dark:text-green-300">{stats.approved}</p>
                    </div>
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-800 dark:bg-indigo-900/20">
                        <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">This Week Headcount</p>
                        <p className="mt-1 text-xl font-bold text-indigo-700 dark:text-indigo-300">{stats.currentWeekHeadcount.toLocaleString()}</p>
                        <p className="text-[10px] text-indigo-500 dark:text-indigo-400">W/E {currentWeekEnding}</p>
                    </div>
                    <div className="col-span-2 rounded-lg border border-green-200 bg-green-50 p-3 sm:col-span-1 dark:border-green-800 dark:bg-green-900/20">
                        <p className="text-xs font-medium text-green-600 dark:text-green-400">This Week Cost</p>
                        <p className="mt-1 text-xl font-bold text-green-700 dark:text-green-300">{formatCurrency(stats.currentWeekCost)}</p>
                        <p className="text-[10px] text-green-500 dark:text-green-400">W/E {currentWeekEnding}</p>
                    </div>
                </div>

                {/* Grid */}
                <div className="ag-theme-alpine dark:ag-theme-alpine-dark" style={{ height: 'calc(100vh - 300px)', width: '100%' }}>
                    <AgGridReact
                        columnDefs={buildLabourForecastColumnDefs()}
                        rowData={locations}
                        defaultColDef={{
                            resizable: true,
                            suppressMovable: true,
                        }}
                        getRowId={(params) => params.data.id}
                        suppressColumnVirtualisation={true}
                    />
                </div>
            </div>
        </AppLayout>
    );
};

export default LabourForecastIndex;
