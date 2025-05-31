import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { CostCode } from '../purchasing/types';
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Items',
        href: '/material-items/all',
    },
    {
        title: 'Edit Material Item',
        href: '/material-items/edit',
    },
];

type MaterialItem = {
    id: number;
    code: string;
    description: string;
    unit_cost: number;
    cost_code?: {
        id: number;
        code: string;
    };
    supplier?: {
        id: number;
        code: string;
    };
};

type Supplier = {
    id: number;
    code: string;
    name: string;
};

export default function EditMaterialItem() {
    const { item, flash, costCodes, suppliers } = usePage<{
        item: MaterialItem;
        costCodes: CostCode[];
        suppliers: Supplier[];
        flash: { success: string; error: string };
    }>().props;
    const form = useForm({
        code: item.code,
        description: item.description,
        unit_cost: item.unit_cost,
        cost_code_id: item.cost_code?.id || '',
        supplier_id: item.supplier?.id || '',
    });

    const handleSubmit = () => {
        form.put(`/material-items/${item.id}`, {
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
        if (confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
            form.delete(`/material-items/${item.id}`, {
                onSuccess: () => {
                    toast.success('Item deleted successfully');
                },
                onError: () => {
                    toast.error('Failed to delete item');
                },
            });
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Edit Material Item" />
            <div className="flex flex-col items-center justify-center">
                <Card className="m-2 w-full max-w-md p-4">
                    <div className="mb-4 flex items-center justify-between">
                        <Link href={`/material-items/${item.id}/previous`}>
                            <Button variant="outline" size="icon">
                                <ChevronLeft />
                            </Button>
                        </Link>
                        <Link href={`/material-items/${item.id}/next`}>
                            <Button variant="outline" size="icon">
                                <ChevronRight />
                            </Button>
                        </Link>
                        {/* <Link href={`/material-items/${item.id === maxItems ? 1 : item.id + 1}/edit`}>
                            <Button variant="outline" size="icon">
                                <ChevronRight />
                            </Button>
                        </Link> */}
                    </div>

                    <Label>Code (non-editable)</Label>
                    <Input value={form.data.code} readOnly onChange={(e) => form.setData('code', e.target.value)} />
                    <Label>Description</Label>
                    <Input value={form.data.description} onChange={(e) => form.setData('description', e.target.value)} />
                    <Label>Unit Cost</Label>
                    <Input
                        type="number"
                        step="0.000001"
                        value={form.data.unit_cost}
                        onChange={(e) => {
                            const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            form.setData('unit_cost', value);
                        }}
                    />
                    <Label>Cost Code</Label>
                    <Select value={String(form.data.cost_code_id)} onValueChange={(value) => form.setData('cost_code_id', value)}>
                        <SelectTrigger>
                            {costCodes.find((cc) => cc.id.toString() === String(form.data.cost_code_id))?.code || 'Select a cost code'}
                        </SelectTrigger>
                        <SelectContent>
                            {costCodes.map((costCode) => (
                                <SelectItem key={costCode.id} value={costCode.id.toString()}>
                                    {costCode.code}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Label>Supplier</Label>
                    <Select value={String(form.data.supplier_id)} onValueChange={(value) => form.setData('supplier_id', value)}>
                        <SelectTrigger>
                            {suppliers.find((cc) => cc.id.toString() === String(form.data.supplier_id))?.code || 'Select a cost code'}
                        </SelectTrigger>
                        <SelectContent>
                            {suppliers.map((supplier) => (
                                <SelectItem key={supplier.id} value={supplier.id.toString()}>
                                    {supplier.code}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="flex items-center justify-between">
                        <div>
                            <Button onClick={handleSubmit}>Update</Button>
                            <Link href="/material-items/all">
                                <Button variant="secondary" className="ml-2">
                                    Cancel
                                </Button>
                            </Link>
                        </div>
                        <div>
                            <Button variant="destructive" onClick={handleDelete} className="flex items-center">
                                {' '}
                                <Trash2 />
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>
        </AppLayout>
    );
}
