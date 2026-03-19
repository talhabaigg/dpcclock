import { GridLayout, useContainerWidth, noCompactor, type LayoutItem as RGLLayoutItem } from 'react-grid-layout';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { GRID_COLS, GRID_ROWS, GRID_MARGIN, type LayoutItem } from './widget-registry';
import type { ProductionCostCode } from './budget-safety-card';
import type { LabourBudgetRow } from './labour-budget-card';
import type { Location, JobSummary } from '@/types';

import ProjectDetailsCard from './project-details-card';
import MarginHealthCard from './margin-health-card';
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
import OncostRatioCard from './oncost-ratio-card';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

/**
 * Mobile min-heights per widget type.
 * Chart/table widgets need more space; KPI cards are compact.
 * 'sm' widgets can be paired side-by-side in portrait.
 */
const MOBILE_WIDGET_CONFIG: Record<string, { minH: number; size: 'sm' | 'md' | 'lg' }> = {
    'project-details':      { minH: 180, size: 'md' },
    'variations':           { minH: 220, size: 'md' },
    'budget-safety':        { minH: 240, size: 'md' },
    'industrial-action':    { minH: 120, size: 'sm' },
    'budget-weather':       { minH: 240, size: 'md' },
    'margin-health':        { minH: 120, size: 'sm' },
    'po-commitments':       { minH: 140, size: 'sm' },
    'sc-commitments':       { minH: 140, size: 'sm' },
    'employees-on-site':    { minH: 280, size: 'lg' },
    'claim-vs-production':  { minH: 150, size: 'sm' },
    'oncost-ratio':         { minH: 150, size: 'sm' },
    'project-income':       { minH: 220, size: 'md' },
    'labour-budget':        { minH: 300, size: 'lg' },
};

/** Widgets forced to the bottom of mobile layout, in this order. */
const MOBILE_BOTTOM_WIDGETS = ['employees-on-site'];

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
    asOfDate?: string;
    isEditing: boolean;
    layouts: LayoutItem[];
    hiddenWidgets: string[];
    onLayoutChange: (newLayout: LayoutItem[]) => void;
    selectedWidgets: Set<string>;
    setSelectedWidgets: React.Dispatch<React.SetStateAction<Set<string>>>;
    isFixedLayout: boolean;
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
            return <ProjectIncomeCard data={props.projectIncomeData} isEditing={isEditing} asOfDate={props.asOfDate} poCommitments={props.vendorCommitmentsSummary?.po_outstanding ?? 0} />;
        case 'labour-budget':
            return <LabourBudgetCard data={props.labourBudgetData} isEditing={isEditing} />;
        case 'oncost-ratio':
            return <OncostRatioCard data={props.labourBudgetData} isEditing={isEditing} />;
        default:
            return null;
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
    const { isEditing, layouts, hiddenWidgets, onLayoutChange, selectedWidgets, setSelectedWidgets, isFixedLayout } = props;

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
    const dragStartRef = useRef<DragStartState | null>(null);
    const wasDraggingRef = useRef(false);

    // Clear selection when leaving edit mode
    useEffect(() => {
        if (!isEditing) setSelectedWidgets(new Set());
    }, [isEditing, setSelectedWidgets]);

    // Escape key to deselect all
    useEffect(() => {
        if (!isEditing) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setSelectedWidgets(new Set());
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isEditing, setSelectedWidgets]);

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

    // ── Mobile / fixed layout ──
    // Detect landscape orientation for 2-column layout
    const [isLandscape, setIsLandscape] = useState(() => window.innerWidth > window.innerHeight);
    useEffect(() => {
        if (!isFixedLayout) return;
        const mql = window.matchMedia('(orientation: landscape)');
        const handler = (e: MediaQueryListEvent) => setIsLandscape(e.matches);
        setIsLandscape(mql.matches);
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, [isFixedLayout]);

    // Build mobile layout: group small widgets into pairs for side-by-side display
    const mobileItems = useMemo(() => {
        if (!isFixedLayout) return [];

        const sorted = [...visibleLayouts].sort((a, b) => {
            const aBottom = MOBILE_BOTTOM_WIDGETS.indexOf(a.i);
            const bBottom = MOBILE_BOTTOM_WIDGETS.indexOf(b.i);
            // Force bottom widgets to the end, preserving their relative order
            if (aBottom !== -1 && bBottom !== -1) return aBottom - bBottom;
            if (aBottom !== -1) return 1;
            if (bBottom !== -1) return -1;
            if (a.y !== b.y) return a.y - b.y;
            return a.x - b.x;
        });

        // In landscape, all widgets go into a 2-column CSS grid — no pairing needed
        if (isLandscape) return sorted;

        // In portrait, pair consecutive 'sm' widgets side-by-side
        const result: Array<{ type: 'single'; item: typeof sorted[0] } | { type: 'pair'; items: [typeof sorted[0], typeof sorted[0]] }> = [];
        let i = 0;
        while (i < sorted.length) {
            const cfg = MOBILE_WIDGET_CONFIG[sorted[i].i];
            const nextCfg = i + 1 < sorted.length ? MOBILE_WIDGET_CONFIG[sorted[i + 1].i] : undefined;

            if (cfg?.size === 'sm' && nextCfg?.size === 'sm') {
                result.push({ type: 'pair', items: [sorted[i], sorted[i + 1]] });
                i += 2;
            } else {
                result.push({ type: 'single', item: sorted[i] });
                i++;
            }
        }
        return result;
    }, [isFixedLayout, visibleLayouts, isLandscape]);

    if (isFixedLayout) {
        const getMinH = (id: string) => MOBILE_WIDGET_CONFIG[id]?.minH ?? 160;

        // Landscape: explicit row definitions — no dynamic merge logic
        if (isLandscape) {
            // Each row: widget IDs, optional column spans, min height
            const LANDSCAPE_ROWS: { ids: string[]; spans?: number[]; minH: number }[] = [
                { ids: ['project-details', 'variations'], spans: [1, 2], minH: 280 },
                { ids: ['budget-safety', 'budget-weather', 'industrial-action'], minH: 200 },
                { ids: ['margin-health', 'po-commitments', 'sc-commitments'], minH: 160 },
                { ids: ['claim-vs-production', 'oncost-ratio', 'project-income'], spans: [1, 1, 2], minH: 200 },
                { ids: ['labour-budget'], minH: 260 },
                { ids: ['employees-on-site'], minH: 240 },
            ];

            const allRowIds = new Set(LANDSCAPE_ROWS.flatMap((r) => r.ids));
            const sorted = mobileItems as typeof visibleLayouts;

            // Resolve each row: only include visible widgets
            const resolvedRows = LANDSCAPE_ROWS.map((row) => {
                const items = row.ids
                    .map((id) => sorted.find((item) => item.i === id))
                    .filter(Boolean) as typeof visibleLayouts;
                const spans = row.spans
                    ? row.ids.map((id, i) => ({ id, span: row.spans![i] ?? 1 })).filter(({ id }) => items.some((item) => item.i === id)).map(({ span }) => span)
                    : undefined;
                return { ...row, items, spans };
            }).filter((r) => r.items.length > 0);

            // Any widgets not in a defined row go at the end in a 2-col grid
            const remainingItems = sorted.filter((item) => !allRowIds.has(item.i));

            return (
                <div className="flex flex-col gap-2 overflow-auto pb-4 px-1" ref={containerRef}>
                    {resolvedRows.map((row, idx) => {
                        const totalCols = row.spans
                            ? row.spans.reduce((a, b) => a + b, 0)
                            : row.items.length;
                        return (
                            <div
                                key={`row-${idx}`}
                                className="grid gap-2 shrink-0"
                                style={{ minHeight: row.minH, gridTemplateColumns: totalCols === 1 ? '1fr' : `repeat(${totalCols}, minmax(0, 1fr))`, gridTemplateRows: '1fr' }}
                            >
                                {row.items.map((item, i) => {
                                    const span = row.spans?.[i] ?? 1;
                                    return (
                                        <div key={item.i} className="w-full h-full" style={span > 1 ? { gridColumn: `span ${span}` } : undefined}>
                                            {renderWidget(item.i, props, false)}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                    {remainingItems.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 shrink-0">
                            {remainingItems.map((item) => {
                                const cfg = MOBILE_WIDGET_CONFIG[item.i];
                                const h = cfg ? Math.round(cfg.minH * 0.85) : 140;
                                return (
                                    <div key={item.i} className="w-full" style={{ minHeight: h }}>
                                        {renderWidget(item.i, props, false)}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            );
        }

        // Portrait: explicit row definitions
        const PORTRAIT_ROWS: { ids: string[]; minH: number }[] = [
            { ids: ['project-details'], minH: 180 },
            { ids: ['variations'], minH: 280 },
            { ids: ['budget-safety', 'budget-weather'], minH: 240 },
            { ids: ['industrial-action', 'margin-health'], minH: 120 },
            { ids: ['po-commitments', 'sc-commitments'], minH: 140 },
            { ids: ['claim-vs-production', 'oncost-ratio'], minH: 150 },
            { ids: ['project-income'], minH: 220 },
            { ids: ['labour-budget'], minH: 300 },
            { ids: ['employees-on-site'], minH: 280 },
        ];

        const allPortraitRowIds = new Set(PORTRAIT_ROWS.flatMap((r) => r.ids));

        const portraitResolvedRows = PORTRAIT_ROWS.map((row) => {
            const items = row.ids
                .map((id) => visibleLayouts.find((item) => item.i === id))
                .filter(Boolean) as typeof visibleLayouts;
            return { ...row, items };
        }).filter((r) => r.items.length > 0);

        const portraitRemainingItems = visibleLayouts.filter((item) => !allPortraitRowIds.has(item.i));

        return (
            <div className="flex flex-col gap-2 overflow-auto pb-4 px-1" ref={containerRef}>
                {portraitResolvedRows.map((row, idx) => (
                    <div
                        key={`row-${idx}`}
                        className="grid gap-2 shrink-0"
                        style={{ minHeight: row.minH, gridTemplateColumns: `repeat(${row.items.length}, minmax(0, 1fr))`, gridTemplateRows: '1fr' }}
                    >
                        {row.items.map((item) => (
                            <div key={item.i} className="w-full h-full">
                                {renderWidget(item.i, props, false)}
                            </div>
                        ))}
                    </div>
                ))}
                {portraitRemainingItems.map((item) => (
                    <div key={item.i} className="w-full shrink-0" style={{ minHeight: getMinH(item.i) }}>
                        {renderWidget(item.i, props, false)}
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-auto" ref={containerRef}>
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
