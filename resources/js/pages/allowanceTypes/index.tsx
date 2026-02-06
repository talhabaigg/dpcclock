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
import { AllowanceType, allowanceTypesColumns } from './columns';
import { DataTable } from './data-table';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Allowance Types',
        href: '/allowance-types',
    },
];

interface Props {
    allowanceTypes: AllowanceType[];
}

export default function AllowanceTypesIndex({ allowanceTypes }: Props) {
    const { flash } = usePage<{ flash: { success?: string; error?: string } }>().props;

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedAllowance, setSelectedAllowance] = useState<AllowanceType | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        description: '',
        default_rate: '',
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
        setSelectedAllowance(null);
        setFormData({
            name: '',
            code: '',
            description: '',
            default_rate: '',
            is_active: true,
            sort_order: allowanceTypes.length + 1,
        });
        setIsDialogOpen(true);
    };

    const openEditDialog = (allowance: AllowanceType) => {
        setSelectedAllowance(allowance);
        setFormData({
            name: allowance.name,
            code: allowance.code,
            description: allowance.description || '',
            default_rate: allowance.default_rate || '',
            is_active: allowance.is_active,
            sort_order: allowance.sort_order,
        });
        setIsDialogOpen(true);
    };

    const openDeleteDialog = (allowance: AllowanceType) => {
        setSelectedAllowance(allowance);
        setIsDeleteDialogOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const data = {
            ...formData,
            default_rate: formData.default_rate ? parseFloat(formData.default_rate) : null,
        };

        if (selectedAllowance) {
            router.put(`/allowance-types/${selectedAllowance.id}`, data, {
                onSuccess: () => {
                    setIsDialogOpen(false);
                    setIsSubmitting(false);
                },
                onError: () => setIsSubmitting(false),
            });
        } else {
            router.post('/allowance-types', data, {
                onSuccess: () => {
                    setIsDialogOpen(false);
                    setIsSubmitting(false);
                },
                onError: () => setIsSubmitting(false),
            });
        }
    };

    const handleDelete = () => {
        if (!selectedAllowance) return;
        setIsSubmitting(true);

        router.delete(`/allowance-types/${selectedAllowance.id}`, {
            onSuccess: () => {
                setIsDeleteDialogOpen(false);
                setIsSubmitting(false);
            },
            onError: () => setIsSubmitting(false),
        });
    };

    // Add action column to columns
    const columnsWithActions = [
        ...allowanceTypesColumns,
        {
            id: 'actions',
            header: '',
            cell: ({ row }: { row: { original: AllowanceType } }) => (
                <div className="flex justify-end gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(row.original);
                        }}
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                            e.stopPropagation();
                            openDeleteDialog(row.original);
                        }}
                    >
                        <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Allowance Types" />
            <div className="mt-2 mr-2 flex justify-end gap-2">
                <Button onClick={openCreateDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Allowance Type
                </Button>
            </div>
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-2">
                <DataTable columns={columnsWithActions} data={allowanceTypes} onRowClick={openEditDialog} />
            </div>

            {/* Create/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{selectedAllowance ? 'Edit Allowance Type' : 'Create Allowance Type'}</DialogTitle>
                        <DialogDescription>
                            {selectedAllowance ? 'Update the allowance type details below.' : 'Enter the details for the new allowance type.'}
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
                                    placeholder="e.g. Leading Hands Allowance"
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="code">Code *</Label>
                                <Input
                                    id="code"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    placeholder="e.g. LEADING_HANDS"
                                    required
                                />
                                <p className="text-muted-foreground text-sm">Unique identifier, uppercase with underscores</p>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Optional description of this allowance"
                                    rows={2}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="default_rate">Default Rate ($/hr)</Label>
                                <Input
                                    id="default_rate"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={formData.default_rate}
                                    onChange={(e) => setFormData({ ...formData, default_rate: e.target.value })}
                                    placeholder="e.g. 1.42"
                                />
                                <p className="text-muted-foreground text-sm">Default hourly rate when adding this allowance</p>
                            </div>
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
                                {isSubmitting ? 'Saving...' : selectedAllowance ? 'Update' : 'Create'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Delete Allowance Type</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete "{selectedAllowance?.name}"? This action cannot be undone.
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
