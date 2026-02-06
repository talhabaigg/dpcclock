import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useForm } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Loader2, Lock, Package, Plus, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface Supplier {
    id: number;
    name: string;
    code: string;
}

interface MaterialItem {
    id: number;
    code: string;
    description: string;
    unit_cost?: number;
    is_favourite?: boolean;
}

interface PricingConfig {
    material_item_id: number;
    code: string;
    description: string;
    unit_cost_override: string;
    is_locked: boolean;
}

interface AttachMaterialsDialogProps {
    locationId: number;
    existingMaterialIds: number[];
}

export default function AttachMaterialsDialog({ locationId, existingMaterialIds }: AttachMaterialsDialogProps) {
    const [open, setOpen] = useState(false);
    const [currentStage, setCurrentStage] = useState<1 | 2 | 3 | 4>(1);

    // Stage 1: Suppliers
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
    const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);

    // Stage 2: Materials
    const [materials, setMaterials] = useState<MaterialItem[]>([]);
    const [selectedMaterialIds, setSelectedMaterialIds] = useState<number[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);

    // Stage 3: Pricing
    const [pricingConfigs, setPricingConfigs] = useState<PricingConfig[]>([]);

    // Form for submission
    const form = useForm<{
        items: Array<{
            material_item_id: number;
            unit_cost_override: number;
            is_locked: boolean;
        }>;
    }>({
        items: [],
    });

    // Fetch suppliers when dialog opens
    useEffect(() => {
        if (open && suppliers.length === 0) {
            fetchSuppliers();
        }
    }, [open]);

    const fetchSuppliers = async () => {
        setIsLoadingSuppliers(true);
        try {
            const response = await fetch('/suppliers/json');
            const data = await response.json();
            setSuppliers(data);
        } catch (error) {
            console.error('Failed to fetch suppliers:', error);
        } finally {
            setIsLoadingSuppliers(false);
        }
    };

    // Fetch materials when supplier changes or search changes
    const fetchMaterials = useCallback(async () => {
        if (!selectedSupplierId) return;

        setIsLoadingMaterials(true);
        try {
            const params = new URLSearchParams({
                supplier_id: selectedSupplierId,
                location_id: String(locationId),
                limit: '5000',
            });
            if (searchQuery) {
                params.append('search', searchQuery);
            }
            const response = await fetch(`/material-items?${params}`);
            const data = await response.json();
            // Filter out already attached materials
            const filtered = data.filter((m: MaterialItem) => !existingMaterialIds.includes(m.id));
            setMaterials(filtered);
        } catch (error) {
            console.error('Failed to fetch materials:', error);
        } finally {
            setIsLoadingMaterials(false);
        }
    }, [selectedSupplierId, searchQuery, locationId, existingMaterialIds]);

    useEffect(() => {
        if (currentStage === 2 && selectedSupplierId) {
            fetchMaterials();
        }
    }, [currentStage, selectedSupplierId, fetchMaterials]);

    // Debounce search
    useEffect(() => {
        if (currentStage !== 2) return;
        const timer = setTimeout(() => {
            fetchMaterials();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Initialize pricing configs when entering stage 3
    useEffect(() => {
        if (currentStage === 3) {
            const configs = selectedMaterialIds.map((id) => {
                const material = materials.find((m) => m.id === id);
                return {
                    material_item_id: id,
                    code: material?.code || '',
                    description: material?.description || '',
                    unit_cost_override: material?.unit_cost?.toString() || '0.00',
                    is_locked: false,
                };
            });
            setPricingConfigs(configs);
        }
    }, [currentStage, selectedMaterialIds, materials]);

    const resetDialog = () => {
        setCurrentStage(1);
        setSelectedSupplierId(null);
        setMaterials([]);
        setSelectedMaterialIds([]);
        setSearchQuery('');
        setPricingConfigs([]);
        form.reset();
    };

    const handleNext = () => {
        if (currentStage < 4) {
            setCurrentStage((s) => (s + 1) as 1 | 2 | 3 | 4);
        }
    };

    const handleBack = () => {
        if (currentStage > 1) {
            setCurrentStage((s) => (s - 1) as 1 | 2 | 3 | 4);
        }
    };

    const handleSubmit = () => {
        const items = pricingConfigs.map((config) => ({
            material_item_id: config.material_item_id,
            unit_cost_override: parseFloat(config.unit_cost_override) || 0,
            is_locked: config.is_locked,
        }));

        form.transform(() => ({ items }));
        form.post(route('locations.attachMaterials', { location: locationId }), {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                resetDialog();
            },
        });
    };

    const toggleMaterialSelection = (id: number) => {
        setSelectedMaterialIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
    };

    const updatePricingConfig = (materialId: number, field: 'unit_cost_override' | 'is_locked', value: string | boolean) => {
        setPricingConfigs((prev) => prev.map((config) => (config.material_item_id === materialId ? { ...config, [field]: value } : config)));
    };

    const selectedSupplier = suppliers.find((s) => s.id === Number(selectedSupplierId));

    const formatPrice = (price: string | number) => {
        const num = Number(price);
        // Show up to 6 decimals, but trim trailing zeros (minimum 2 decimals)
        const formatted = num.toFixed(6).replace(/\.?0+$/, '');
        const decimals = formatted.includes('.') ? formatted.split('.')[1].length : 0;
        return decimals < 2 ? num.toFixed(2) : formatted;
    };

    const canProceedStage1 = selectedSupplierId !== null;
    const canProceedStage2 = selectedMaterialIds.length > 0;
    const canProceedStage3 = pricingConfigs.length > 0 && pricingConfigs.every((c) => parseFloat(c.unit_cost_override) >= 0);

    return (
        <Dialog
            open={open}
            onOpenChange={(isOpen) => {
                setOpen(isOpen);
                if (!isOpen) resetDialog();
            }}
        >
            <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Materials
                </Button>
            </DialogTrigger>
            <DialogContent className="flex h-[calc(100vh-4rem)] w-[calc(100vw-4rem)] !max-w-[calc(100vw-4rem)] flex-col overflow-hidden">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle>Add Materials to Price List</DialogTitle>
                    {/* Step Indicator */}
                    <div className="flex items-center justify-center pt-4 pb-2">
                        {[
                            { step: 1, label: 'Supplier' },
                            { step: 2, label: 'Materials' },
                            { step: 3, label: 'Pricing' },
                            { step: 4, label: 'Confirm' },
                        ].map(({ step, label }, index) => {
                            const isActive = currentStage === step;
                            const isCompleted = currentStage > step;
                            return (
                                <div key={step} className="flex items-center">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all ${
                                                isCompleted
                                                    ? 'bg-emerald-600 text-white'
                                                    : isActive
                                                      ? 'bg-primary text-primary-foreground ring-primary/20 ring-4'
                                                      : 'bg-muted text-muted-foreground'
                                            }`}
                                        >
                                            {isCompleted ? <Check className="h-4 w-4" /> : `0${step}`}
                                        </div>
                                        <span
                                            className={`text-sm font-medium ${
                                                isActive ? 'text-foreground' : isCompleted ? 'text-emerald-600' : 'text-muted-foreground'
                                            }`}
                                        >
                                            {label}
                                        </span>
                                    </div>
                                    {index < 3 && (
                                        <ChevronRight
                                            className={`mx-3 h-4 w-4 ${currentStage > step ? 'text-emerald-600' : 'text-muted-foreground/50'}`}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-hidden">
                    {/* Stage 1: Supplier Selection */}
                    {currentStage === 1 && (
                        <div className="h-full space-y-4 p-1">
                            <div className="space-y-2">
                                <Label htmlFor="supplier">Select a supplier</Label>
                                {isLoadingSuppliers ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
                                    </div>
                                ) : (
                                    <Select value={selectedSupplierId || ''} onValueChange={setSelectedSupplierId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choose a supplier..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {suppliers.map((supplier) => (
                                                <SelectItem key={supplier.id} value={String(supplier.id)}>
                                                    <span className="font-medium">{supplier.code}</span>
                                                    <span className="text-muted-foreground ml-2">- {supplier.name}</span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                            {selectedSupplier && (
                                <div className="bg-muted/30 rounded-lg border p-4">
                                    <p className="text-sm font-medium">{selectedSupplier.name}</p>
                                    <p className="text-muted-foreground text-xs">Supplier Code: {selectedSupplier.code}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Stage 2: Material Selection */}
                    {currentStage === 2 && (
                        <div className="flex h-full flex-col gap-4">
                            <div className="relative flex-shrink-0">
                                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                                <Input
                                    placeholder="Search materials by code or description..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <div className="flex flex-shrink-0 items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                    {isLoadingMaterials ? 'Loading...' : `${materials.length} material(s) available`}
                                </span>
                                <Badge variant="secondary">{selectedMaterialIds.length} selected</Badge>
                            </div>
                            <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
                                {isLoadingMaterials ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
                                    </div>
                                ) : materials.length === 0 ? (
                                    <div className="text-muted-foreground flex flex-col items-center justify-center py-12">
                                        <Package className="mb-2 h-8 w-8 opacity-40" />
                                        <p className="text-sm">No materials found</p>
                                        <p className="text-xs">Try a different search term</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1 p-2">
                                        {materials.map((material) => {
                                            const isSelected = selectedMaterialIds.includes(material.id);
                                            return (
                                                <Label
                                                    key={material.id}
                                                    className={`hover:bg-accent/50 flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 transition-colors ${
                                                        isSelected ? 'border-blue-600 bg-blue-50 dark:border-blue-900 dark:bg-blue-950' : ''
                                                    }`}
                                                >
                                                    <div className="grid min-w-0 flex-1 gap-1 font-normal">
                                                        <div className="flex items-center gap-2">
                                                            <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{material.code}</code>
                                                            {!!material.is_favourite && (
                                                                <Badge variant="outline" className="text-[10px]">
                                                                    Favorite
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-muted-foreground truncate text-sm">{material.description}</p>
                                                        {material.unit_cost !== undefined && (
                                                            <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                                                Base price: ${Number(material.unit_cost).toFixed(2)}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={() => toggleMaterialSelection(material.id)}
                                                        className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
                                                    />
                                                </Label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Stage 3: Pricing Configuration */}
                    {currentStage === 3 && (
                        <div className="flex h-full flex-col gap-4">
                            <p className="text-muted-foreground flex-shrink-0 text-sm">
                                Set the project-specific price and lock status for each material.
                            </p>
                            <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[120px]">Code</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead className="w-[120px]">Unit Cost</TableHead>
                                            <TableHead className="w-[80px] text-center">Lock</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pricingConfigs.map((config) => (
                                            <TableRow key={config.material_item_id}>
                                                <TableCell>
                                                    <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{config.code}</code>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground max-w-[200px] truncate text-sm">
                                                    {config.description}
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        step="0.000001"
                                                        min="0"
                                                        value={config.unit_cost_override}
                                                        onChange={(e) =>
                                                            updatePricingConfig(config.material_item_id, 'unit_cost_override', e.target.value)
                                                        }
                                                        className="h-8 w-28"
                                                    />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Switch
                                                        checked={config.is_locked}
                                                        onCheckedChange={(checked) =>
                                                            updatePricingConfig(config.material_item_id, 'is_locked', checked)
                                                        }
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}

                    {/* Stage 4: Review & Confirm */}
                    {currentStage === 4 && (
                        <div className="flex h-full flex-col gap-4">
                            <div className="bg-muted/30 flex-shrink-0 space-y-2 rounded-lg border p-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground text-sm">Supplier</span>
                                    <span className="font-medium">{selectedSupplier?.name}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground text-sm">Materials to add</span>
                                    <Badge>{pricingConfigs.length}</Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground text-sm">Locked items</span>
                                    <Badge variant="outline">
                                        <Lock className="mr-1 h-3 w-3" />
                                        {pricingConfigs.filter((c) => c.is_locked).length}
                                    </Badge>
                                </div>
                            </div>
                            <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Code</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead className="text-right">Price</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pricingConfigs.map((config) => (
                                            <TableRow key={config.material_item_id}>
                                                <TableCell>
                                                    <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{config.code}</code>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground max-w-[200px] truncate text-sm">
                                                    {config.description}
                                                </TableCell>
                                                <TableCell className="text-right font-medium text-emerald-600 dark:text-emerald-400">
                                                    ${formatPrice(config.unit_cost_override)}
                                                </TableCell>
                                                <TableCell>{config.is_locked && <Lock className="h-4 w-4 text-amber-500" />}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            {pricingConfigs.some((c) => parseFloat(c.unit_cost_override) === 0) && (
                                <div className="flex-shrink-0 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                                    Some items have a price of $0.00. Are you sure you want to continue?
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="flex-shrink-0 gap-2 sm:gap-0">
                    {currentStage > 1 && (
                        <Button variant="outline" onClick={handleBack} disabled={form.processing}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back
                        </Button>
                    )}
                    {currentStage < 4 ? (
                        <Button
                            onClick={handleNext}
                            disabled={
                                (currentStage === 1 && !canProceedStage1) ||
                                (currentStage === 2 && !canProceedStage2) ||
                                (currentStage === 3 && !canProceedStage3)
                            }
                        >
                            Next
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    ) : (
                        <Button onClick={handleSubmit} disabled={form.processing}>
                            {form.processing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Adding...
                                </>
                            ) : (
                                <>
                                    <Check className="mr-2 h-4 w-4" />
                                    Add {pricingConfigs.length} Material(s)
                                </>
                            )}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
