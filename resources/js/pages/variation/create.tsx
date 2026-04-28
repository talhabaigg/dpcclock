import { ConditionManager } from '@/components/condition-manager';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import AppLayout from '@/layouts/app-layout';
import { cn, fmtCurrency } from '@/lib/utils';
import { BreadcrumbItem } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { api, ApiError } from '@/lib/api';
import { format } from 'date-fns';
import {
    AlertCircle,
    ArrowLeft,
    CalendarDays,
    Check,
    ChevronsUpDown,
    ClipboardList,
    DollarSign,
    GripHorizontal,
    Package,
    Plus,
    Save,
    Send,
    Trash2,
    TrendingUp,
    Wrench,
    Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CostCode } from '../purchasing/types';
import ClientVariationTab from './partials/ClientVariationTab';
import { Condition } from './partials/ConditionPricingPanel';
import PremierVariationTab from './partials/PremierVariationTab';
import VariationLineGrid, { VariationLineGridRef } from './partials/variationLineTable/VariationLineGrid';
import VariationPricingTab, { PricingItem } from './partials/VariationPricingTab';

interface Location {
    id: number;
    name: string;
    cost_codes: CostCode[];
    variation_next_number: number | null;
}

interface VariationData {
    id: number;
    location_id: number;
    type: string;
    co_number: string;
    status: string;
    description: string;
    client_notes: string | null;
    amount: number | string;
    co_date: string;
    pricing_items?: PricingItem[];
    line_items: {
        line_number: number;
        cost_item: string;
        cost_type: string;
        description: string;
        qty: number;
        unit_cost: number;
        total_cost: number;
        revenue: number;
    }[];
}

const CostTypes = [
    { value: 'LAB', description: '1 - Labour Direct' },
    { value: 'LOC', description: '2 - Labour Oncosts' },
    { value: 'CON', description: '3 - Contractor' },
    { value: 'COC', description: '4 - Contractor Oncosts' },
    { value: 'MAT', description: '5 - Materials' },
    { value: 'SIT', description: '6 - Site Costs' },
    { value: 'GEN', description: '7 - General Costs' },
    { value: 'EQH', description: '8 - Equipment Hire' },
    { value: 'PRO', description: '9 - Provisional Fees' },
    { value: 'REV', description: 'Revenue' },
];

interface VariationCreateProps {
    locations: Location[];
    costCodes: CostCode[];
    variation?: VariationData;
    conditions?: Condition[];
    selectedLocationId?: string | number;
    changeTypes?: string[];
}

const STEPS = [
    { id: 'details', label: 'Details', icon: ClipboardList, description: 'Variation info' },
    { id: 'pricing', label: 'Pricing', icon: DollarSign, description: 'Cost breakdown' },
    { id: 'client', label: 'Client', icon: TrendingUp, description: 'Sell rates & quote' },
    { id: 'premier', label: 'Premier', icon: Send, description: 'Lines & export' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Variations', href: '/variations' },
    { title: 'Create', href: '/variations/create' },
];

const VariationCreate = ({ locations, costCodes, variation, conditions = [], selectedLocationId, changeTypes = [] }: VariationCreateProps) => {
    const gridRef = useRef<VariationLineGridRef>(null);
    const { data, setData, post, errors } = useForm({
        location_id: variation ? String(variation.location_id) : selectedLocationId ? String(selectedLocationId) : '',
        type: variation?.type ?? 'YET2SUBMIT',
        co_number: variation?.co_number ?? '',
        description: variation?.description ?? '',
        client_notes: variation?.client_notes ?? '',
        amount: variation?.amount ?? '',
        date: variation?.co_date ?? new Date().toISOString().split('T')[0],
        line_items: variation
            ? variation.line_items.map((item) => ({
                  line_number: item.line_number,
                  cost_item: item.cost_item,
                  cost_type: item.cost_type,
                  description: item.description,
                  qty: item.qty,
                  unit_cost: item.unit_cost,
                  total_cost: item.total_cost,
                  revenue: item.revenue,
              }))
            : [
                  {
                      line_number: 1,
                      cost_item: '',
                      cost_type: '',
                      description: '',
                      qty: 1,
                      unit_cost: 0,
                      total_cost: 0,
                      revenue: 0,
                  },
              ],
    });

    // --- Core state ---
    const [activeSection, setActiveSection] = useState<StepId>('details');
    const [savedVariationId, setSavedVariationId] = useState<number | undefined>(variation?.id);
    const [localConditions, setLocalConditions] = useState<Condition[]>(conditions);
    const [showConditionManager, setShowConditionManager] = useState(false);
    const [locationOpen, setLocationOpen] = useState(false);
    const [pricingItems, setPricingItems] = useState<PricingItem[]>(variation?.pricing_items ?? []);
    const [saving, setSaving] = useState(false);
    const [selectedCount, setSelectedCount] = useState(0);

    // --- Quick Gen state ---
    const [quickGenOpen, setQuickGenOpen] = useState(false);
    const [genAmount, setGenAmount] = useState('');

    // --- Grid resize state ---
    const [gridHeight, setGridHeight] = useState(() => localStorage.getItem('variationGridSize') || '500px');
    const [isResizing, setIsResizing] = useState(false);
    const resizeRef = useRef<HTMLDivElement>(null);

    // --- Section refs for scroll tracking ---
    const sectionRefs = useRef<Record<StepId, HTMLElement | null>>({
        details: null,
        pricing: null,
        client: null,
        premier: null,
    });
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const isUserScrolling = useRef(true);

    // --- Sidebar mobile state ---
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // --- Lock parent scroll so only inner content scrolls ---
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    // --- Derived ---
    const selectedLocation = locations.find((loc) => String(loc.id) === data.location_id);
    const costData = selectedLocation?.cost_codes ?? [];
    const sortedLocations = useMemo(() => [...locations].sort((a, b) => a.name.localeCompare(b.name)), [locations]);
    const hasAutoNumbering = selectedLocation?.variation_next_number != null && variation?.status !== 'sent';
    const detailsComplete = !!(data.location_id && (hasAutoNumbering || data.co_number.trim()) && data.description.trim());

    const gridTotals = useMemo(() => {
        const totalCost = data.line_items.reduce((sum: number, i: any) => sum + (Number(i.total_cost) || 0), 0);
        const totalRevenue = data.line_items.reduce((sum: number, i: any) => sum + (Number(i.revenue) || 0), 0);
        return { totalCost, totalRevenue };
    }, [data.line_items]);

    const pricingTotals = useMemo(() => {
        const labour = pricingItems.reduce((sum, i) => sum + (i.labour_cost || 0), 0);
        const material = pricingItems.reduce((sum, i) => sum + (i.material_cost || 0), 0);
        const total = pricingItems.reduce((sum, i) => sum + (i.total_cost || 0), 0);
        return { labour, material, total };
    }, [pricingItems]);

    const clientTotals = useMemo(() => {
        const totalSell = pricingItems.reduce((sum, i) => sum + (i.qty * (i.sell_rate || 0)), 0);
        const margin = totalSell - pricingTotals.total;
        const marginPct = totalSell > 0 ? (margin / totalSell) * 100 : 0;
        return { totalSell, margin, marginPct };
    }, [pricingItems, pricingTotals.total]);

    // --- Step completion status ---
    const stepStatus = useMemo(() => ({
        details: detailsComplete,
        pricing: pricingItems.length > 0,
        client: pricingItems.some((i) => i.sell_rate && i.sell_rate > 0),
        premier: data.line_items.length > 0 && data.line_items.some((i: any) => i.cost_item),
    }), [detailsComplete, pricingItems, data.line_items]);

    // --- IntersectionObserver for scroll-based active section ---
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (!isUserScrolling.current) return;
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        const id = entry.target.getAttribute('data-section') as StepId;
                        if (id) setActiveSection(id);
                    }
                }
            },
            {
                root: container,
                rootMargin: '-20% 0px -70% 0px',
                threshold: 0,
            },
        );

        for (const ref of Object.values(sectionRefs.current)) {
            if (ref) observer.observe(ref);
        }

        return () => observer.disconnect();
    }, []);

    // --- Scroll to section ---
    const scrollToSection = (id: StepId) => {
        const el = sectionRefs.current[id];
        const container = scrollContainerRef.current;
        if (!el || !container) return;
        isUserScrolling.current = false;
        setActiveSection(id);
        setSidebarOpen(false);
        const offsetTop = el.offsetTop - container.offsetTop;
        container.scrollTo({ top: offsetTop, behavior: 'smooth' });
        setTimeout(() => {
            isUserScrolling.current = true;
        }, 600);
    };

    // --- Persist unsaved pricing items ---
    const persistUnsavedPricingItems = async (varId: number) => {
        const unsaved = pricingItems.filter((item) => !item.id);
        if (unsaved.length === 0) return;

        const persisted: PricingItem[] = pricingItems.filter((item) => !!item.id);
        let failCount = 0;
        for (const item of unsaved) {
            try {
                const payload: Record<string, any> = {
                    description: item.description,
                    qty: item.qty,
                    unit: item.unit,
                    labour_cost: item.labour_cost,
                    material_cost: item.material_cost,
                };
                if (item.takeoff_condition_id) {
                    payload.takeoff_condition_id = item.takeoff_condition_id;
                }
                if (item.sell_rate != null && item.sell_rate > 0) {
                    payload.sell_rate = item.sell_rate;
                }
                const resp = await api.post<{ pricing_item: any }>(`/variations/${varId}/pricing-items`, payload);
                persisted.push(resp.pricing_item);
            } catch {
                failCount++;
            }
        }
        if (failCount > 0) {
            toast.error(`${failCount} pricing item(s) failed to save`);
        }
        setPricingItems(persisted);
    };

    // --- Grid resize ---
    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!resizeRef.current) return;
            const rect = resizeRef.current.getBoundingClientRect();
            const newHeight = Math.max(200, Math.min(2000, e.clientY - rect.top));
            const heightStr = `${newHeight}px`;
            setGridHeight(heightStr);
            localStorage.setItem('variationGridSize', heightStr);
        };

        const handleMouseUp = () => setIsResizing(false);

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    // --- Grid actions ---
    const addRow = () => gridRef.current?.addRow();
    const deleteSelectedRows = () => {
        gridRef.current?.deleteSelectedRows();
        setSelectedCount(0);
    };
    const handleLineItemsChange = (lineItems: any[]) => setData('line_items', lineItems);
    const handleSelectionChange = (count: number) => setSelectedCount(count);

    // --- Submit ---
    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setSaving(true);

        try {
            let varId = savedVariationId;

            const hasUnsaved = pricingItems.some((item) => !item.id);
            if (!varId && hasUnsaved) {
                if (!data.location_id || !data.co_number || !data.description) {
                    toast.error('Please fill in Location, Variation Number, and Description to save');
                    setSaving(false);
                    return;
                }
                try {
                    const response = await api.post<{ variation: { id: number } }>('/variations/quick-store', {
                        location_id: parseInt(data.location_id),
                        co_number: data.co_number,
                        description: data.description,
                        type: data.type || 'extra',
                    });
                    varId = response.variation.id;
                    setSavedVariationId(varId);
                    window.history.replaceState({}, '', `/variations/${varId}/edit`);
                } catch (err: unknown) {
                    toast.error(err instanceof ApiError ? err.message : 'Failed to save variation');
                    setSaving(false);
                    return;
                }
            }

            if (varId && hasUnsaved) {
                await persistUnsavedPricingItems(varId);
            }

            if (varId) {
                post(`/variations/${varId}/update`, {
                    onFinish: () => setSaving(false),
                });
            } else {
                post('/variations/store', {
                    onFinish: () => setSaving(false),
                });
            }
        } catch {
            setSaving(false);
        }
    };

    // --- Quick Gen ---
    const generatePrelimLines = (type: 'LAB' | 'MAT') => {
        if (!genAmount || !data.location_id) {
            toast.error('Please select a location and enter an amount.');
            return;
        }
        setQuickGenOpen(false);

        const onCostData = costData.map((code) => {
            const percentRaw = code.pivot?.variation_ratio;
            const prelimTypeRaw = code.pivot?.prelim_type ?? '';
            const prelimType = String(prelimTypeRaw).trim().toUpperCase();
            const costType = costCodes.find((costCode) => costCode.code === code.code)?.cost_type?.code || '';
            return {
                cost_item: code.code,
                cost_type: costType,
                percent: (percentRaw ?? 0) / 100 || 0,
                prelim_type: prelimType,
                description: code.description,
            };
        });

        const filtered = onCostData.filter((item) => item.prelim_type.startsWith(type));
        const baseAmount = parseFloat(genAmount);

        const newLines = filtered.map((item, index) => {
            const lineAmount = +(baseAmount * item.percent).toFixed(2);
            return {
                line_number: data.line_items.length + index + 1,
                cost_item: item.cost_item,
                cost_type: item.cost_type,
                description: item.description,
                qty: 1,
                unit_cost: lineAmount,
                total_cost: lineAmount,
                revenue: 0,
            };
        });

        setData('line_items', [...data.line_items, ...newLines]);
        setGenAmount('');
        toast.success(`Generated ${newLines.length} ${type === 'LAB' ? 'labour' : 'material'} lines`);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Create Variation" />
            <div className="flex min-w-0 overflow-hidden" style={{ height: 'calc(100dvh - 3.5rem)' }}>
                {/* ============ PERSISTENT SIDEBAR ============ */}
                {/* Mobile toggle */}
                <button
                    type="button"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg lg:hidden"
                >
                    <ClipboardList className="h-5 w-5" />
                </button>

                <aside
                    className={cn(
                        'border-r bg-muted/30 flex-shrink-0 transition-transform duration-200',
                        // Mobile: fixed overlay. Desktop: static in flex row
                        'fixed inset-y-0 left-0 z-40 w-64',
                        'lg:static lg:inset-auto lg:z-auto lg:translate-x-0',
                        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
                    )}
                >
                    {/* Mobile overlay backdrop */}
                    {sidebarOpen && (
                        <div
                            className="fixed inset-0 z-[-1] bg-black/20 lg:hidden"
                            onClick={() => setSidebarOpen(false)}
                        />
                    )}

                    <div className="flex h-full flex-col overflow-hidden">
                        {/* Sidebar header */}
                        <div className="border-b px-4 py-3">
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => window.history.back()}>
                                    <ArrowLeft className="h-4 w-4" />
                                </Button>
                                <div>
                                    <h2 className="text-sm font-semibold tracking-tight leading-tight">
                                        {savedVariationId ? 'Edit Variation' : 'New Variation'}
                                    </h2>
                                    <p className="text-muted-foreground text-xs">
                                        {savedVariationId ? 'Update details & lines' : 'Fill sections below'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Step navigation */}
                        <nav className="flex-1 overflow-y-auto px-2 py-3">
                            <ul className="space-y-1">
                                {STEPS.map((step) => {
                                    const isActive = activeSection === step.id;
                                    const isComplete = stepStatus[step.id];
                                    const Icon = step.icon;

                                    // Step-specific meta
                                    let meta: string | null = null;
                                    if (step.id === 'details' && selectedLocation) {
                                        meta = selectedLocation.name;
                                    } else if (step.id === 'pricing' && pricingItems.length > 0) {
                                        meta = `${pricingItems.length} items · ${fmtCurrency(pricingTotals.total)}`;
                                    } else if (step.id === 'client' && clientTotals.totalSell > 0) {
                                        meta = `Margin ${clientTotals.marginPct.toFixed(0)}%`;
                                    } else if (step.id === 'premier' && data.line_items.some((i: any) => i.cost_item)) {
                                        meta = `${data.line_items.length} lines`;
                                    }

                                    return (
                                        <li key={step.id}>
                                            <button
                                                type="button"
                                                onClick={() => scrollToSection(step.id)}
                                                className={cn(
                                                    'group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                                                    isActive
                                                        ? 'bg-primary/10 text-primary'
                                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                                )}
                                            >
                                                {/* Status indicator */}
                                                <span
                                                    className={cn(
                                                        'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all',
                                                        isComplete && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
                                                        isActive && !isComplete && 'bg-primary text-primary-foreground',
                                                        !isActive && !isComplete && 'border border-muted-foreground/30',
                                                    )}
                                                >
                                                    {isComplete ? (
                                                        <Check className="h-3.5 w-3.5" />
                                                    ) : (
                                                        <Icon className="h-3.5 w-3.5" />
                                                    )}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-sm font-medium leading-tight">{step.label}</div>
                                                    <div className={cn(
                                                        'mt-0.5 truncate text-xs leading-tight',
                                                        isActive ? 'text-primary/70' : 'text-muted-foreground',
                                                    )}>
                                                        {meta || step.description}
                                                    </div>
                                                </div>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </nav>

                        {/* Live summary */}
                        <div className="border-t px-4 py-3 space-y-2">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Summary
                            </div>
                            <div className="space-y-1.5 text-xs">
                                {selectedLocation && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Location</span>
                                        <span className="font-medium truncate max-w-[120px]">{selectedLocation.name}</span>
                                    </div>
                                )}
                                {data.co_number && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Var #</span>
                                        <span className="font-medium font-mono">{data.co_number}</span>
                                    </div>
                                )}
                                {data.type && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Type</span>
                                        <span className="font-medium capitalize">{data.type}</span>
                                    </div>
                                )}
                                {pricingTotals.total > 0 && (
                                    <>
                                        <Separator />
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground">Cost</span>
                                            <span className="font-semibold tabular-nums">{fmtCurrency(pricingTotals.total)}</span>
                                        </div>
                                    </>
                                )}
                                {clientTotals.totalSell > 0 && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Sell</span>
                                        <span className="font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                                            {fmtCurrency(clientTotals.totalSell)}
                                        </span>
                                    </div>
                                )}
                                {clientTotals.margin !== 0 && clientTotals.totalSell > 0 && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Margin</span>
                                        <span className={cn(
                                            'font-semibold tabular-nums',
                                            clientTotals.margin >= 0
                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                : 'text-red-600 dark:text-red-400',
                                        )}>
                                            {clientTotals.marginPct.toFixed(0)}%
                                        </span>
                                    </div>
                                )}
                                {gridTotals.totalCost > 0 && (
                                    <>
                                        <Separator />
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground">Premier Cost</span>
                                            <span className="font-semibold tabular-nums">{fmtCurrency(gridTotals.totalCost)}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground">Revenue</span>
                                            <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                                                {fmtCurrency(gridTotals.totalRevenue)}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Save button in sidebar */}
                        <div className="border-t px-4 py-3">
                            <Button onClick={handleSubmit} disabled={saving} className="w-full" size="sm">
                                <Save className="mr-1.5 h-4 w-4" />
                                {saving ? 'Saving...' : variation?.id ? 'Update Variation' : 'Save Variation'}
                            </Button>
                        </div>
                    </div>
                </aside>

                {/* ============ MAIN CONTENT ============ */}
                <div ref={scrollContainerRef} className="min-w-0 flex-1 overflow-y-auto">
                    <div className="mx-auto max-w-5xl space-y-8 p-4 sm:p-6 md:p-8">
                        {/* Error Banner */}
                        {Object.keys(errors).length > 0 && (
                            <div className="bg-destructive/5 border-destructive/20 rounded-lg border p-4">
                                <div className="mb-2 flex items-center gap-2">
                                    <AlertCircle className="text-destructive h-4 w-4" />
                                    <h3 className="text-destructive text-sm font-medium">Please fix the following errors</h3>
                                </div>
                                <ul className="space-y-1 pl-6">
                                    {Object.entries(errors).map(([key, message]) => {
                                        const formatErrorKey = (errorKey: string): string => {
                                            const itemMatch = errorKey.match(/^line_items\.(\d+)\.(\w+)$/);
                                            if (itemMatch) {
                                                const lineNum = parseInt(itemMatch[1]) + 1;
                                                const field = itemMatch[2].replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                                                return `Line ${lineNum} - ${field}`;
                                            }
                                            return errorKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                                        };

                                        return (
                                            <li key={key} className="text-destructive text-sm">
                                                <span className="font-medium">{formatErrorKey(key)}:</span> {message as string}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}

                        {/* ======== SECTION 1: DETAILS ======== */}
                        <section
                            ref={(el) => { sectionRefs.current.details = el; }}
                            data-section="details"
                            className="scroll-mt-4"
                        >
                            <div className="mb-4 flex items-center justify-between gap-4">
                                <h2 className="text-sm font-bold">Variation Details</h2>
                                <div className="flex items-center gap-3 shrink-0 text-sm">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-muted-foreground">Var #</span>
                                        {selectedLocation?.variation_next_number != null && variation?.status !== 'sent' ? (
                                            <span className="bg-muted text-muted-foreground rounded-md border px-2.5 py-1 font-mono text-sm">
                                                VA-{String(selectedLocation.variation_next_number).padStart(3, '0')}
                                            </span>
                                        ) : (
                                            <Input
                                                id="co_number"
                                                value={data.co_number}
                                                onChange={(e) => setData('co_number', e.target.value)}
                                                placeholder="VAR-001"
                                                className="h-7 w-24 text-sm"
                                            />
                                        )}
                                    </div>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 gap-1.5 text-sm font-normal"
                                            >
                                                <CalendarDays className="h-3.5 w-3.5" />
                                                {data.date
                                                    ? format(new Date(data.date + 'T00:00:00'), 'dd/MM/yyyy')
                                                    : 'Set date'}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="end">
                                            <Calendar
                                                mode="single"
                                                selected={data.date ? new Date(data.date + 'T00:00:00') : undefined}
                                                onSelect={(day) => {
                                                    if (day) {
                                                        setData('date', format(day, 'yyyy-MM-dd'));
                                                    }
                                                }}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label>Location</Label>
                                    <Popover open={locationOpen} onOpenChange={setLocationOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={locationOpen}
                                                className="w-full min-w-0 justify-between overflow-hidden font-normal"
                                                disabled={!!selectedLocationId}
                                            >
                                                <span className="min-w-0 truncate">{selectedLocation?.name || 'Search locations...'}</span>
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-(--anchor-width) p-0" align="start">
                                            <Command>
                                                <CommandInput placeholder="Search locations..." />
                                                <CommandList>
                                                    <CommandEmpty>No location found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {sortedLocations.map((loc) => (
                                                            <CommandItem
                                                                key={loc.id}
                                                                value={loc.name}
                                                                className="data-selected:bg-transparent"
                                                                onSelect={() => {
                                                                    setData('location_id', String(loc.id));
                                                                    setLocationOpen(false);
                                                                }}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        'mr-2 h-4 w-4',
                                                                        data.location_id === String(loc.id) ? 'opacity-100' : 'opacity-0',
                                                                    )}
                                                                />
                                                                {loc.name}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="description">Description</Label>
                                    <Input
                                        id="description"
                                        value={data.description}
                                        onChange={(e) => setData('description', e.target.value)}
                                        placeholder="e.g. Additional waterproofing to Level 3 balcony"
                                    />
                                </div>

                                {/* Status */}
                                <div className="space-y-1.5">
                                    <Label>Status</Label>
                                    <div className="flex items-center gap-2">
                                        <div className="inline-flex rounded-md border">
                                            {([
                                                { value: 'YET2SUBMIT', label: 'Yet to Submit' },
                                                { value: 'PENDING', label: 'Pending' },
                                                { value: 'APPROVED', label: 'Approved' },
                                            ] as const).map((opt, i) => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => setData('type', opt.value)}
                                                    className={cn(
                                                        'px-3 py-1.5 text-xs font-medium transition-colors',
                                                        i > 0 && 'border-l',
                                                        i === 0 && 'rounded-l-md',
                                                        i === 2 && 'rounded-r-md',
                                                        data.type === opt.value
                                                            ? 'bg-primary text-primary-foreground'
                                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                                    )}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                        {!['YET2SUBMIT', 'PENDING', 'APPROVED'].includes(data.type) && (
                                            <span className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                                {data.type}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>

                        <Separator />

                        {/* ======== SECTION 2: PRICING ======== */}
                        <section
                            ref={(el) => { sectionRefs.current.pricing = el; }}
                            data-section="pricing"
                            className="scroll-mt-4"
                        >
                            <h2 className="mb-4 text-sm font-bold">Variation Pricing</h2>
                            <VariationPricingTab
                                variationId={savedVariationId}
                                conditions={localConditions}
                                locationId={data.location_id}
                                pricingItems={pricingItems}
                                onPricingItemsChange={setPricingItems}
                                onManageConditions={() => setShowConditionManager(true)}
                            />
                        </section>

                        <Separator />

                        {/* ======== SECTION 3: CLIENT ======== */}
                        <section
                            ref={(el) => { sectionRefs.current.client = el; }}
                            data-section="client"
                            className="scroll-mt-4"
                        >
                            <h2 className="mb-4 text-sm font-bold">Client Variation</h2>
                            <ClientVariationTab
                                variationId={savedVariationId}
                                pricingItems={pricingItems}
                                clientNotes={data.client_notes}
                                onClientNotesChange={(notes) => setData('client_notes', notes)}
                                onPricingItemsChange={setPricingItems}
                            />
                        </section>

                        <Separator />

                        {/* ======== SECTION 4: PREMIER ======== */}
                        <section
                            ref={(el) => { sectionRefs.current.premier = el; }}
                            data-section="premier"
                            className="scroll-mt-4"
                        >
                            <h2 className="mb-4 text-sm font-bold">Premier Variation</h2>
                            <PremierVariationTab
                                variationId={savedVariationId}
                                locationId={data.location_id}
                                pricingItems={pricingItems}
                                lineItems={data.line_items}
                                onLineItemsChange={(items) => setData('line_items', items)}
                            />

                            {/* Line Items Grid */}
                            <div className="mt-6 rounded-lg border">
                                <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <h3 className="flex items-center gap-2 text-base font-semibold">
                                            <ClipboardList className="h-4 w-4" />
                                            Line Items
                                            <span className="bg-muted text-muted-foreground ml-1 rounded-md px-2 py-0.5 text-xs font-normal">
                                                {selectedCount > 0
                                                    ? `${selectedCount} selected`
                                                    : `${data.line_items.length} total`}
                                            </span>
                                        </h3>
                                        <p className="text-muted-foreground mt-0.5 hidden text-sm sm:block">Premier line items for export.</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Dialog open={quickGenOpen} onOpenChange={setQuickGenOpen}>
                                            <DialogTrigger asChild>
                                                <Button variant="outline" size="sm">
                                                    <Zap className="mr-1.5 h-3.5 w-3.5" />
                                                    <span className="hidden sm:inline">Quick Gen</span>
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="sm:max-w-md">
                                                <DialogHeader>
                                                    <DialogTitle>Quick Generate</DialogTitle>
                                                    <DialogDescription>
                                                        Generate preliminary line items from a base amount.
                                                    </DialogDescription>
                                                </DialogHeader>

                                                <div className="space-y-4 py-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="gen-amount">Base Amount</Label>
                                                        <Input
                                                            id="gen-amount"
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={genAmount}
                                                            onChange={(e) => setGenAmount(e.target.value.replace(/,/g, ''))}
                                                            placeholder="0.00"
                                                        />
                                                    </div>

                                                    <Separator />

                                                    <div className="space-y-2">
                                                        <Label>Generation Type</Label>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <Button
                                                                variant="outline"
                                                                onClick={() => generatePrelimLines('LAB')}
                                                                className="h-auto flex-col gap-1 py-4"
                                                            >
                                                                <Wrench className="h-5 w-5" />
                                                                <span className="text-sm font-medium">Labour</span>
                                                                <span className="text-muted-foreground text-xs">
                                                                    Generate labour costs
                                                                </span>
                                                            </Button>

                                                            <Button
                                                                variant="outline"
                                                                onClick={() => generatePrelimLines('MAT')}
                                                                className="h-auto flex-col gap-1 py-4"
                                                            >
                                                                <Package className="h-5 w-5" />
                                                                <span className="text-sm font-medium">Material</span>
                                                                <span className="text-muted-foreground text-xs">
                                                                    Generate material costs
                                                                </span>
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                        <Button onClick={addRow} size="sm" variant="outline">
                                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                                            Add Row
                                        </Button>
                                        <Button
                                            onClick={deleteSelectedRows}
                                            size="sm"
                                            variant="outline"
                                            disabled={selectedCount === 0}
                                        >
                                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                            Delete
                                            {selectedCount > 0 && <span className="ml-1">({selectedCount})</span>}
                                        </Button>
                                    </div>
                                </div>
                                <div ref={resizeRef} className="px-4">
                                    <VariationLineGrid
                                        ref={gridRef}
                                        lineItems={data.line_items}
                                        costCodes={costData}
                                        costTypes={CostTypes}
                                        onDataChange={handleLineItemsChange}
                                        onSelectionChange={handleSelectionChange}
                                        height={gridHeight}
                                    />
                                </div>
                                <div
                                    onMouseDown={handleResizeStart}
                                    className={cn(
                                        'group flex w-full cursor-ns-resize items-center justify-center py-1 transition-all',
                                        'hover:bg-muted',
                                        isResizing && 'bg-muted',
                                    )}
                                    title="Drag to resize"
                                >
                                    <GripHorizontal className="text-muted-foreground h-4 w-4" />
                                </div>
                                {/* Totals Footer */}
                                <div className="bg-muted/50 flex flex-wrap items-center justify-between gap-2 rounded-b-lg border-t px-4 py-3">
                                    <div className="flex items-center gap-4 text-sm sm:gap-6">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-muted-foreground text-xs font-medium">Total Cost:</span>
                                            <span className="font-semibold tabular-nums">{fmtCurrency(gridTotals.totalCost)}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-muted-foreground text-xs font-medium">Revenue:</span>
                                            <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                                                {fmtCurrency(gridTotals.totalRevenue)}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-muted-foreground text-xs">
                                        {data.line_items.length} {data.line_items.length === 1 ? 'line' : 'lines'}
                                    </span>
                                </div>
                            </div>
                        </section>

                        {/* Bottom spacer for scroll tracking */}
                        <div className="h-32" />
                    </div>
                </div>
            </div>

            {/* Condition Manager Dialog */}
            {data.location_id && (
                <ConditionManager
                    open={showConditionManager}
                    onOpenChange={setShowConditionManager}
                    locationId={Number(data.location_id)}
                    conditions={localConditions as any}
                    onConditionsChange={(updated) => setLocalConditions(updated as any)}
                />
            )}
        </AppLayout>
    );
};

export default VariationCreate;
