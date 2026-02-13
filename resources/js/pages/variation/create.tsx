import { ConditionManager } from '@/components/condition-manager';
import LoadingDialog from '@/components/loading-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { useForm } from '@inertiajs/react';
import axios from 'axios';
import { AlertCircle, ArrowLeft, ClipboardList, DollarSign, FileText, GripHorizontal, Package, Plus, Save, Send, Trash2, TrendingUp, Wrench, Zap } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CostCode } from '../purchasing/types';
import ClientVariationTab from './partials/ClientVariationTab';
import { Condition } from './partials/ConditionPricingPanel';
import PremierVariationTab from './partials/PremierVariationTab';
import VariationHeaderGrid, { VariationHeaderGridRef } from './partials/variationHeader/VariationHeaderGrid';
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
}

const VariationCreate = ({ locations, costCodes, variation, conditions = [] }: VariationCreateProps) => {
    const gridRef = useRef<VariationLineGridRef>(null);
    const headerGridRef = useRef<VariationHeaderGridRef>(null);
    const { data, setData, post, errors } = useForm({
        location_id: variation ? String(variation.location_id) : '',
        type: variation ? variation.type : 'dayworks',
        co_number: variation ? variation.co_number : '',
        description: variation ? variation.description : '',
        client_notes: variation ? (variation.client_notes || '') : '',
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

    // Track variation ID (either from prop or auto-saved)
    const [savedVariationId, setSavedVariationId] = useState<number | undefined>(variation?.id);

    // Conditions state (mutable so condition manager can update)
    const [localConditions, setLocalConditions] = useState<any[]>(conditions);
    const [showConditionManager, setShowConditionManager] = useState(false);

    // Pricing items state (from variation_pricing_items table)
    const [pricingItems, setPricingItems] = useState<PricingItem[]>(
        variation?.pricing_items ?? []
    );

    /**
     * Persist any unsaved (local-only) pricing items to the server.
     * Called after the variation has been saved/created.
     */
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

    const gridSizeOptions = [
        { value: '300px', label: 'Small' },
        { value: '500px', label: 'Medium' },
        { value: '1000px', label: 'Large' },
        { value: '2000px', label: 'XXL' },
    ];

    const handleGridSizeChange = (value: string) => {
        setGridHeight(value);
        localStorage.setItem('variationGridSize', value);
    };

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

    const handleHeaderDataChange = (headerData: any) => {
        setData('location_id', headerData.location_id);
        setData('type', headerData.type);
        setData('co_number', headerData.co_number);
        setData('date', headerData.date);
        setData('description', headerData.description);
    };

    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setSaving(true);

        try {
            let varId = savedVariationId;

            // If we have unsaved pricing items and no variation yet, quick-store first
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

            // Persist unsaved pricing items
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
    const waste_ratio = costData.find((code) => code.pivot?.waste_ratio)?.pivot.waste_ratio || 0;

    useEffect(() => {
        // Update cost data when location changes
    }, [data.location_id, costData]);

    void waste_ratio;

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
                prelim_type_raw: prelimTypeRaw,
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
                prelim_type_raw: prelimTypeRaw,
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

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="dark:from-background dark:via-background dark:to-background min-h-screen min-w-0 overflow-x-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100/50">
                {/* Header Section */}
                <div className="dark:border-border dark:bg-background/70 border-b border-slate-200/40 bg-white/70 px-3 py-4 backdrop-blur-xl sm:px-6 sm:py-6 md:px-8">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        <div>
                            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-50">
                                {savedVariationId ? 'Edit Variation' : 'Create Variation'}
                            </h1>
                            <p className="mt-0.5 text-xs font-medium text-slate-500 sm:mt-1 sm:text-sm dark:text-slate-400">
                                {savedVariationId ? 'Update variation details and line items' : 'Enter variation details and add line items'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-2 sm:p-6 md:p-8">
                    <LoadingDialog open={open} setOpen={setOpen} />

                    {/* Error Summary Banner */}
                    {Object.keys(errors).length > 0 && (
                        <div className="border-destructive/50 bg-destructive/5 mb-4 rounded-xl border p-4">
                            <div className="mb-3 flex items-center gap-2">
                                <div className="bg-destructive/10 flex h-8 w-8 items-center justify-center rounded-lg">
                                    <AlertCircle className="text-destructive h-4 w-4" />
                                </div>
                                <div>
                                    <h3 className="text-destructive text-sm font-semibold">Validation Errors</h3>
                                    <p className="text-destructive/80 text-xs">Please fix the following errors before submitting</p>
                                </div>
                            </div>
                            <ul className="space-y-1.5 pl-10">
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
                                        <li key={key} className="flex items-start gap-2 text-sm">
                                            <span className="bg-destructive mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full" />
                                            <span>
                                                <span className="text-destructive font-medium">{formatErrorKey(key)}:</span>{' '}
                                                <span className="text-destructive/90">{message as string}</span>
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}

                    {/* Header Grid */}
                    <div className="mb-4 space-y-3 sm:mb-6">
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                                <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h3 className="text-base font-semibold sm:text-lg">Variation Details</h3>
                        </div>
                        <VariationHeaderGrid
                            ref={headerGridRef}
                            headerData={{
                                location_id: data.location_id,
                                type: data.type,
                                co_number: data.co_number,
                                date: data.date,
                                description: data.description,
                            }}
                            locations={locations}
                            onDataChange={handleHeaderDataChange}
                        />
                    </div>

                    {/* 3-Tab Workflow */}
                    <div className="mb-4 sm:mb-6">
                        <Tabs defaultValue="pricing" className="w-full">
                            <TabsList className="mb-4 w-full justify-start">
                                <TabsTrigger value="pricing" className="gap-1.5">
                                    <DollarSign className="h-3.5 w-3.5" />
                                    Variation Pricing
                                </TabsTrigger>
                                <TabsTrigger value="client" className="gap-1.5">
                                    <TrendingUp className="h-3.5 w-3.5" />
                                    Client Variation
                                </TabsTrigger>
                                <TabsTrigger value="premier" className="gap-1.5">
                                    <Send className="h-3.5 w-3.5" />
                                    Premier Variation
                                </TabsTrigger>
                            </TabsList>

                            {/* Tab: Variation Pricing */}
                            <TabsContent value="pricing">
                                <VariationPricingTab
                                    variationId={savedVariationId}
                                    conditions={localConditions}
                                    locationId={data.location_id}
                                    pricingItems={pricingItems}
                                    onPricingItemsChange={setPricingItems}
                                    onManageConditions={() => setShowConditionManager(true)}
                                />
                            </TabsContent>

                            {/* Tab: Client Variation */}
                            <TabsContent value="client">
                                <ClientVariationTab
                                    variationId={savedVariationId}
                                    pricingItems={pricingItems}
                                    clientNotes={data.client_notes}
                                    onClientNotesChange={(notes) => setData('client_notes', notes)}
                                    onPricingItemsChange={setPricingItems}
                                />
                            </TabsContent>

                            {/* Tab: Premier Variation */}
                            <TabsContent value="premier">
                                <PremierVariationTab
                                    variationId={savedVariationId}
                                    pricingItems={pricingItems}
                                    lineItems={data.line_items}
                                    onLineItemsChange={(items) => setData('line_items', items)}
                                />

                                {/* Legacy Line Items Grid (editable) */}
                                <div className="mt-6 space-y-3">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex items-center gap-2 sm:gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
                                                <ClipboardList className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                                            </div>
                                            <h3 className="text-base font-semibold sm:text-lg">Line Items</h3>
                                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                                {selectedCount > 0 ? `${selectedCount} selected` : `${data.line_items.length} total`}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Dialog open={quickGenOpen} onOpenChange={setQuickGenOpen}>
                                                <DialogTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-9 gap-1.5 rounded-lg border-amber-200/60 bg-amber-50/50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-950/50"
                                                    >
                                                        <Zap className="h-3.5 w-3.5" />
                                                        <span className="hidden sm:inline">Quick Gen</span>
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="sm:max-w-lg">
                                                    <DialogHeader className="space-y-3">
                                                        <div className="from-primary to-primary/60 mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br shadow-lg">
                                                            <Zap className="text-primary-foreground h-6 w-6" />
                                                        </div>
                                                        <DialogTitle className="text-center text-xl">Quick Generate</DialogTitle>
                                                        <DialogDescription className="text-center">
                                                            Automatically populate line items based on your base amount
                                                        </DialogDescription>
                                                    </DialogHeader>

                                                    <div className="space-y-6 py-6">
                                                        <div className="space-y-3">
                                                            <label htmlFor="amount" className="flex items-center gap-2 text-sm font-semibold">
                                                                <span className="bg-primary/10 text-primary flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold">
                                                                    1
                                                                </span>
                                                                Enter Base Amount
                                                            </label>
                                                            <Input
                                                                id="amount"
                                                                type="text"
                                                                inputMode="decimal"
                                                                value={genAmount}
                                                                onChange={(e) => setGenAmount(e.target.value.replace(/,/g, ''))}
                                                                placeholder="0.00"
                                                                className="focus-visible:border-primary h-12 border-2 text-center text-lg font-medium"
                                                            />
                                                        </div>

                                                        <div className="relative">
                                                            <div className="absolute inset-0 flex items-center">
                                                                <div className="border-muted w-full border-t"></div>
                                                            </div>
                                                            <div className="relative flex justify-center text-xs uppercase">
                                                                <span className="bg-background text-muted-foreground px-2 font-medium">Choose Type</span>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-3">
                                                            <label className="flex items-center gap-2 text-sm font-semibold">
                                                                <span className="bg-primary/10 text-primary flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold">
                                                                    2
                                                                </span>
                                                                Select Generation Type
                                                            </label>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <button
                                                                    onClick={generatePrelimLabour}
                                                                    className="group border-muted to-background hover:border-primary dark:to-background relative overflow-hidden rounded-lg border-2 bg-gradient-to-br from-blue-50/50 p-4 text-left transition-all duration-200 dark:from-blue-950/20"
                                                                >
                                                                    <div className="space-y-2">
                                                                        <div className="flex items-center justify-between">
                                                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 transition-transform group-hover:scale-110 dark:bg-blue-900/30">
                                                                                <Wrench className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                                                            </div>
                                                                        </div>
                                                                        <div>
                                                                            <div className="text-sm font-semibold">Labour</div>
                                                                            <div className="text-muted-foreground text-xs">Generate labour costs</div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full"></div>
                                                                </button>

                                                                <button
                                                                    onClick={generatePrelimMaterial}
                                                                    className="group border-muted to-background hover:border-primary dark:to-background relative overflow-hidden rounded-lg border-2 bg-gradient-to-br from-purple-50/50 p-4 text-left transition-all duration-200 dark:from-purple-950/20"
                                                                >
                                                                    <div className="space-y-2">
                                                                        <div className="flex items-center justify-between">
                                                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 transition-transform group-hover:scale-110 dark:bg-purple-900/30">
                                                                                <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                                                            </div>
                                                                        </div>
                                                                        <div>
                                                                            <div className="text-sm font-semibold">Material</div>
                                                                            <div className="text-muted-foreground text-xs">Generate material costs</div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full"></div>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                            <Button onClick={addRow} size="sm" variant="outline" className="h-9 gap-1.5 rounded-lg">
                                                <Plus className="h-3.5 w-3.5" />
                                                <span className="xs:inline hidden">Add Row</span>
                                                <span className="xs:hidden">Add</span>
                                            </Button>
                                            <Button
                                                onClick={deleteSelectedRows}
                                                size="sm"
                                                variant="outline"
                                                disabled={selectedCount === 0}
                                                className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive h-9 gap-1.5 rounded-lg disabled:opacity-50"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                                <span className="hidden sm:inline">Delete</span>
                                                {selectedCount > 0 && <span>({selectedCount})</span>}
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
                                    {/* Drag Handle */}
                                    <div
                                        onMouseDown={handleResizeStart}
                                        className={`group flex w-full cursor-ns-resize items-center justify-center rounded py-1 transition-all hover:bg-slate-100 dark:hover:bg-slate-800 ${isResizing ? 'bg-slate-200 dark:bg-slate-700' : ''}`}
                                        title="Drag to resize"
                                    >
                                        <GripHorizontal className="h-4 w-4 text-slate-400 transition-colors group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        {/* Grid Size Selector */}
                        <div className="flex items-center gap-2">
                            <Label className="text-[10px] text-slate-500 dark:text-slate-400">Grid Size</Label>
                            <Select value={gridHeight} onValueChange={handleGridSizeChange}>
                                <SelectTrigger className="h-8 w-24 py-0 text-xs">
                                    <SelectValue placeholder="Size" />
                                </SelectTrigger>
                                <SelectContent className="w-24">
                                    {gridSizeOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value} className="text-xs">
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex gap-3 sm:gap-4">
                            <Button
                                variant="outline"
                                onClick={() => window.history.back()}
                                className="h-10 w-full gap-2 rounded-lg border-slate-200/60 sm:h-11 sm:w-auto sm:rounded-xl sm:px-6"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={saving}
                                className="h-10 w-full gap-2 rounded-lg bg-gradient-to-r from-slate-900 to-slate-800 px-6 shadow-lg ring-1 shadow-slate-900/20 ring-slate-900/10 transition-all hover:from-slate-800 hover:to-slate-700 hover:shadow-xl hover:shadow-slate-900/30 sm:h-11 sm:w-auto sm:rounded-xl dark:from-white dark:to-slate-100 dark:text-slate-900 dark:shadow-white/10 dark:ring-white/20 dark:hover:from-slate-50 dark:hover:to-white"
                            >
                                <Save className="h-4 w-4" />
                                {saving ? 'Saving...' : variation?.id ? 'Update Variation' : 'Create Variation'}
                            </Button>
                        </div>
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
