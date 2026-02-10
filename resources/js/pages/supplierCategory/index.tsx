import InputSearch from '@/components/inputSearch';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { CirclePlus, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Supplier Categories', href: '/supplier-categories' }];

type SupplierCategory = {
    id: number;
    code: string;
    name: string;
    supplier: { id: number; code: string; name: string };
};

export default function SupplierCategoryList() {
    const { categories, flash } = usePage<{ categories: SupplierCategory[]; flash: { success: string; error: string } }>().props;
    const [searchQuery, setSearchQuery] = useState('');

    const filteredCategories = useMemo(() => {
        if (!searchQuery) return categories;
        const query = searchQuery.toLowerCase();
        return categories.filter((c) => c.code.toLowerCase().includes(query) || c.name.toLowerCase().includes(query));
    }, [categories, searchQuery]);

    useEffect(() => {
        if (flash.success) toast.success(flash.success);
    }, [flash.success]);

    const handleDelete = (category: SupplierCategory) => {
        if (!confirm(`Are you sure you want to delete "${category.code}"?`)) return;
        router.delete(`/supplier-categories/${category.id}`, {
            onSuccess: () => toast.success('Category deleted successfully.'),
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Supplier Categories" />

            <div className="flex flex-col gap-4 p-3 sm:p-4">
                {/* Toolbar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-xs">
                        <InputSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchName="code or name" />
                    </div>
                    <Link href="/supplier-categories/create">
                        <Button size="sm" className="gap-2">
                            <CirclePlus className="h-4 w-4" />
                            Add Category
                        </Button>
                    </Link>
                </div>

                {/* Mobile card layout */}
                <div className="flex flex-col gap-2 sm:hidden">
                    {!filteredCategories.length ? (
                        <div className="text-muted-foreground py-12 text-center text-sm">
                            {searchQuery ? `No categories match "${searchQuery}"` : 'No categories found.'}
                        </div>
                    ) : (
                        filteredCategories.map((cat) => (
                            <div key={cat.id} className="rounded-lg border p-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium">{cat.code}</p>
                                        <p className="text-muted-foreground truncate text-xs">{cat.name}</p>
                                    </div>
                                    <div className="flex gap-1">
                                        <Link href={`/supplier-categories/${cat.id}/edit`}>
                                            <Button variant="ghost" size="icon" className="h-7 w-7">
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                        </Link>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(cat)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="text-muted-foreground mt-1.5 text-[11px]">
                                    Supplier: {cat.supplier?.code} - {cat.supplier?.name}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Desktop table */}
                <div className="hidden overflow-hidden rounded-lg border sm:block">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="px-3">ID</TableHead>
                                <TableHead className="px-3">Code</TableHead>
                                <TableHead className="px-3">Name</TableHead>
                                <TableHead className="px-3">Supplier Code</TableHead>
                                <TableHead className="px-3">Supplier Name</TableHead>
                                <TableHead className="w-[100px] px-3">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredCategories.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center">
                                        <div className="text-muted-foreground flex flex-col items-center gap-2">
                                            <p>No categories found</p>
                                            {searchQuery && (
                                                <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
                                                    Clear search
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredCategories.map((cat) => (
                                    <TableRow key={cat.id}>
                                        <TableCell className="px-3">{cat.id}</TableCell>
                                        <TableCell className="px-3">{cat.code}</TableCell>
                                        <TableCell className="px-3">{cat.name}</TableCell>
                                        <TableCell className="px-3">{cat.supplier?.code}</TableCell>
                                        <TableCell className="px-3">{cat.supplier?.name}</TableCell>
                                        <TableCell className="px-3">
                                            <div className="flex gap-1">
                                                <Link href={`/supplier-categories/${cat.id}/edit`}>
                                                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                                                        Edit
                                                    </Button>
                                                </Link>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(cat)}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </AppLayout>
    );
}
