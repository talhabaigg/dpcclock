import { ConditionManager } from '@/components/condition-manager';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useForm } from '@inertiajs/react';
import axios from 'axios';
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
}

interface VariationData {
    id: number;
    location_id: number;
    type: string;
    co_number: string;
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
    { id: 1, label: 'Details', description: 'Variation info' },
    { id: 2, label: 'Pricing', description: 'Cost breakdown' },
    { id: 3, label: 'Client', description: 'Sell rates & quote' },
    { id: 4, label: 'Premier', description: 'Lines & export' },
] as const;

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Variations', href: '/variations' },
    { title: 'Create', href: '/variations/create' },
];

function SummaryBar({ items }: { items: { label: string; value: string }[] }) {
    return (
        <div className="bg-muted/50 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-3 py-2.5 text-sm sm:gap-x-6 sm:px-4 sm:py-3">
            {items.map((item) => (
                <div key={item.label}>
                    <span className="text-muted-foreground">{item.label}:</span>{' '}
                    <span className="font-medium">{item.value}</span>
                </div>
            ))}
        </div>
    );
}

const VariationCreate = ({ locations, costCodes, variation, conditions = [], selectedLocationId, changeTypes = [] }: VariationCreateProps) => {
    const gridRef = useRef<VariationLineGridRef>(null);
    const { data, setData, post, errors } = useForm({
        location_id: variation ? String(variation.location_id) : selectedLocationId ? String(selectedLocationId) : '',
        type: variation?.type ?? 'dayworks',
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
    const [activeStep, setActiveStep] = useState(1);
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

    // --- Derived ---
    const selectedLocation = locations.find((loc) => String(loc.id) === data.location_id);
    const costData = selectedLocation?.cost_codes ?? [];
    const sortedLocations = useMemo(() => [...locations].sort((a, b) => a.name.localeCompare(b.name)), [locations]);
    const canProceedToStep2 = data.location_id && data.co_number.trim() && data.description.trim();

    const gridTotals = useMemo(() => {
        const totalCost = data.line_items.reduce((sum: number, i: any) => sum + (Number(i.total_cost) || 0), 0);
        const totalRevenue = data.line_items.reduce((sum: number, i: any) => sum + (Number(i.revenue) || 0), 0);
        return { totalCost, totalRevenue };
    }, [data.line_items]);

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
                const { data: resp } = await axios.post(`/variations/${varId}/pricing-items`, payload);
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
                    const { data: response } = await axios.post('/variations/quick-store', {
                        location_id: parseInt(data.location_id),
                        co_number: data.co_number,
                        description: data.description,
                        type: data.type || 'extra',
                    });
                    varId = response.variation.id;
                    setSavedVariationId(varId);
                    window.history.replaceState({}, '', `/variations/${varId}/edit`);
                } catch (err: any) {
                    toast.error(err.response?.data?.message || 'Failed to save variation');
                    setSaving(false);
                    return;
                }
            }

            if (varId && hasUnsaved) {
                await persistUnsavedPricingItems(varId);
            }

            // post() triggers Inertia navigation — setSaving(false) in onFinish
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

    // --- Quick Gen (deduplicated) ---
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
            <div className="min-h-screen min-w-0 overflow-x-hidden">
                {/* Header */}
                <div className="border-b px-4 py-4 sm:px-6 sm:py-5 md:px-8">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
                                {savedVariationId ? 'Edit Variation' : 'New Variation'}
                            </h1>
                            <p className="text-muted-foreground mt-1 hidden text-sm sm:block">
                                {savedVariationId ? 'Update variation details and line items' : 'Create a new variation in 4 steps'}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
                                <ArrowLeft className="mr-1.5 h-4 w-4" />
                                Back
                            </Button>
                            <Button onClick={handleSubmit} disabled={saving} size="sm">
                                <Save className="mr-1.5 h-4 w-4" />
                                {saving ? 'Saving...' : variation?.id ? 'Update' : 'Save Variation'}
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="p-4 sm:p-6 md:p-8">
                    {/* Error Banner */}
                    {Object.keys(errors).length > 0 && (
                        <div className="bg-destructive/5 border-destructive/20 mb-6 rounded-lg border p-4">
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

                    {/* Step Indicator */}
                    <nav className="mb-6 overflow-x-auto sm:mb-8">
                        <ol className="flex items-center">
                            {STEPS.map((step, index) => {
                                const isActive = activeStep === step.id;
                                const isCompleted = activeStep > step.id;
                                return (
                                    <li key={step.id} className="flex items-center">
                                        <button
                                            onClick={() => {
                                                if (step.id === 1 || canProceedToStep2) {
                                                    setActiveStep(step.id);
                                                }
                                            }}
                                            className={cn(
                                                'group flex items-center gap-2 rounded-xl px-2 py-2 transition-all sm:gap-3 sm:px-4 sm:py-3',
                                                isActive && 'bg-primary text-primary-foreground shadow-sm',
                                                isCompleted && 'bg-muted hover:bg-muted/80 text-foreground',
                                                !isActive && !isCompleted && 'text-muted-foreground hover:bg-muted/50',
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all sm:h-7 sm:w-7',
                                                    isActive && 'bg-primary-foreground text-primary',
                                                    isCompleted && 'bg-primary text-primary-foreground',
                                                    !isActive && !isCompleted && 'border-muted-foreground/30 border',
                                                )}
                                            >
                                                {isCompleted ? <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : step.id}
                                            </span>
                                            <div className="text-left">
                                                <div className="text-xs font-semibold leading-tight sm:text-sm">{step.label}</div>
                                                <div
                                                    className={cn(
                                                        'hidden text-xs leading-tight sm:block',
                                                        isActive ? 'text-primary-foreground/70' : 'text-muted-foreground',
                                                    )}
                                                >
                                                    {step.description}
                                                </div>
                                            </div>
                                        </button>
                                        {index < STEPS.length - 1 && (
                                            <div
                                                className={cn(
                                                    'mx-0.5 h-px w-4 sm:mx-1 sm:w-10',
                                                    isCompleted ? 'bg-primary' : 'bg-border',
                                                )}
                                            />
                                        )}
                                    </li>
                                );
                            })}
                        </ol>
                    </nav>

                    {/* Step 1: Variation Details */}
                    {activeStep === 1 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Variation Details</CardTitle>
                                <CardDescription>
                                    Set the location, type, and description for this variation.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                                    <div className="min-w-0 space-y-2 sm:col-span-2">
                                        <Label>
                                            Location <span className="text-destructive">*</span>
                                        </Label>
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
                                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                                <Command>
                                                    <CommandInput placeholder="Search locations..." />
                                                    <CommandList>
                                                        <CommandEmpty>No location found.</CommandEmpty>
                                                        <CommandGroup>
                                                            {sortedLocations.map((loc) => (
                                                                <CommandItem
                                                                    key={loc.id}
                                                                    value={loc.name}
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

                                    <div className="space-y-2">
                                        <Label htmlFor="type">Type</Label>
                                        <Select value={data.type} onValueChange={(val) => setData('type', val)}>
                                            <SelectTrigger id="type">
                                                <SelectValue placeholder="Select type..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {changeTypes.length > 0 ? (
                                                    changeTypes.map((t) => (
                                                        <SelectItem key={t} value={t}>
                                                            {t.charAt(0).toUpperCase() + t.slice(1)}
                                                        </SelectItem>
                                                    ))
                                                ) : (
                                                    <>
                                                        <SelectItem value="dayworks">Dayworks</SelectItem>
                                                        <SelectItem value="variations">Variations</SelectItem>
                                                    </>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="co_number">
                                            Variation Number <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="co_number"
                                            value={data.co_number}
                                            onChange={(e) => setData('co_number', e.target.value)}
                                            placeholder="e.g. VAR-001"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className={cn(
                                                        'w-full justify-start text-left font-normal',
                                                        !data.date && 'text-muted-foreground',
                                                    )}
                                                >
                                                    <CalendarDays className="mr-2 h-4 w-4" />
                                                    {data.date
                                                        ? format(new Date(data.date + 'T00:00:00'), 'dd/MM/yyyy')
                                                        : 'Pick a date'}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
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

                                    <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                                        <Label htmlFor="description">
                                            Description <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="description"
                                            value={data.description}
                                            onChange={(e) => setData('description', e.target.value)}
                                            placeholder="Brief description of the variation..."
                                        />
                                    </div>
                                </div>

                                <div className="mt-6 flex justify-end">
                                    <Button
                                        onClick={() => setActiveStep(2)}
                                        disabled={!canProceedToStep2}
                                    >
                                        Continue to Pricing
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Step 2: Pricing */}
                    {activeStep === 2 && (
                        <div className="space-y-6">
                            <SummaryBar
                                items={[
                                    { label: 'Location', value: selectedLocation?.name || '\u2014' },
                                    { label: 'Var #', value: data.co_number || '\u2014' },
                                    { label: 'Type', value: data.type },
                                    { label: 'Date', value: data.date },
                                ]}
                            />

                            <Card className="py-0">
                                <CardHeader className="border-b py-4">
                                    <CardTitle className="flex items-center gap-2">
                                        <DollarSign className="h-4 w-4" />
                                        Variation Pricing
                                    </CardTitle>
                                    <CardDescription>
                                        Add pricing items from conditions or manually.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="py-6">
                                    <VariationPricingTab
                                        variationId={savedVariationId}
                                        conditions={localConditions}
                                        locationId={data.location_id}
                                        pricingItems={pricingItems}
                                        onPricingItemsChange={setPricingItems}
                                        onManageConditions={() => setShowConditionManager(true)}
                                    />
                                </CardContent>
                            </Card>

                            <div className="flex justify-between">
                                <Button variant="outline" onClick={() => setActiveStep(1)}>
                                    Back to Details
                                </Button>
                                <Button onClick={() => setActiveStep(3)}>
                                    Continue to Client
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Client */}
                    {activeStep === 3 && (
                        <div className="space-y-6">
                            <SummaryBar
                                items={[
                                    { label: 'Location', value: selectedLocation?.name || '\u2014' },
                                    { label: 'Var #', value: data.co_number || '\u2014' },
                                    { label: 'Pricing Items', value: String(pricingItems.length) },
                                ]}
                            />

                            <Card className="py-0">
                                <CardHeader className="border-b py-4">
                                    <CardTitle className="flex items-center gap-2">
                                        <TrendingUp className="h-4 w-4" />
                                        Client Variation
                                    </CardTitle>
                                    <CardDescription>
                                        Set sell rates and prepare the client quote.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="py-6">
                                    <ClientVariationTab
                                        variationId={savedVariationId}
                                        pricingItems={pricingItems}
                                        clientNotes={data.client_notes}
                                        onClientNotesChange={(notes) => setData('client_notes', notes)}
                                        onPricingItemsChange={setPricingItems}
                                    />
                                </CardContent>
                            </Card>

                            <div className="flex justify-between">
                                <Button variant="outline" onClick={() => setActiveStep(2)}>
                                    Back to Pricing
                                </Button>
                                <Button onClick={() => setActiveStep(4)}>
                                    Continue to Premier
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Premier / Submit */}
                    {activeStep === 4 && (
                        <div className="space-y-6">
                            <SummaryBar
                                items={[
                                    { label: 'Location', value: selectedLocation?.name || '\u2014' },
                                    { label: 'Var #', value: data.co_number || '\u2014' },
                                    { label: 'Pricing Items', value: String(pricingItems.length) },
                                ]}
                            />

                            <Card className="py-0">
                                <CardHeader className="border-b py-4">
                                    <CardTitle className="flex items-center gap-2">
                                        <Send className="h-4 w-4" />
                                        Premier Variation
                                    </CardTitle>
                                    <CardDescription>
                                        Generate Premier lines and manage the export.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="py-6">
                                    <PremierVariationTab
                                        variationId={savedVariationId}
                                        pricingItems={pricingItems}
                                        lineItems={data.line_items}
                                        onLineItemsChange={(items) => setData('line_items', items)}
                                    />
                                </CardContent>
                            </Card>

                            {/* Line Items Grid */}
                            <Card className="space-y-0 py-0">
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
                            </Card>

                            {/* Footer Actions */}
                            <div className="flex items-center justify-between">
                                <Button variant="outline" onClick={() => setActiveStep(3)}>
                                    Back to Client
                                </Button>
                                <Button onClick={handleSubmit} disabled={saving}>
                                    <Save className="mr-1.5 h-4 w-4" />
                                    {saving ? 'Saving...' : variation?.id ? 'Update Variation' : 'Save Variation'}
                                </Button>
                            </div>
                        </div>
                    )}
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
