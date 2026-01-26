import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';
import React, { useEffect } from 'react';
import { toast } from 'sonner';

type SupplierCategory = {
    id: number;
    code: string;
    name: string;
    supplier?: {
        id: number;
        code: string;
        name: string;
    };
};

type Supplier = {
    id: number;
    code: string;
    name: string;
};

export default function EditSupplierCategory() {
    const { category, flash, suppliers } = usePage<{
        category: SupplierCategory | null;
        suppliers: Supplier[];
        flash: { success: string; error: string };
    }>().props;

    const form = useForm({
        code: category?.code || '',
        name: category?.name || '',
        supplier_id: category?.supplier?.id || '',
    });

    const handleSubmit = () => {
        if (!category) {
            form.post('/supplier-categories/store', {
                onSuccess: () => {
                    if (flash.success) {
                        toast.success(flash.success);
                    }
                },
                onError: () => {
                    if (flash.error) {
                        toast.error(flash.error);
                    }
                },
            });
            return;
        }

        form.put(`/supplier-categories/${category.id}`, {
            onSuccess: () => {
                if (flash.success) {
                    toast.success(flash.success);
                }
            },
            onError: () => {
                if (flash.error) {
                    toast.error(flash.error);
                }
            },
        });
    };

    const handleDelete = () => {
        if (confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
            form.delete(`/supplier-categories/${category?.id}`, {
                onSuccess: () => {
                    toast.success('Category deleted successfully');
                },
                onError: () => {
                    toast.error('Failed to delete category');
                },
            });
        }
    };

    const [mode, setMode] = React.useState<'create' | 'edit'>(category ? 'edit' : 'create');

    useEffect(() => {
        setMode(category ? 'edit' : 'create');
    }, [category]);

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: 'Supplier Categories',
            href: '/supplier-categories',
        },
        {
            title: mode === 'edit' ? 'Edit Category' : 'Create Category',
            href: mode === 'edit' ? `/supplier-categories/${category?.id}/edit` : `/supplier-categories/create`,
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={mode === 'edit' ? 'Edit Supplier Category' : 'Create Supplier Category'} />
            <div>
                <div className="flex flex-col items-center justify-center">
                    <Card className="m-2 w-full max-w-md p-4">
                        <Label>Code</Label>
                        <Input value={form.data.code} onChange={(e) => form.setData('code', e.target.value)} />

                        <Label>Name</Label>
                        <Input value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />

                        <Label>Supplier</Label>
                        <Select value={String(form.data.supplier_id)} onValueChange={(value) => form.setData('supplier_id', value)}>
                            <SelectTrigger>
                                {suppliers.find((s) => s.id.toString() === String(form.data.supplier_id))?.name || 'Select a supplier'}
                            </SelectTrigger>
                            <SelectContent>
                                {suppliers.map((supplier) => (
                                    <SelectItem key={supplier.id} value={supplier.id.toString()}>
                                        {supplier.code} - {supplier.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <div className="mt-4 flex items-center justify-between">
                            <div>
                                <Button onClick={handleSubmit}>{mode === 'edit' ? 'Update' : 'Create'}</Button>
                                <Link href="/supplier-categories">
                                    <Button variant="secondary" className="ml-2">
                                        Cancel
                                    </Button>
                                </Link>
                            </div>
                            {mode === 'edit' && (
                                <div>
                                    <Button variant="destructive" onClick={handleDelete} className="flex items-center">
                                        <Trash2 />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
