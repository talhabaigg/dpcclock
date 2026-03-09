import { GridLayout, useContainerWidth, noCompactor, type LayoutItem as RGLLayoutItem } from 'react-grid-layout';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import MarginHealthCard from './margin-health-card';
import ThisMonthCard from './this-month-card';
import OtherItemsCard from './other-items-card';
import ProjectIncomeCard from './project-income-card';
import VariationsCard from './variations-card';
import LabourBudgetCard from './labour-budget-card';
import POCommitmentsCard from './po-commitments-card';
import SCCommitmentsCard from './sc-commitments-card';
import EmployeesOnSiteCard from './employees-on-site-card';
import BudgetSafetyCard from './budget-safety-card';
import ClaimVsProductionCard from './claim-vs-production-card';
import BudgetWeatherCard from './budget-weather-card';
import IndustrialActionCard from './industrial-action-card';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

interface ProjectIncomeData {
    originalContractSum: { income: number; cost: number; profit: number; profitPercent: number };
    currentContractSum: { income: number; cost: number; profit: number; profitPercent: number };
    thisMonth: { income: number; cost: number; profit: number; profitPercent: number };
    previousMonth: { income: number; cost: number; profit: number; profitPercent: number };
    projectToDate: { income: number; cost: number; profit: number; profitPercent: number };
    remainingBalance: { income: number; cost: number; profit: number; profitPercent: number };
}

interface VariationRow {
    type: string;
    qty: number;
    value: number;
    percent_of_total: number;
    aging_over_30: number | null;
    aging_over_30_value: number | null;
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
    dpcPercentComplete: number | null;
}

function renderWidget(id: string, props: DashboardGridProps, isEditing: boolean) {
    const ds = props.dashboardSettings as Record<string, string> | null;
    switch (id) {
        case 'project-details':
            return <ProjectDetailsCard timelineData={props.timelineData} isEditing={isEditing} />;
        case 'variations':
            return <VariationsCard data={props.variationsSummary} locationId={props.location?.id} originalContractIncome={props.projectIncomeData?.originalContractSum?.income} isEditing={isEditing} />;
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
        case 'margin-health':
            return <MarginHealthCard location={props.location} isEditing={isEditing} />;
        case 'this-month':
            return <ThisMonthCard thisMonth={props.projectIncomeData.thisMonth} previousMonth={props.projectIncomeData.previousMonth} isEditing={isEditing} />;
        case 'other-items':
            return <OtherItemsCard location={props.location} claimedToDate={props.claimedToDate} cashRetention={props.cashRetention} isEditing={isEditing} />;
        case 'po-commitments':
            return <POCommitmentsCard value={props.vendorCommitmentsSummary?.po_outstanding ?? null} isEditing={isEditing} />;
        case 'sc-commitments':
            return <SCCommitmentsCard data={props.vendorCommitmentsSummary ? { sc_outstanding: props.vendorCommitmentsSummary.sc_outstanding, sc_summary: props.vendorCommitmentsSummary.sc_summary } : null} isEditing={isEditing} />;
        case 'employees-on-site':
            return <EmployeesOnSiteCard data={props.employeesOnSite} isEditing={isEditing} />;
        case 'claim-vs-production': {
            const currentIncome = props.projectIncomeData.currentContractSum.income;
            const ptdIncome = props.projectIncomeData.projectToDate.income;
            const claimedPct = currentIncome > 0 ? (ptdIncome / currentIncome) * 100 : 0;
            return (
                <ClaimVsProductionCard
                    claimedPercent={claimedPct}
                    dpcPercentComplete={props.dpcPercentComplete}
                    currentContractIncome={currentIncome}
                    actualClaimedAmount={ptdIncome}
                    isEditing={isEditing}
                />
            );
        }
        case 'project-income':
            return <ProjectIncomeCard data={props.projectIncomeData} isEditing={isEditing} />;
        case 'labour-budget':
            return <LabourBudgetCard data={props.labourBudgetData} isEditing={isEditing} />;
        default:
            return <div className="flex items-center justify-center h-full text-muted-foreground text-xs">Unknown widget</div>;
    }
}

interface DragStartState {
    id: string;
    startX: number;
    startY: number;
    startClientX: number;
    startClientY: number;
    positions: Map<string, { x: number; y: number }>;
    /** Companion DOM elements + their original CSS transform */
    companions: Map<string, { el: HTMLElement; origTransform: string }>;
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
    const rowHeight = useMemo(() => {
        if (gridHeight <= 0) return 50;
        return Math.floor((gridHeight - (GRID_ROWS - 1) * GRID_MARGIN[1]) / GRID_ROWS);
    }, [gridHeight]);

    // ── Multi-select state ──
    const [selectedWidgets, setSelectedWidgets] = useState<Set<string>>(new Set());
    const dragStartRef = useRef<DragStartState | null>(null);
    const wasDraggingRef = useRef(false);

    // Clear selection when leaving edit mode
    useEffect(() => {
        if (!isEditing) setSelectedWidgets(new Set());
    }, [isEditing]);

    // Escape key to deselect all
    useEffect(() => {
        if (!isEditing) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setSelectedWidgets(new Set());
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isEditing]);

    // Widget mousedown: Ctrl/Cmd+click toggles, plain click selects
    const handleWidgetMouseDown = useCallback(
        (e: React.MouseEvent, widgetId: string) => {
            if (!isEditing) return;
            if ((e.target as HTMLElement).closest('.react-resizable-handle')) return;

            wasDraggingRef.current = false;

            if (e.ctrlKey || e.metaKey) {
                setSelectedWidgets((prev) => {
                    const next = new Set(prev);
                    if (next.has(widgetId)) next.delete(widgetId);
                    else next.add(widgetId);
                    return next;
                });
                return;
            }

            // If widget is not yet selected, single-select it
            if (!selectedWidgets.has(widgetId)) {
                setSelectedWidgets(new Set([widgetId]));
            }
            // If already selected: keep current selection (allows multi-drag)
        },
        [isEditing, selectedWidgets],
    );

    // Widget click: after a non-drag click on a selected widget in a group, reduce to single-select
    const handleWidgetClick = useCallback(
        (e: React.MouseEvent, widgetId: string) => {
            if (!isEditing || wasDraggingRef.current) return;
            if (e.ctrlKey || e.metaKey) return;

            if (selectedWidgets.size > 1 && selectedWidgets.has(widgetId)) {
                setSelectedWidgets(new Set([widgetId]));
            }
        },
        [isEditing, selectedWidgets],
    );

    // Click on grid background to deselect
    const handleBackgroundClick = useCallback(
        (e: React.MouseEvent) => {
            if (!isEditing) return;
            const target = e.target as HTMLElement;
            if (target.classList.contains('react-grid-layout') || target === e.currentTarget) {
                setSelectedWidgets(new Set());
            }
        },
        [isEditing],
    );

    // ── Drag handlers for multi-select ──
    // RGL ignores layout-prop changes while a drag is active (`if (activeDrag) return;`),
    // so we move companion widgets by directly manipulating their DOM transforms and
    // commit the final grid positions on drag stop.

    const handleDragStart = useCallback(
         
        (_layout: any[], _oldItem: any, newItem: any, _ph: any, event: any) => {
            wasDraggingRef.current = true;

            if (!newItem || selectedWidgets.size < 2 || !selectedWidgets.has(newItem.i)) {
                dragStartRef.current = null;
                return;
            }

            const mouseEvent = event as MouseEvent;

            // Save original grid positions
            const positions = new Map<string, { x: number; y: number }>();
            for (const item of layouts) {
                if (selectedWidgets.has(item.i)) {
                    positions.set(item.i, { x: item.x, y: item.y });
                }
            }

            // Grab companion DOM elements (RGL adds .react-grid-item to our outer div via cloneElement)
            const companions = new Map<string, { el: HTMLElement; origTransform: string }>();
            for (const [id] of positions) {
                if (id === newItem.i) continue;
                const el = document.querySelector(`[data-widget-id="${id}"]`) as HTMLElement | null;
                if (el) {
                    companions.set(id, { el, origTransform: el.style.transform });
                }
            }

            dragStartRef.current = {
                id: newItem.i,
                startX: newItem.x,
                startY: newItem.y,
                startClientX: mouseEvent.clientX,
                startClientY: mouseEvent.clientY,
                positions,
                companions,
            };
        },
        [selectedWidgets, layouts],
    );

    // Smooth pixel-level companion movement via direct DOM transform
    const handleDrag = useCallback(
         
        (_layout: any[], _oldItem: any, _newItem: any, _ph: any, event: any) => {
            if (!dragStartRef.current) return;

            const mouseEvent = event as MouseEvent;
            const dx = mouseEvent.clientX - dragStartRef.current.startClientX;
            const dy = mouseEvent.clientY - dragStartRef.current.startClientY;

            dragStartRef.current.companions.forEach(({ el, origTransform }) => {
                el.style.transform = `${origTransform} translate(${dx}px, ${dy}px)`;
                el.style.zIndex = '3';
            });
        },
        [],
    );

    // Finalize companion positions on drag stop and persist
    const handleDragStop = useCallback(
         
        (layout: any[], _oldItem: any, newItem: any) => {
            if (!dragStartRef.current || !newItem) {
                dragStartRef.current = null;
                return;
            }

            // Reset companion DOM transforms — RGL will reposition from the new layout
            dragStartRef.current.companions.forEach(({ el, origTransform }) => {
                el.style.transform = origTransform;
                el.style.zIndex = '';
            });

            // Compute grid-level delta and apply to companion layout items
            const deltaX = newItem.x - dragStartRef.current.startX;
            const deltaY = newItem.y - dragStartRef.current.startY;

            const finalLayout = (layout as LayoutItem[]).map((item) => {
                if (item.i === newItem.i || !selectedWidgets.has(item.i)) return item;

                const origPos = dragStartRef.current!.positions.get(item.i);
                if (!origPos) return item;

                return {
                    ...item,
                    x: Math.max(0, Math.min(GRID_COLS - item.w, origPos.x + deltaX)),
                    y: Math.max(0, origPos.y + deltaY),
                };
            });

            dragStartRef.current = null;
            onLayoutChange(finalLayout);
        },
        [selectedWidgets, onLayoutChange],
    );

    const visibleLayouts = useMemo(() => {
        return layouts
            .filter((l) => !hiddenWidgets.includes(l.i))
            .map((l) => ({
                ...l,
                static: !isEditing,
            }));
    }, [layouts, hiddenWidgets, isEditing]);

    const hiddenCount = hiddenWidgets.length;
    const selectedCount = selectedWidgets.size;

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

                        {selectedCount > 1 && (
                            <span className="text-[10px] text-muted-foreground ml-1">
                                {selectedCount} selected — drag to move together
                            </span>
                        )}
                    </>
                )}
            </div>

            {/* Grid */}
            {mounted && (
                <div
                    ref={gridRef}
                    className={cn('flex-1 min-h-0 relative', isEditing ? 'overflow-auto' : 'overflow-hidden')}
                    onClick={handleBackgroundClick}
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
                        onDragStart={handleDragStart}
                        onDrag={handleDrag}
                        onDragStop={handleDragStop}
                        onLayoutChange={(layout) => {
                            // Suppress during multi-select drag to avoid overwriting companion positions
                            if (isEditing && !dragStartRef.current) {
                                onLayoutChange(layout as unknown as LayoutItem[]);
                            }
                        }}
                    >
                        {visibleLayouts.map((item) => (
                            <div
                                key={item.i}
                                data-widget-id={item.i}
                                className={cn(
                                    'group relative',
                                    isEditing && 'rounded-lg',
                                    isEditing && selectedWidgets.has(item.i)
                                        ? 'ring-2 ring-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.3)]'
                                        : isEditing && 'ring-2 ring-primary/20',
                                )}
                            >
                                {/* Inner div keeps our handlers — outer div's onMouseDown gets overridden by react-draggable */}
                                <div
                                    className="w-full h-full overflow-hidden"
                                    onMouseDown={(e) => handleWidgetMouseDown(e, item.i)}
                                    onClick={(e) => handleWidgetClick(e, item.i)}
                                >
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
