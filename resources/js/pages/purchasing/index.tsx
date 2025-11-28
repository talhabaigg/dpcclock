import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, CirclePlus, EllipsisVertical, ListFilterPlus, Search, SquarePlus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import CardsIndex from './index-partials/cardsIndex';
import CostRangeSlider from './index-partials/costRangeSlider';
import { SelectFilter } from './index-partials/selectFilter';
import { RequisitionData } from './index-partials/types';
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Requisitions',
        href: '/requisitions/all',
    },
];

const tableHeader = [
    { title: 'ID', key: 'id' },
    { title: 'Supplier', key: 'supplier' },
    { title: 'Project', key: 'location' },
    { title: 'PO Number', key: 'po_number' },
    { title: 'Status', key: 'status' },
    { title: 'Is Template', key: 'is_template' },
    { title: 'Order reference', key: 'order_reference' },
    { title: 'Created By', key: 'creator' },
    { title: 'Date required', key: 'date_required' },
    { title: 'Delivery Contact', key: 'delivery_contact' },
    { title: 'Deliver to', key: 'deliver_to' },
    { title: 'Requisition Value', key: 'line_items_sum_total_cost' },
    { title: '', key: 'actions' },
];

export default function RequisitionList() {
    const { requisitions, flash } = usePage<{ requisitions: RequisitionData; flash: { success: string; error: string } }>().props;

    const reqs = requisitions.data;
    const [searchQuery, setSearchQuery] = useState('');
    const [filterOnlyTemplates, setFilterOnlyTemplates] = useState(false);
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('viewMode') ?? 'table');
    const handleTabChange = (value) => {
        setViewMode(value);
        localStorage.setItem('viewMode', value);
    };
    const costs = reqs.map((r) => Number(r.line_items_sum_total_cost) || 0);
    const minCost = Math.min(...costs, 0);
    const maxCost = Math.max(...costs, 10000);
    const [costRange, setCostRange] = useState<[number, number]>(() => {
        const costs = reqs.map((r) => Number(r.line_items_sum_total_cost) || 0);
        return [Math.min(...costs, 0), Math.max(...costs, 10000)];
    });

    const [filters, setFilters] = useState({
        supplier: null,
        status: null,
        location: null,
        deliver_to: null,
        creator: null,
        contact: null,
    });
    const filteredRequisitions = reqs
        .filter((req) => {
            const cost = Number(req.line_items_sum_total_cost) || 0;
            return cost >= costRange[0] && cost <= costRange[1];
        })
        .filter((req) => !filterOnlyTemplates || req.is_template)
        .filter(
            (req) =>
                req.id?.toString().includes(searchQuery) ||
                req.supplier?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                req.creator?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                req.order_reference?.toLowerCase().includes(searchQuery.toLowerCase()),
        )
        .filter((req) => {
            return (
                (!filters.location || req.location?.name === filters.location) &&
                (!filters.supplier || req.supplier?.name === filters.supplier) &&
                (!filters.status || req.status === filters.status) &&
                (!filters.deliver_to || req.deliver_to === filters.deliver_to) &&
                (!filters.creator || req.creator?.name === filters.creator) &&
                (!filters.contact || req.delivery_contact === filters.contact)
            );
        });

    useEffect(() => {
        const savedFilters = localStorage.getItem('requisitionFilters');
        if (savedFilters) {
            const parsed = JSON.parse(savedFilters);
            setFilters(parsed.filters);
            setSearchQuery(parsed.searchQuery);
            setFilterOnlyTemplates(parsed.filterOnlyTemplates);
            setCostRange(parsed.costRange);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem(
            'requisitionFilters',
            JSON.stringify({
                filters,
                searchQuery,
                filterOnlyTemplates,
                costRange,
            }),
        );
    }, [filters, searchQuery, filterOnlyTemplates, costRange]);

    useEffect(() => {
        if (flash.success) {
            if (flash.success === 'Marked as a template successfully.') {
                toast.success(flash.success, {
                    icon: <SquarePlus />,
                });
            }
            if (flash.success === 'Removed template successfully.') {
                toast.success(flash.success, {
                    icon: <Trash2 />,
                });
            } else {
                toast.success(flash.success);
            }
        }
        if (flash.error) {
            toast.error(flash.error);
        }
    }, [flash.success, flash.error]);

    const filterDefinitions = [
        { key: 'location', label: 'Location', getOptions: () => reqs.map((r) => r.location?.name) },
        { key: 'supplier', label: 'Supplier', getOptions: () => reqs.map((r) => r.supplier?.name) },
        { key: 'status', label: 'Status', getOptions: () => reqs.map((r) => r.status) },
        { key: 'deliver_to', label: 'Deliver To', getOptions: () => reqs.map((r) => r.deliver_to) },
        { key: 'creator', label: 'Creator', getOptions: () => reqs.map((r) => r.creator?.name) },
        { key: 'contact', label: 'Contact', getOptions: () => reqs.map((r) => r.delivery_contact) },
    ] as const;
    const updateFilter = (key: keyof typeof filters, value: string | null) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    };
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="View Requisitions" />
            <div className="m-2 flex items-center justify-between gap-2">
                <div className="items-left flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <Button variant="outline">
                        <Link href="/requisition/create" className="flex items-center gap-2">
                            <CirclePlus size={12} />
                            Create New
                        </Link>
                    </Button>
                    <div className="mx-auto flex max-w-72 flex-wrap items-center sm:mx-0 sm:max-w-full">
                        <Pagination>
                            <PaginationContent className="">
                                {/* Previous */}
                                <PaginationItem>
                                    <PaginationLink href={requisitions.first_page_url} className="hidden w-full px-4 sm:flex">
                                        <span className="items-left flex flex-row -space-x-2">
                                            <ChevronLeft /> <ChevronLeft />
                                        </span>
                                        First
                                    </PaginationLink>
                                </PaginationItem>
                                <PaginationItem>
                                    <PaginationPrevious href={requisitions.prev_page_url || '#'} />
                                </PaginationItem>

                                {/* Visible page range logic */}
                                {(() => {
                                    const current = requisitions.current_page;
                                    const last = requisitions.last_page;

                                    const start = Math.max(1, current - 3);
                                    const end = Math.min(last, current + 3);

                                    const pages = [];
                                    for (let page = start; page <= end; page++) {
                                        pages.push(
                                            <PaginationItem key={page}>
                                                <PaginationLink href={`?page=${page}`} isActive={current === page}>
                                                    {page}
                                                </PaginationLink>
                                            </PaginationItem>,
                                        );
                                    }
                                    return pages;
                                })()}

                                {/* Next */}
                                <PaginationItem>
                                    <PaginationNext href={requisitions.next_page_url || '#'} />
                                </PaginationItem>
                                <PaginationLink href={requisitions.last_page_url} className="hidden w-full px-4 sm:flex">
                                    Last
                                    <span className="items-left flex flex-row -space-x-2">
                                        <ChevronRight /> <ChevronRight />
                                    </span>
                                </PaginationLink>
                            </PaginationContent>
                        </Pagination>
                    </div>
                </div>
            </div>
            <Tabs className="p-2" defaultValue={viewMode} onValueChange={handleTabChange}>
                <div className="m-4 flex flex-col items-start space-x-2 sm:m-0 md:flex-row">
                    <div className="flex flex-row items-start space-y-2 space-x-2 md:items-center">
                        <TabsList>
                            <div className="flex flex-row items-center space-x-2">
                                <TabsTrigger value="table">Table</TabsTrigger>
                                <TabsTrigger value="cards">Cards</TabsTrigger>
                            </div>
                        </TabsList>
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="outline" className="flex items-center gap-2">
                                    <ListFilterPlus size={16} className="mr-2" />
                                    Filters
                                </Button>
                            </SheetTrigger>
                            <SheetContent>
                                <SheetHeader>
                                    <SheetTitle>Filters</SheetTitle>
                                </SheetHeader>
                                <SheetDescription>
                                    <div className="flex items-center gap-2 p-4">
                                        {' '}
                                        <Checkbox
                                            checked={filterOnlyTemplates}
                                            onCheckedChange={(checked) => setFilterOnlyTemplates(checked === true)}
                                            id="filter-templates"
                                        />
                                        <Label htmlFor="filter-templates" className="cursor-pointer text-sm">
                                            View templates only
                                        </Label>
                                    </div>
                                    <div className="space-y-4 p-4">
                                        {filterDefinitions.map(({ key, label, getOptions }) => {
                                            const options = [...new Set(getOptions())].filter(Boolean).map((val) => ({ value: val!, label: val! }));
                                            return (
                                                <>
                                                    <Label htmlFor={`filter-${key}`} className="cursor-pointer text-sm">
                                                        Filter by {label}
                                                    </Label>
                                                    <SelectFilter
                                                        key={key}
                                                        filterName={`Filter by ${label}`}
                                                        options={options}
                                                        onChange={(val) => updateFilter(key, val)}
                                                        value={filters[key] ?? ''}
                                                    />
                                                </>
                                            );
                                        })}
                                        <div>
                                            <Button
                                                variant="link"
                                                onClick={() => {
                                                    setFilters({
                                                        location: null,
                                                        supplier: null,
                                                        status: null,
                                                        deliver_to: null,
                                                        creator: null,
                                                        contact: null,
                                                    });
                                                }}
                                            >
                                                Clear Filters
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="p-6">
                                        <CostRangeSlider min={minCost} max={maxCost} value={costRange} onChange={setCostRange} />
                                        <span className="text-muted-foreground mt-6 text-sm">Filter by Requisition Value</span>
                                    </div>
                                </SheetDescription>
                            </SheetContent>
                        </Sheet>

                        <div className="flex items-center gap-2">
                            {Object.entries(filters).map(([key, value]) =>
                                value ? (
                                    <Badge key={key} className="flex items-center gap-1">
                                        {value}
                                        <button
                                            className="rounded-full hover:bg-gray-200"
                                            onClick={() => updateFilter(key as keyof typeof filters, null)}
                                        >
                                            <X size={12} />
                                        </button>
                                    </Badge>
                                ) : null,
                            )}
                        </div>
                    </div>

                    <div className="relative ml-auto w-full sm:w-1/4">
                        <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" size={18} />
                        <Input
                            type="text"
                            placeholder="Search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>

                <TabsContent value="cards">
                    <CardsIndex filteredRequisitions={filteredRequisitions}></CardsIndex>
                </TabsContent>
                <TabsContent value="table">
                    <Card className="4xl:max-w-4xl mx-auto mt-4 max-w-sm p-1 text-sm sm:max-w-full">
                        <div className="flex h-full flex-1 flex-col gap-4 rounded-xl">
                            <Table>
                                <TableHeader className="rounded-t-xl hover:rounded-t-xl">
                                    <TableRow>
                                        {tableHeader.map((header) => (
                                            <TableHead key={header.key} className="text-left">
                                                {header.title}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRequisitions.map((requisition) => (
                                        <TableRow key={requisition.id}>
                                            <TableCell>{requisition.id}</TableCell>
                                            <TableCell className="max-w-24 break-all whitespace-normal">
                                                {requisition.supplier?.name.toUpperCase()}
                                            </TableCell>
                                            <TableCell className="max-w-24 break-words whitespace-normal">
                                                {requisition.location?.name || 'Not Found'}
                                            </TableCell>
                                            <TableCell>{requisition.po_number ? `PO${requisition.po_number}` : 'Not Found'}</TableCell>
                                            {requisition.status === 'success' ? (
                                                <TableCell>
                                                    <Badge className="bg-green-900 text-gray-200">success</Badge>
                                                </TableCell>
                                            ) : requisition.status === 'failed' ? (
                                                <TableCell>
                                                    <Badge className="bg-red-800 text-white">failed</Badge>
                                                </TableCell>
                                            ) : (
                                                <TableCell>
                                                    <Badge>{requisition.status}</Badge>
                                                </TableCell>
                                            )}

                                            <TableCell>{requisition.is_template ? <Badge variant="outline">Template</Badge> : <>No</>}</TableCell>
                                            <TableCell className="max-w-24 break-words whitespace-normal">
                                                {requisition.order_reference || 'Not Found'}
                                            </TableCell>
                                            <TableCell>{requisition.creator?.name}</TableCell>
                                            <TableCell>{new Date(requisition.date_required).toLocaleDateString('en-GB')}</TableCell>
                                            <TableCell className="max-w-24 break-words whitespace-normal">
                                                {requisition.delivery_contact || 'Not Found'}
                                            </TableCell>
                                            <TableCell className="max-w-24 break-words whitespace-normal">
                                                {requisition.deliver_to || 'Not Found'}
                                            </TableCell>

                                            <TableCell>${(Number(requisition.line_items_sum_total_cost) || 0).toFixed(2)}</TableCell>
                                            <TableCell className="table-cell sm:hidden">
                                                <div className="flex items-center gap-2">
                                                    <Link href={`/requisition/${requisition.id}`}>View</Link>
                                                    <Link href={`/requisition/${requisition.id}/copy`}>Copy</Link>
                                                    <Link href={`/requisition/${requisition.id}/delete`} className="text-red-500">
                                                        Delete
                                                    </Link>
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden w-16 text-right sm:table-cell">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <span className="sr-only">Open menu</span>
                                                            <EllipsisVertical size={24} />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuSeparator />
                                                        <Link href={`/requisition/${requisition.id}`}>
                                                            <DropdownMenuItem>View </DropdownMenuItem>
                                                        </Link>
                                                        <Link href={`/requisition/${requisition.id}/copy`}>
                                                            <DropdownMenuItem>Copy </DropdownMenuItem>
                                                        </Link>{' '}
                                                        <Link href={`/requisition/${requisition.id}/toggle-requisition-template`}>
                                                            <DropdownMenuItem>
                                                                {requisition.is_template ? 'Remove template' : 'Mark template'}
                                                            </DropdownMenuItem>
                                                        </Link>
                                                        <Link href={`/requisition/${requisition.id}/delete`} className="text-red-500">
                                                            <DropdownMenuItem> Delete</DropdownMenuItem>
                                                        </Link>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>
        </AppLayout>
    );
}
