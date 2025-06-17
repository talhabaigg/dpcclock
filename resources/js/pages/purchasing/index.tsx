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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { CirclePlus, EllipsisVertical, Search, SquarePlus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import CardsIndex from './index-partials/cardsIndex';
import CostRangeSlider from './index-partials/costRangeSlider';
import { SelectFilter } from './index-partials/selectFilter';
import { Requisition } from './index-partials/types';
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
    { title: 'Actions', key: 'actions' },
];

export default function RequisitionList() {
    const { requisitions, flash } = usePage<{ requisitions: Requisition[]; flash: { success: string; error: string } }>().props;
    const [searchQuery, setSearchQuery] = useState('');
    const [filterOnlyTemplates, setFilterOnlyTemplates] = useState(false);
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('viewMode') ?? 'table');
    const handleTabChange = (value) => {
        setViewMode(value);
        localStorage.setItem('viewMode', value);
    };
    const costs = requisitions.map((r) => Number(r.line_items_sum_total_cost) || 0);
    const minCost = Math.min(...costs, 0);
    const maxCost = Math.max(...costs, 10000);
    const [costRange, setCostRange] = useState<[number, number]>(() => {
        const costs = requisitions.map((r) => Number(r.line_items_sum_total_cost) || 0);
        return [Math.min(...costs, 0), Math.max(...costs, 10000)];
    });

    const [filters, setFilters] = useState({
        supplier: null,
        status: null,
        deliver_to: null,
        creator: null,
        contact: null,
    });
    const filteredRequisitions = requisitions
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
        { key: 'supplier', label: 'Supplier', getOptions: () => requisitions.map((r) => r.supplier?.name) },
        { key: 'status', label: 'Status', getOptions: () => requisitions.map((r) => r.status) },
        { key: 'deliver_to', label: 'Deliver To', getOptions: () => requisitions.map((r) => r.deliver_to) },
        { key: 'creator', label: 'Creator', getOptions: () => requisitions.map((r) => r.creator?.name) },
        { key: 'contact', label: 'Contact', getOptions: () => requisitions.map((r) => r.delivery_contact) },
    ] as const;
    const updateFilter = (key: keyof typeof filters, value: string | null) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    };
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="View Requisitions" />
            <div className="m-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Button variant="outline">
                        <Link href="/requisition/create" className="flex items-center gap-2">
                            <CirclePlus size={12} />
                            Create New
                        </Link>
                    </Button>
                    <span className="flex items-center gap-2">
                        {' '}
                        <Checkbox
                            checked={filterOnlyTemplates}
                            onCheckedChange={(checked) => setFilterOnlyTemplates(checked === true)}
                            id="filter-templates"
                        />
                        <Label htmlFor="filter-templates" className="cursor-pointer text-sm">
                            View templates only
                        </Label>
                    </span>
                </div>

                {/* <div className="m-2 flex items-center gap-2">{flash.success && toast(flash.success)}</div> */}

                <div className="relative w-72 sm:w-1/4">
                    <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                        type="text"
                        placeholder="Search by ID, Order Ref, Supplier, or Created By"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>
            <Card className="mx-2 flex flex-col items-start justify-between gap-2 p-2 md:flex-row md:items-center">
                <div className="ml-2 grid w-1/2 grid-cols-1 gap-2 p-2 md:grid-cols-3">
                    {filterDefinitions.map(({ key, label, getOptions }) => {
                        const options = [...new Set(getOptions())].filter(Boolean).map((val) => ({ value: val!, label: val! }));
                        return (
                            <SelectFilter
                                key={key}
                                filterName={`Filter by ${label}`}
                                options={options}
                                onChange={(val) => updateFilter(key, val)}
                                value={filters[key] ?? ''}
                            />
                        );
                    })}
                    <div>
                        <Button
                            variant="link"
                            onClick={() => {
                                setFilters({
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
                <div className="mx-4 flex w-1/2 flex-col items-start gap-4 md:items-end">
                    <div className="p-4">
                        <CostRangeSlider min={minCost} max={maxCost} value={costRange} onChange={setCostRange} />
                        <span className="text-muted-foreground text-sm">Filter by Requisition Value</span>
                    </div>
                </div>
            </Card>
            <Tabs className="p-4" defaultValue={viewMode} onValueChange={handleTabChange}>
                <TabsList>
                    <TabsTrigger value="table">Table</TabsTrigger>
                    <TabsTrigger value="cards">Cards</TabsTrigger>
                </TabsList>
                <TabsContent value="cards">
                    <CardsIndex filteredRequisitions={filteredRequisitions}></CardsIndex>
                </TabsContent>
                <TabsContent value="table">
                    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                        <Table>
                            <TableHeader>
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
                                        <TableCell>{requisition.order_reference || 'Not Found'}</TableCell>
                                        <TableCell>{requisition.creator?.name}</TableCell>
                                        <TableCell>{new Date(requisition.date_required).toLocaleDateString('en-GB')}</TableCell>
                                        <TableCell>{requisition.delivery_contact || 'Not Found'}</TableCell>
                                        <TableCell>{requisition.deliver_to || 'Not Found'}</TableCell>

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
                                        <TableCell className="hidden sm:table-cell">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild className="rounded-sm p-1 hover:bg-gray-200">
                                                    <EllipsisVertical size={24} />
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
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
                </TabsContent>
            </Tabs>
        </AppLayout>
    );
}
