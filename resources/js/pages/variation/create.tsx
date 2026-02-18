import { ConditionManager } from '@/components/condition-manager';
import LoadingDialog from '@/components/loading-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { BreadcrumbItem } from '@/types';
import { useForm } from '@inertiajs/react';
import axios from 'axios';
import {
    AlertCircle,
    ArrowLeft,
    Check,
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

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Variations',
        href: '/variations',
    },
    {
        title: 'Create',
        href: '/variations/create',
    },
];

interface Location {
    id: number;
    name: string;
    cost_codes: CostCode[];
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
    variation?: any;
    conditions?: Condition[];
    selectedLocationId?: string | number;
}

const STEPS = [
    { id: 1, label: 'Details', description: 'Variation info' },
    { id: 2, label: 'Pricing', description: 'Cost breakdown' },
    { id: 3, label: 'Submit', description: 'Review & send' },
] as const;

const VariationCreate = ({ locations, costCodes, variation, conditions = [], selectedLocationId }: VariationCreateProps) => {
    const gridRef = useRef<VariationLineGridRef>(null);
    const { data, setData, post, errors } = useForm({
        location_id: variation ? String(variation.location_id) : selectedLocationId ? String(selectedLocationId) : '',
        type: variation ? variation.type : 'dayworks',
        co_number: variation ? variation.co_number : '',
        description: variation ? variation.description : '',
        client_notes: variation ? variation.client_notes || '' : '',
        amount: variation ? variation.amount : '',
        date: variation ? variation.co_date : new Date().toISOString().split('T')[0],
        line_items: variation
            ? variation.line_items.map((item: any) => ({
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

    const [activeStep, setActiveStep] = useState(1);
    const [savedVariationId, setSavedVariationId] = useState<number | undefined>(variation?.id);
    const [localConditions, setLocalConditions] = useState<any[]>(conditions);
    const [showConditionManager, setShowConditionManager] = useState(false);
    const [pricingItems, setPricingItems] = useState<PricingItem[]>(variation?.pricing_items ?? []);

    const persistUnsavedPricingItems = async (varId: number) => {
        const unsaved = pricingItems.filter((item) => !item.id);
        if (unsaved.length === 0) return;

        const persisted: PricingItem[] = pricingItems.filter((item) => !!item.id);
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
                const { data: resp } = await axios.post(`/variations/${varId}/pricing-items`, payload);
                persisted.push(resp.pricing_item);
            } catch {
                // skip failed items silently
            }
        }
        setPricingItems(persisted);
    };

    const [selectedCount, setSelectedCount] = useState(0);
    const [gridHeight, setGridHeight] = useState(() => {
        return localStorage.getItem('variationGridSize') || '500px';
    });
    const [isResizing, setIsResizing] = useState(false);
    const resizeRef = useRef<HTMLDivElement>(null);

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

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    const addRow = () => {
        if (gridRef.current) {
            gridRef.current.addRow();
        }
    };

    const deleteSelectedRows = () => {
        if (gridRef.current) {
            gridRef.current.deleteSelectedRows();
            setSelectedCount(0);
        }
    };

    const handleLineItemsChange = (lineItems: any[]) => {
        setData('line_items', lineItems);
    };

    const handleSelectionChange = (count: number) => {
        setSelectedCount(count);
    };

    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setSaving(true);

        try {
            let varId = savedVariationId;

            const hasUnsaved = pricingItems.some((item) => !item.id);
            if (!varId && hasUnsaved) {
                if (!data.location_id || !data.co_number || !data.description) {
                    toast.error('Please fill in Location, CO Number, and Description to save');
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

            if (varId) {
                post(`/variations/${varId}/update`);
            } else {
                post('/variations/store');
            }
        } finally {
            setSaving(false);
        }
    };

    const [open, setOpen] = useState(false);
    const [quickGenOpen, setQuickGenOpen] = useState(false);
    const [genAmount, setGenAmount] = useState('');
    const costData = locations.find((location) => String(location.id) === data.location_id)?.cost_codes || [];

    const gridTotals = useMemo(() => {
        const totalCost = data.line_items.reduce((sum: number, i: any) => sum + (Number(i.total_cost) || 0), 0);
        const totalRevenue = data.line_items.reduce((sum: number, i: any) => sum + (Number(i.revenue) || 0), 0);
        return { totalCost, totalRevenue };
    }, [data.line_items]);

    const fmtCurrency = (v: number) =>
        new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(v);

    const generatePrelimLabour = () => {
        if (!genAmount || !data.location_id) {
            alert('Please select a location and enter an amount.');
            return;
        }
        setOpen(true);
        setQuickGenOpen(false);
        setTimeout(() => {
            setOpen(false);
        }, 3000);

        const costData = locations.find((location) => String(location.id) === data.location_id)?.cost_codes || [];
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

        const PrelimLab = onCostData.filter((item) => item.prelim_type.startsWith('LAB'));
        const baseAmount = parseFloat(genAmount);

        const newLines = PrelimLab.map((item, index) => {
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
    };

    const generatePrelimMaterial = () => {
        if (!genAmount || !data.location_id) {
            alert('Please select a location and enter an amount.');
            return;
        }
        setOpen(true);
        setQuickGenOpen(false);
        setTimeout(() => {
            setOpen(false);
        }, 3000);

        const costData = locations.find((location) => String(location.id) === data.location_id)?.cost_codes || [];
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

        const PrelimMat = onCostData.filter((item) => item.prelim_type.startsWith('MAT'));
        const baseAmount = parseFloat(genAmount);

        const newLines = PrelimMat.map((item, index) => {
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
    };

    const selectedLocation = locations.find((loc) => String(loc.id) === data.location_id);

    const canProceedToStep2 = data.location_id && data.co_number && data.description;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="min-h-screen min-w-0 overflow-x-hidden">
                {/* Header */}
                <div className="border-b px-4 py-5 sm:px-6 md:px-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-semibold tracking-tight">
                                {savedVariationId ? 'Edit Variation' : 'New Variation'}
                            </h1>
                            <p className="text-muted-foreground mt-1 text-sm">
                                {savedVariationId ? 'Update variation details and line items' : 'Create a new variation in 3 steps'}
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
                    <LoadingDialog open={open} setOpen={setOpen} />

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
                    <nav className="mb-8">
                        <ol className="flex items-center gap-2">
                            {STEPS.map((step, index) => {
                                const isActive = activeStep === step.id;
                                const isCompleted = activeStep > step.id;
                                return (
                                    <li key={step.id} className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                if (step.id === 1 || canProceedToStep2) {
                                                    setActiveStep(step.id);
                                                }
                                            }}
                                            className={cn(
                                                'flex items-center gap-2.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
                                                isActive && 'bg-primary text-primary-foreground',
                                                isCompleted && 'bg-muted text-foreground',
                                                !isActive && !isCompleted && 'text-muted-foreground hover:bg-muted/50',
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                                                    isActive && 'bg-primary-foreground text-primary',
                                                    isCompleted && 'bg-primary text-primary-foreground',
                                                    !isActive && !isCompleted && 'border-muted-foreground/30 border',
                                                )}
                                            >
                                                {isCompleted ? <Check className="h-3.5 w-3.5" /> : step.id}
                                            </span>
                                            <span className="hidden sm:inline">{step.label}</span>
                                        </button>
                                        {index < STEPS.length - 1 && (
                                            <Separator className={cn('w-8', isCompleted && 'bg-primary')} />
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
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label htmlFor="location">Location</Label>
                                        <Select
                                            value={data.location_id}
                                            onValueChange={(val) => setData('location_id', val)}
                                            disabled={!!selectedLocationId}
                                        >
                                            <SelectTrigger id="location">
                                                <SelectValue placeholder="Select a location..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {[...locations]
                                                    .sort((a, b) => a.name.localeCompare(b.name))
                                                    .map((loc) => (
                                                        <SelectItem key={loc.id} value={String(loc.id)}>
                                                            {loc.name}
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                        {selectedLocation && (
                                            <p className="text-muted-foreground text-xs">{selectedLocation.name}</p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="type">Type</Label>
                                        <Select value={data.type} onValueChange={(val) => setData('type', val)}>
                                            <SelectTrigger id="type">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="dayworks">Dayworks</SelectItem>
                                                <SelectItem value="variations">Variations</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="co_number">CO Number</Label>
                                        <Input
                                            id="co_number"
                                            value={data.co_number}
                                            onChange={(e) => setData('co_number', e.target.value)}
                                            placeholder="e.g. CO-001"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="date">Date</Label>
                                        <Input
                                            id="date"
                                            type="date"
                                            value={data.date}
                                            onChange={(e) => setData('date', e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                                        <Label htmlFor="description">Description</Label>
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
                            {/* Summary bar showing header details */}
                            <div className="bg-muted/50 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border px-4 py-3 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Location:</span>{' '}
                                    <span className="font-medium">{selectedLocation?.name || '—'}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">CO:</span>{' '}
                                    <span className="font-medium">{data.co_number || '—'}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Type:</span>{' '}
                                    <span className="font-medium capitalize">{data.type}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Date:</span>{' '}
                                    <span className="font-medium">{data.date}</span>
                                </div>
                            </div>

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
                                <Button variant="outline" onClick={() => setActiveStep(1)}>
                                    Back to Details
                                </Button>
                                <Button onClick={() => setActiveStep(3)}>
                                    Continue to Submit
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Premier / Submit */}
                    {activeStep === 3 && (
                        <div className="space-y-6">
                            {/* Summary bar */}
                            <div className="bg-muted/50 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border px-4 py-3 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Location:</span>{' '}
                                    <span className="font-medium">{selectedLocation?.name || '—'}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">CO:</span>{' '}
                                    <span className="font-medium">{data.co_number || '—'}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Pricing Items:</span>{' '}
                                    <span className="font-medium">{pricingItems.length}</span>
                                </div>
                            </div>

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
                            <div className="space-y-0">
                                <div className="flex items-center justify-between px-1 py-4">
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
                                        <p className="text-muted-foreground mt-0.5 text-sm">Premier line items for export.</p>
                                    </div>
                                    <div className="flex gap-2">
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
                                                                    onClick={generatePrelimLabour}
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
                                                                    onClick={generatePrelimMaterial}
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
                                    <div ref={resizeRef}>
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
                                    <div className="bg-muted/50 flex items-center justify-between border-t px-4 py-3">
                                        <div className="flex items-center gap-6 text-sm">
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

                            {/* Footer Actions */}
                            <div className="flex items-center justify-between">
                                <Button variant="outline" onClick={() => setActiveStep(2)}>
                                    Back to Pricing
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
