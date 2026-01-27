import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { oncostColumns, Oncost } from './columns';
import { DataTable } from './data-table';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Oncosts',
        href: '/oncosts',
    },
];

interface Props {
    oncosts: Oncost[];
}

// Core oncosts that cannot be deleted
const CORE_ONCOSTS = ['SUPER', 'BERT', 'BEWT', 'CIPQ', 'PAYROLL_TAX', 'WORKCOVER'];

export default function OncostsIndex({ oncosts }: Props) {
    const { flash } = usePage<{ flash: { success?: string; error?: string } }>().props;

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedOncost, setSelectedOncost] = useState<Oncost | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        description: '',
        weekly_amount: '',
        is_percentage: false,
        percentage_rate: '',
        applies_to_overtime: false,
        is_active: true,
        sort_order: 0,
    });

    useEffect(() => {
        if (flash.success) {
            toast.success(flash.success);
        }
        if (flash.error) {
            toast.error(flash.error);
        }
    }, [flash.success, flash.error]);

    const openCreateDialog = () => {
        setSelectedOncost(null);
        setFormData({
            name: '',
            code: '',
            description: '',
            weekly_amount: '',
            is_percentage: false,
            percentage_rate: '',
            applies_to_overtime: false,
            is_active: true,
            sort_order: oncosts.length + 1,
        });
        setIsDialogOpen(true);
    };

    const openEditDialog = (oncost: Oncost) => {
        setSelectedOncost(oncost);
        setFormData({
            name: oncost.name,
            code: oncost.code,
            description: oncost.description || '',
            weekly_amount: oncost.weekly_amount || '',
            is_percentage: oncost.is_percentage,
            percentage_rate: oncost.percentage_rate || '',
            applies_to_overtime: oncost.applies_to_overtime,
            is_active: oncost.is_active,
            sort_order: oncost.sort_order,
        });
        setIsDialogOpen(true);
    };

    const openDeleteDialog = (oncost: Oncost) => {
        setSelectedOncost(oncost);
        setIsDeleteDialogOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const data = {
            ...formData,
            weekly_amount: formData.is_percentage ? 0 : (formData.weekly_amount ? parseFloat(formData.weekly_amount) : 0),
            percentage_rate: formData.is_percentage && formData.percentage_rate ? parseFloat(formData.percentage_rate) / 100 : null,
        };

        if (selectedOncost) {
            router.put(`/oncosts/${selectedOncost.id}`, data, {
                onSuccess: () => {
                    setIsDialogOpen(false);
                    setIsSubmitting(false);
                },
                onError: () => setIsSubmitting(false),
            });
        } else {
            router.post('/oncosts', data, {
                onSuccess: () => {
                    setIsDialogOpen(false);
                    setIsSubmitting(false);
                },
                onError: () => setIsSubmitting(false),
            });
        }
    };

    const handleDelete = () => {
        if (!selectedOncost) return;
        setIsSubmitting(true);

        router.delete(`/oncosts/${selectedOncost.id}`, {
            onSuccess: () => {
                setIsDeleteDialogOpen(false);
                setIsSubmitting(false);
            },
            onError: () => setIsSubmitting(false),
        });
    };

    // Calculate hourly rate preview
    const hourlyRatePreview = formData.weekly_amount && !formData.is_percentage
        ? (parseFloat(formData.weekly_amount) / 40).toFixed(4)
        : null;

    // Check if selected oncost is a core oncost
    const isCore = selectedOncost && CORE_ONCOSTS.includes(selectedOncost.code);

    // Add action column to columns
    const columnsWithActions = [
        ...oncostColumns,
        {
            id: 'actions',
            header: '',
            cell: ({ row }: { row: { original: Oncost } }) => {
                const isCoreOncost = CORE_ONCOSTS.includes(row.original.code);
                return (
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEditDialog(row.original); }}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                        {!isCoreOncost && (
                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openDeleteDialog(row.original); }}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                        )}
                    </div>
                );
            },
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Oncosts" />
            <div className="mt-2 mr-2 flex justify-end gap-2">
                <Button onClick={openCreateDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Oncost
                </Button>
            </div>
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-2">
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
                    <h3 className="font-medium text-blue-900 dark:text-blue-100">About Oncosts</h3>
                    <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                        Oncosts are additional employment costs calculated on top of base wages. Fixed oncosts are converted to hourly rates
                        (weekly amount / 40 hours) for accurate calculation with decimal headcount and overtime. Percentage-based oncosts
                        (like Payroll Tax) are calculated on the taxable wage base.
                    </p>
                </div>
                <DataTable columns={columnsWithActions} data={oncosts} onRowClick={openEditDialog} />
            </div>

            {/* Create/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{selectedOncost ? 'Edit Oncost' : 'Create Oncost'}</DialogTitle>
                        <DialogDescription>
                            {selectedOncost
                                ? 'Update the oncost details below.'
                                : 'Enter the details for the new oncost.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Name *</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Superannuation"
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="code">Code *</Label>
                                <Input
                                    id="code"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                                    placeholder="e.g. SUPER"
                                    required
                                    disabled={isCore}
                                />
                                {isCore && (
                                    <p className="text-sm text-amber-600">Code cannot be changed for core oncosts</p>
                                )}
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Optional description"
                                    rows={2}
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <Switch
                                    id="is_percentage"
                                    checked={formData.is_percentage}
                                    onCheckedChange={(checked) => setFormData({ ...formData, is_percentage: checked })}
                                />
                                <Label htmlFor="is_percentage">Percentage-based oncost</Label>
                            </div>

                            {formData.is_percentage ? (
                                <div className="grid gap-2">
                                    <Label htmlFor="percentage_rate">Percentage Rate (%) *</Label>
                                    <Input
                                        id="percentage_rate"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="100"
                                        value={formData.percentage_rate}
                                        onChange={(e) => setFormData({ ...formData, percentage_rate: e.target.value })}
                                        placeholder="e.g. 4.95"
                                        required
                                    />
                                    <p className="text-sm text-muted-foreground">
                                        Applied to taxable wage base (marked-up wages + super)
                                    </p>
                                </div>
                            ) : (
                                <div className="grid gap-2">
                                    <Label htmlFor="weekly_amount">Weekly Amount ($) *</Label>
                                    <Input
                                        id="weekly_amount"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.weekly_amount}
                                        onChange={(e) => setFormData({ ...formData, weekly_amount: e.target.value })}
                                        placeholder="e.g. 310.00"
                                        required
                                    />
                                    {hourlyRatePreview && (
                                        <p className="text-sm text-muted-foreground">
                                            Hourly rate: ${hourlyRatePreview}/hr (weekly / 40)
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="flex items-center gap-2">
                                <Switch
                                    id="applies_to_overtime"
                                    checked={formData.applies_to_overtime}
                                    onCheckedChange={(checked) => setFormData({ ...formData, applies_to_overtime: checked })}
                                />
                                <Label htmlFor="applies_to_overtime">Applies to overtime hours</Label>
                            </div>
                            <p className="text-sm text-muted-foreground -mt-2">
                                If enabled, this oncost will be calculated for overtime hours as well as ordinary hours
                            </p>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="sort_order">Sort Order</Label>
                                    <Input
                                        id="sort_order"
                                        type="number"
                                        min="0"
                                        value={formData.sort_order}
                                        onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="flex items-center justify-end gap-2 pt-6">
                                    <Label htmlFor="is_active">Active</Label>
                                    <Switch
                                        id="is_active"
                                        checked={formData.is_active}
                                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                                    />
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Saving...' : selectedOncost ? 'Update' : 'Create'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Delete Oncost</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete "{selectedOncost?.name}"? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="button" variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
                            {isSubmitting ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
