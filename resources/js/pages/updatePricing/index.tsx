import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { ArrowDown, ArrowUp, Loader2, Minus, RefreshCw } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Update Pricing',
        href: '/update-pricing',
    },
];

type Supplier = {
    id: number;
    code: string;
    name: string;
};

type SupplierCategory = {
    id: number;
    code: string;
    name: string;
    supplier_id: number;
};

type PreviewItem = {
    id: number;
    code: string;
    description: string;
    current_price: number;
    new_price: number;
    difference: number;
};

export default function UpdatePricing() {
    const { suppliers, categories, flash } = usePage<{
        suppliers: Supplier[];
        categories: SupplierCategory[];
        flash: { success?: string; error?: string };
    }>().props;

    const [supplierId, setSupplierId] = useState<string>('');
    const [categoryId, setCategoryId] = useState<string>('');
    const [adjustmentType, setAdjustmentType] = useState<'percentage' | 'fixed'>('percentage');
    const [adjustmentValue, setAdjustmentValue] = useState<string>('');
    const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [isApplying, setIsApplying] = useState(false);

    // Filter categories by selected supplier
    const filteredCategories = useMemo(() => {
        if (!supplierId) return [];
        return categories.filter((c) => c.supplier_id === Number(supplierId));
    }, [categories, supplierId]);

    // Reset category when supplier changes
    useEffect(() => {
        setCategoryId('');
        setPreviewItems([]);
    }, [supplierId]);

    useEffect(() => {
        if (flash.success) {
            toast.success(flash.success);
            setPreviewItems([]);
            setAdjustmentValue('');
        }
        if (flash.error) {
            toast.error(flash.error);
        }
    }, [flash]);

    const handlePreview = async () => {
        if (!supplierId || !adjustmentValue) {
            toast.error('Please select a supplier and enter an adjustment value');
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch('/update-pricing/preview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    supplier_id: supplierId,
                    supplier_category_id: categoryId || null,
                    adjustment_type: adjustmentType,
                    adjustment_value: adjustmentValue,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to fetch preview');
            }

            const data = await response.json();
            setPreviewItems(data.items);

            if (data.items.length === 0) {
                toast.info('No items found matching the criteria');
            }
        } catch (error) {
            toast.error('Failed to preview changes');
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleApply = () => {
        if (previewItems.length === 0) {
            toast.error('No items to update');
            return;
        }
        setShowConfirmDialog(true);
    };

    const confirmApply = () => {
        setIsApplying(true);
        router.post(
            '/update-pricing/apply',
            {
                supplier_id: supplierId,
                supplier_category_id: categoryId || null,
                adjustment_type: adjustmentType,
                adjustment_value: adjustmentValue,
            },
            {
                onFinish: () => {
                    setIsApplying(false);
                    setShowConfirmDialog(false);
                },
            },
        );
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: 'AUD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 6,
        }).format(value);
    };

    const selectedSupplier = suppliers.find((s) => s.id === Number(supplierId));
    const selectedCategory = categories.find((c) => c.id === Number(categoryId));

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Update Pricing" />

            <div className="m-4 space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Update Material Pricing</CardTitle>
                        <CardDescription>
                            Bulk update pricing for material items by supplier and category. All changes will be logged.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <div className="space-y-2">
                                <Label>Supplier *</Label>
                                <Select value={supplierId || 'none'} onValueChange={(value) => setSupplierId(value === 'none' ? '' : value)}>
                                    <SelectTrigger>
                                        {selectedSupplier ? `${selectedSupplier.code} - ${selectedSupplier.name}` : 'Select a supplier'}
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none" disabled>
                                            Select a supplier
                                        </SelectItem>
                                        {suppliers.map((supplier) => (
                                            <SelectItem key={supplier.id} value={supplier.id.toString()}>
                                                {supplier.code} - {supplier.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Category (optional)</Label>
                                <Select
                                    value={categoryId || 'all'}
                                    onValueChange={(value) => setCategoryId(value === 'all' ? '' : value)}
                                    disabled={!supplierId}
                                >
                                    <SelectTrigger>
                                        {selectedCategory ? `${selectedCategory.code} - ${selectedCategory.name}` : 'All Categories'}
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Categories</SelectItem>
                                        {filteredCategories.map((category) => (
                                            <SelectItem key={category.id} value={category.id.toString()}>
                                                {category.code} - {category.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Adjustment Type</Label>
                                <Select
                                    value={adjustmentType}
                                    onValueChange={(value) => setAdjustmentType(value as 'percentage' | 'fixed')}
                                >
                                    <SelectTrigger>{adjustmentType === 'percentage' ? 'Percentage (%)' : 'Fixed Amount ($)'}</SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                                        <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Adjustment Value *</Label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        step="0.01"
                                        placeholder={adjustmentType === 'percentage' ? 'e.g., 5 for 5% increase' : 'e.g., 1.50'}
                                        value={adjustmentValue}
                                        onChange={(e) => setAdjustmentValue(e.target.value)}
                                        className="pr-8"
                                    />
                                    <span className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-500">
                                        {adjustmentType === 'percentage' ? '%' : '$'}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500">Use negative values for price decrease</p>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button onClick={handlePreview} disabled={isLoading || !supplierId || !adjustmentValue}>
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Loading...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        Preview Changes
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {previewItems.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Preview ({previewItems.length} items)</CardTitle>
                            <CardDescription>Review the pricing changes before applying them.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="max-h-96 overflow-auto rounded border">
                                <Table>
                                    <TableHeader className="bg-muted sticky top-0">
                                        <TableRow>
                                            <TableHead>Code</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead className="text-right">Current Price</TableHead>
                                            <TableHead className="text-right">New Price</TableHead>
                                            <TableHead className="text-right">Difference</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {previewItems.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-mono">{item.code}</TableCell>
                                                <TableCell className="max-w-xs truncate">{item.description}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(item.current_price)}</TableCell>
                                                <TableCell className="text-right font-medium">{formatCurrency(item.new_price)}</TableCell>
                                                <TableCell className="text-right">
                                                    <span
                                                        className={`inline-flex items-center ${
                                                            item.difference > 0
                                                                ? 'text-red-600'
                                                                : item.difference < 0
                                                                  ? 'text-green-600'
                                                                  : 'text-gray-500'
                                                        }`}
                                                    >
                                                        {item.difference > 0 ? (
                                                            <ArrowUp className="mr-1 h-3 w-3" />
                                                        ) : item.difference < 0 ? (
                                                            <ArrowDown className="mr-1 h-3 w-3" />
                                                        ) : (
                                                            <Minus className="mr-1 h-3 w-3" />
                                                        )}
                                                        {formatCurrency(Math.abs(item.difference))}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="mt-4 flex justify-end">
                                <Button onClick={handleApply} variant="default" disabled={isApplying}>
                                    Apply Changes to {previewItems.length} Items
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Pricing Update</AlertDialogTitle>
                        <AlertDialogDescription>
                            You are about to update pricing for <strong>{previewItems.length}</strong> items.
                            <br />
                            <br />
                            <strong>Supplier:</strong> {selectedSupplier?.name}
                            <br />
                            <strong>Category:</strong> {selectedCategory?.name || 'All Categories'}
                            <br />
                            <strong>Adjustment:</strong>{' '}
                            {adjustmentType === 'percentage'
                                ? `${adjustmentValue}%`
                                : formatCurrency(parseFloat(adjustmentValue || '0'))}
                            <br />
                            <br />
                            This action will be logged and cannot be automatically undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isApplying}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmApply} disabled={isApplying}>
                            {isApplying ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Applying...
                                </>
                            ) : (
                                'Confirm Update'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}
