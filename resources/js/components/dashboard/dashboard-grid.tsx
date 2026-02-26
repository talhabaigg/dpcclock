import { GridLayout, useContainerWidth, noCompactor, type LayoutItem as RGLLayoutItem } from 'react-grid-layout';
import { useCallback, useMemo, useState } from 'react';
import { Eye, EyeOff, RotateCcw, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { GRID_COLS, GRID_ROWS, GRID_MARGIN, WIDGET_REGISTRY, type LayoutItem } from './widget-registry';
import { useDashboardLayout, type GridLayoutSettings } from './use-dashboard-layout';
import type { ProductionCostCode } from './budget-safety-card';
import type { LabourBudgetRow } from './labour-budget-card';
import type { Location, JobSummary } from '@/types';

import ProjectDetailsCard from './project-details-card';
import OtherItemsCard from './other-items-card';
import ProjectIncomeCard from './project-income-card';
import VariationsCard from './variations-card';
import LabourBudgetCard from './labour-budget-card';
import VendorCommitmentsCard from './vendor-commitments-card';
import EmployeesOnSiteCard from './employees-on-site-card';
import BudgetSafetyCard from './budget-safety-card';
import BudgetWeatherCard from './budget-weather-card';
import IndustrialActionCard from './industrial-action-card';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

interface ProjectIncomeData {
    originalContractSum: { income: number; cost: number; profit: number; profitPercent: number };
    currentContractSum: { income: number; cost: number; profit: number; profitPercent: number };
    thisMonth: { income: number; cost: number; profit: number; profitPercent: number };
    projectToDate: { income: number; cost: number; profit: number; profitPercent: number };
    remainingBalance: { income: number; cost: number; profit: number; profitPercent: number };
}

interface VariationRow {
    type: string;
    qty: number;
    value: number;
    percent_of_total: number;
    aging_over_30: number | null;
}

interface TimelineData {
    start_date: string;
    estimated_end_date: string;
    actual_end_date: string | null;
    actual_start_date: string | null;
    status: string;
}

export interface DashboardGridProps {
    location: Location & { job_summary?: JobSummary };
    timelineData: TimelineData | null;
    claimedToDate?: number;
    cashRetention?: number;
    projectIncomeData: ProjectIncomeData;
    variationsSummary: VariationRow[];
    labourBudgetData: LabourBudgetRow[];
    vendorCommitmentsSummary: {
        po_outstanding: number;
        sc_outstanding: number;
        sc_summary: { value: number; variations: number; invoiced_to_date: number; remaining_balance: number };
    } | null;
    employeesOnSite: {
        by_type: { worktype: string; count: number }[];
        weekly_trend: { week_ending: string; month: string; count: number }[];
        total_workers: number;
    } | null;
    productionCostCodes: ProductionCostCode[] | null;
    industrialActionHours: number;
    dashboardSettings: Record<string, unknown> | null;
}

function renderWidget(id: string, props: DashboardGridProps, isEditing: boolean) {
    const ds = props.dashboardSettings as Record<string, string> | null;
    switch (id) {
        case 'project-details':
            return <ProjectDetailsCard location={props.location} timelineData={props.timelineData} isEditing={isEditing} />;
        case 'variations':
            return <VariationsCard data={props.variationsSummary} isEditing={isEditing} />;
        case 'budget-safety':
            return (
                <BudgetSafetyCard
                    locationId={props.location.id}
                    costCodes={props.productionCostCodes ?? []}
                    savedCostCode={ds?.safety_cost_code}
                    isEditing={isEditing}
                />
            );
        case 'industrial-action':
            return <IndustrialActionCard hours={props.industrialActionHours} isEditing={isEditing} />;
        case 'budget-weather':
            return (
                <BudgetWeatherCard
                    locationId={props.location.id}
                    costCodes={props.productionCostCodes ?? []}
                    savedCostCode={ds?.weather_cost_code}
                    isEditing={isEditing}
                />
            );
        case 'other-items':
            return <OtherItemsCard location={props.location} claimedToDate={props.claimedToDate} cashRetention={props.cashRetention} isEditing={isEditing} />;
        case 'vendor-commitments':
            return <VendorCommitmentsCard data={props.vendorCommitmentsSummary} isEditing={isEditing} />;
        case 'employees-on-site':
            return <EmployeesOnSiteCard data={props.employeesOnSite} isEditing={isEditing} />;
        case 'project-income':
            return <ProjectIncomeCard data={props.projectIncomeData} isEditing={isEditing} />;
        case 'labour-budget':
            return <LabourBudgetCard data={props.labourBudgetData} isEditing={isEditing} />;
        default:
            return <div className="flex items-center justify-center h-full text-muted-foreground text-xs">Unknown widget</div>;
    }
}

export default function DashboardGrid(props: DashboardGridProps) {
    const { layouts, hiddenWidgets, isEditing, setIsEditing, onLayoutChange, toggleWidget, resetLayout } = useDashboardLayout(
        props.location.id,
        props.dashboardSettings as GridLayoutSettings | null,
    );

    const { width, containerRef, mounted } = useContainerWidth({ initialWidth: 1280 });
    const [gridHeight, setGridHeight] = useState(0);

    const gridRef = useCallback((node: HTMLDivElement | null) => {
        if (node) {
            const obs = new ResizeObserver(([entry]) => {
                setGridHeight(entry.contentRect.height);
            });
            obs.observe(node);
            return () => obs.disconnect();
        }
    }, []);

    // Calculate rowHeight so GRID_ROWS rows fit the container height
    // (containerHeight - (GRID_ROWS - 1) * marginY) / GRID_ROWS
    const rowHeight = useMemo(() => {
        if (gridHeight <= 0) return 50; // fallback
        return Math.floor((gridHeight - (GRID_ROWS - 1) * GRID_MARGIN[1]) / GRID_ROWS);
    }, [gridHeight]);

    const visibleLayouts = useMemo(() => {
        return layouts
            .filter((l) => !hiddenWidgets.includes(l.i))
            .map((l) => ({
                ...l,
                static: !isEditing,
            }));
    }, [layouts, hiddenWidgets, isEditing]);

    const hiddenCount = hiddenWidgets.length;

    return (
        <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-auto" ref={containerRef}>
            {/* Toolbar */}
            <div className="flex items-center gap-2 mb-1 shrink-0">
                <Button
                    variant={isEditing ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => setIsEditing(!isEditing)}
                >
                    <Pencil className="h-3 w-3" />
                    {isEditing ? 'Done' : 'Edit Layout'}
                </Button>

                {isEditing && (
                    <>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                                    {hiddenCount > 0 ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                    Widgets
                                    {hiddenCount > 0 && (
                                        <span className="ml-0.5 rounded-full bg-muted px-1.5 text-[10px] font-medium">
                                            {WIDGET_REGISTRY.length - hiddenCount}/{WIDGET_REGISTRY.length}
                                        </span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[240px] p-2" align="start">
                                <p className="text-xs font-medium text-muted-foreground mb-2 px-1">Toggle widget visibility</p>
                                <div className="space-y-1">
                                    {WIDGET_REGISTRY.map((w) => {
                                        const isHidden = hiddenWidgets.includes(w.id);
                                        return (
                                            <button
                                                key={w.id}
                                                type="button"
                                                onClick={() => toggleWidget(w.id)}
                                                className={cn(
                                                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-accent',
                                                    isHidden && 'opacity-50',
                                                )}
                                            >
                                                <Switch checked={!isHidden} className="scale-75" />
                                                <span className={cn('truncate', isHidden && 'line-through')}>{w.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </PopoverContent>
                        </Popover>

                        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={resetLayout}>
                            <RotateCcw className="h-3 w-3" />
                            Reset
                        </Button>
                    </>
                )}
            </div>

            {/* Grid */}
            {mounted && (
                <div
                    ref={gridRef}
                    className={cn('flex-1 min-h-0 relative', isEditing ? 'overflow-auto' : 'overflow-hidden')}
                >
                    {/* AWS-style pill slot placeholders */}
                    {isEditing && (
                        <div
                            className="absolute inset-0 pointer-events-none z-0"
                            style={{
                                display: 'grid',
                                gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
                                gridTemplateRows: `repeat(${GRID_ROWS}, ${rowHeight}px)`,
                                gap: `${GRID_MARGIN[1]}px ${GRID_MARGIN[0]}px`,
                            }}
                        >
                            {Array.from({ length: GRID_COLS * GRID_ROWS }, (_, i) => (
                                <div key={i} className="rounded-lg border-2 border-dashed border-muted-foreground/15 bg-muted/30" />
                            ))}
                        </div>
                    )}
                    <GridLayout
                        width={width}
                        layout={visibleLayouts as RGLLayoutItem[]}
                        autoSize={isEditing}
                        compactor={noCompactor}
                        gridConfig={{
                            cols: GRID_COLS,
                            rowHeight,
                            margin: GRID_MARGIN,
                            containerPadding: [0, 0],
                            ...(isEditing ? {} : { maxRows: GRID_ROWS }),
                        }}
                        dragConfig={{
                            enabled: isEditing,
                            handle: '.drag-handle',
                        }}
                        resizeConfig={{
                            enabled: isEditing,
                        }}
                        onLayoutChange={(layout) => {
                            if (isEditing) onLayoutChange(layout as unknown as LayoutItem[]);
                        }}
                    >
                        {visibleLayouts.map((item) => (
                            <div
                                key={item.i}
                                className={cn(
                                    'group relative',
                                    isEditing && 'ring-2 ring-primary/20 rounded-lg',
                                )}
                            >
                                <div className="w-full h-full overflow-hidden">
                                    {renderWidget(item.i, props, isEditing)}
                                </div>
                            </div>
                        ))}
                    </GridLayout>
                </div>
            )}
        </div>
    );
}
