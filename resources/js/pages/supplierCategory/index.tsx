import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { darkTheme, myTheme } from '@/themes/ag-grid-theme';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { CirclePlus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
ModuleRegistry.registerModules([AllCommunityModule]);

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Supplier Categories',
        href: '/supplier-categories',
    },
];

type SupplierCategory = {
    id: number;
    code: string;
    name: string;
    supplier: {
        id: number;
        code: string;
        name: string;
    };
};

export default function SupplierCategoryList() {
    const { categories, flash } = usePage<{ categories: SupplierCategory[]; flash: { success: string; error: string } }>().props;
    const isDarkMode = document.documentElement.classList.contains('dark');
    const appliedTheme = isDarkMode ? darkTheme : myTheme;
    const gridRef = useRef<AgGridReact>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredCategories = useMemo(() => {
        return categories.filter(
            (category) =>
                category.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                category.name.toLowerCase().includes(searchQuery.toLowerCase()),
        );
    }, [categories, searchQuery]);

    const [selectedCount, setSelectedCount] = useState(0);

    const rowSelection = useMemo(() => {
        return {
            mode: 'multiRow',
            selectAll: 'filtered',
            enableClickSelection: true,
        };
    }, []);

    const deleteSelectedRow = () => {
        const selectedNodes = gridRef.current?.api.getSelectedNodes();
        if (selectedNodes && selectedNodes.length > 0) {
            if (!confirm('Are you sure you want to delete the selected categories?')) {
                return;
            }

            selectedNodes.forEach((node) => {
                router.delete(`/supplier-categories/${node.data.id}`, {
                    onSuccess: () => {
                        toast.success('Category deleted successfully.');
                    },
                });
            });
        } else {
            toast.error('No rows selected for deletion.');
        }
    };

    const handleSelectionChanged = () => {
        const selectedNodes = gridRef.current?.api.getSelectedNodes() ?? [];
        setSelectedCount(selectedNodes.length);
    };

    useEffect(() => {
        if (flash.success) {
            toast.success(flash.success);
        }
    }, [flash.success]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Supplier Categories" />
            <div className="m-2 flex flex-col items-center gap-2 sm:flex-row md:justify-between">
                <div className="relative w-full sm:w-1/4">
                    <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                        type="text"
                        placeholder="Search by code or name"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <div className="mr-auto flex w-full items-center gap-4 sm:w-auto">
                    <Button variant="destructive" onClick={deleteSelectedRow} className="rounded-lg">
                        <Trash2 />
                    </Button>
                    <span className="text-sm text-gray-600">{selectedCount} Items selected</span>
                </div>

                <div className="m-2 flex w-full items-center gap-2 sm:w-auto">
                    <Link href="/supplier-categories/create">
                        <Button>
                            <CirclePlus /> Add
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="ag-theme-alpine m-2 h-full max-w-sm rounded-xl border-0 p-0 sm:max-w-full sm:pr-4">
                <AgGridReact
                    ref={gridRef}
                    rowData={filteredCategories}
                    theme={appliedTheme}
                    // @ts-expect-error AG Grid type mismatch
                    rowSelection={rowSelection}
                    enableCellTextSelection={true}
                    onSelectionChanged={handleSelectionChanged}
                    columnDefs={[
                        { field: 'id', headerName: 'ID', maxWidth: 80 },
                        { field: 'code', headerName: 'Code' },
                        { field: 'name', headerName: 'Name' },
                        { field: 'supplier.code', headerName: 'Supplier Code' },
                        { field: 'supplier.name', headerName: 'Supplier Name' },
                        {
                            field: 'actions',
                            headerName: 'Actions',
                            cellRenderer: (params: { data: { id: number } }) => (
                                <a href={`/supplier-categories/${params.data.id}/edit`}>
                                    <Button variant="link">Edit</Button>
                                </a>
                            ),
                        },
                    ]}
                    defaultColDef={{ flex: 1, minWidth: 100, filter: 'agTextColumnFilter' }}
                    pagination={true}
                    paginationPageSize={20}
                />
            </div>
        </AppLayout>
    );
}
