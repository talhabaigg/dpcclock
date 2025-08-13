import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserInfo } from '@/components/user-info';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { AlertCircleIcon, ArrowBigUp, CircleCheck, Cuboid, FileSpreadsheet, FileText, History, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Requisitions',
        href: '/requisitions',
    },
];

const requisitionHeaderTable: {
    title: string;
    key: string; // dot notation like 'location.name'
}[] = [
    { title: 'PO Number', key: 'po_number' },
    { title: 'Project', key: 'location.name' },
    { title: 'Supplier', key: 'supplier.name' },
    { title: 'Deliver To', key: 'deliver_to' },
    { title: 'Requested By', key: 'requested_by' },
    { title: 'Delivery Contact', key: 'delivery_contact' },
    { title: 'Order Reference', key: 'order_reference' },
    { title: 'Date Required', key: 'date_required' },
    { title: 'Requisition Value', key: 'line_items_sum_total_cost' },
    { title: 'Created By', key: 'creator.name' },
];

export default function RequisitionShow() {
    const { requisition, activities, flash } = usePage().props as unknown as {
        requisition: {
            id: number;
            project_number: string;
            supplier_number: number;
            delivery_contact: string;
            requested_by: string;
            deliver_to: string;
            date_required: string;
            order_reference: string;
            status: string;
            supplier: { name: string };
            creator: { name: string };
            line_items: {
                id: number;
                code: string;
                description: string;
                qty: number;
                unit_cost: number;
                total_cost: number;
                cost_code: string;
                price_list: string;
            }[];
        };
        activities: any[];
        flash: {
            success?: string;
            error?: string;
            message?: string;
        };
    };
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
    function getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((acc, key) => acc?.[key], obj);
    }
    function handleSort(key: string) {
        if (sortKey === key) {
            if (sortDirection === 'asc') {
                setSortDirection('desc');
            } else if (sortDirection === 'desc') {
                setSortKey(null);
                setSortDirection(null);
            } else {
                setSortDirection('asc');
            }
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    }

    function getSortedItems() {
        if (!sortKey || !sortDirection) return requisition.line_items;

        return [...requisition.line_items].sort((a, b) => {
            const aVal = a[sortKey as keyof typeof a];
            const bVal = b[sortKey as keyof typeof b];

            if (aVal == null) return 1;
            if (bVal == null) return -1;

            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
            }

            return sortDirection === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
        });
    }

    useEffect(() => {
        if (flash.error) {
            toast.error(flash.error);
        }
        if (flash.success) {
            toast.success(flash.success);
        }
    }, []);
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Requisition #${requisition.id}`} />
            {flash.error && (
                <Alert variant="destructive">
                    <AlertCircleIcon />
                    <AlertTitle>Errors found in PO</AlertTitle>
                    <AlertDescription>
                        {flash.error}
                        <br />
                        Please review the requisition and correct any issues before proceeding.
                    </AlertDescription>
                </Alert>
            )}
            <div className="mx-auto space-y-2 p-2 sm:mx-0">
                <div className="flex flex-col items-start justify-between gap-2 sm:flex-row">
                    <Card className="mx-2 w-full max-w-96 p-0 text-sm sm:max-w-full md:w-1/2 2xl:w-1/3">
                        <Table>
                            <TableHeader>
                                {requisitionHeaderTable.map((header) => (
                                    <TableRow key={header.key}>
                                        <TableCell className="font-semibold">{header.title}</TableCell>
                                        <TableCell className="font-light break-words whitespace-normal">
                                            {header.key.includes('sum') ? '$ ' : ''}
                                            {header.key === 'po_number' ? 'PO' : ''}
                                            {getNestedValue(requisition, header.key)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableHeader>
                        </Table>
                    </Card>
                    <div className="m-2 flex w-full flex-col items-start justify-end gap-2 self-start sm:items-end md:flex-row">
                        <div className="grid w-full grid-cols-1 space-y-2 space-x-2 sm:max-w-2xl sm:space-y-0 sm:space-x-2 md:grid-cols-5">
                            <Link
                                href={`/requisition/${requisition.id}/edit`}
                                className={requisition.status === 'processed' ? 'pointer-events-none' : ''}
                            >
                                <Button className="w-full max-w-96 text-xs sm:max-w-32" size="sm" disabled={requisition.status !== 'pending'}>
                                    Edit
                                </Button>
                            </Link>
                            <a href={`/requisition/excel/${requisition.id}`}>
                                <Button className="w-full max-w-96 text-xs sm:max-w-32" size="sm" variant="outline">
                                    <FileSpreadsheet />
                                    Download Excel
                                </Button>
                            </a>

                            <a href={`/requisition/pdf/${requisition.id}`}>
                                <Button className="w-full max-w-96 text-xs sm:max-w-32" size="sm" variant="outline">
                                    <FileText />
                                    Print to PDF
                                </Button>
                            </a>
                            {requisition.status === 'failed' ? (
                                <>
                                    <Link href={`/requisition/${requisition.id}/api-send`}>
                                        <Button className="w-full text-xs sm:max-w-32" size="sm" variant="outline">
                                            <RotateCcw />
                                            API to Premier
                                        </Button>
                                    </Link>
                                    <Link href={`/requisition/${requisition.id}/process`}>
                                        <Button className="w-full max-w-96 text-xs sm:max-w-32" size="sm" variant="outline">
                                            <RotateCcw />
                                            Retry
                                        </Button>
                                    </Link>
                                </>
                            ) : requisition.status === 'pending' ? (
                                <>
                                    <Link href={`/requisition/${requisition.id}/api-send`}>
                                        <Button className="w-full text-xs sm:max-w-32" size="sm" variant="outline">
                                            <CircleCheck />
                                            API to Premier
                                        </Button>
                                    </Link>
                                    <Link href={`/requisition/${requisition.id}/process`}>
                                        <Button className="w-full text-xs sm:max-w-32" size="sm" variant="outline">
                                            <CircleCheck />
                                            Send to Premier
                                        </Button>
                                    </Link>
                                </>
                            ) : (
                                <Button className="w-full max-w-96 bg-green-900 text-xs text-white sm:max-w-32 dark:bg-green-900" size="sm" disabled>
                                    Sent to Premier
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
                <Tabs defaultValue="items" className="mx-auto w-full max-w-96 sm:mx-2 sm:max-w-full">
                    <TabsList className="w-full">
                        <TabsTrigger value="items" className="flex flex-1">
                            <Cuboid className="mr-1 h-4 w-4" />
                            Items
                        </TabsTrigger>
                        <TabsTrigger value="log" className="flex flex-1 items-center space-x-2">
                            <History className="mr-1 h-4 w-4" />
                            Log
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="items">
                        <Card className="m-0 mt-4 max-w-96 p-0 text-sm sm:max-w-full">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableCell className="cursor-pointer font-semibold" onClick={() => handleSort('code')}>
                                            Item Code {sortKey === 'code' && (sortDirection === 'asc' ? '↑' : sortDirection === 'desc' ? '↓' : '')}
                                        </TableCell>
                                        <TableCell className="cursor-pointer font-semibold" onClick={() => handleSort('description')}>
                                            Description{' '}
                                            {sortKey === 'description' && (sortDirection === 'asc' ? '↑' : sortDirection === 'desc' ? '↓' : '')}
                                        </TableCell>
                                        <TableCell className="cursor-pointer font-semibold" onClick={() => handleSort('qty')}>
                                            Qty {sortKey === 'qty' && (sortDirection === 'asc' ? '↑' : sortDirection === 'desc' ? '↓' : '')}
                                        </TableCell>
                                        <TableCell className="cursor-pointer font-semibold" onClick={() => handleSort('unit_cost')}>
                                            Unit Cost{' '}
                                            {sortKey === 'unit_cost' && (sortDirection === 'asc' ? '↑' : sortDirection === 'desc' ? '↓' : '')}
                                        </TableCell>
                                        <TableCell className="cursor-pointer font-semibold" onClick={() => handleSort('total_cost')}>
                                            Total Cost{' '}
                                            {sortKey === 'total_cost' && (sortDirection === 'asc' ? '↑' : sortDirection === 'desc' ? '↓' : '')}
                                        </TableCell>
                                        <TableCell className="cursor-pointer font-semibold" onClick={() => handleSort('cost_code')}>
                                            Cost Code{' '}
                                            {sortKey === 'cost_code' && (sortDirection === 'asc' ? '↑' : sortDirection === 'desc' ? '↓' : '')}
                                        </TableCell>
                                        <TableCell className="cursor-pointer font-semibold" onClick={() => handleSort('price_list')}>
                                            Price List{' '}
                                            {sortKey === 'price_list' && (sortDirection === 'asc' ? '↑' : sortDirection === 'desc' ? '↓' : '')}
                                        </TableCell>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {getSortedItems().map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>{item.code}</TableCell>
                                            <TableCell>{item.description}</TableCell>
                                            <TableCell className="text-left">{item.qty}</TableCell>
                                            <TableCell className="text-left">$ {Number(item.unit_cost)?.toFixed(6) || '0.00'}</TableCell>
                                            <TableCell className="text-left">$ {Number(item.total_cost)?.toFixed(6) || '0.00'}</TableCell>
                                            <TableCell className="text-left">{item.cost_code || 'N/A'}</TableCell>
                                            <TableCell className="text-left">{item.price_list || 'N/A'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>
                    </TabsContent>
                    <TabsContent value="log">
                        <Card className="m-0 mt-4 max-w-96 p-0 text-sm sm:max-w-full">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableCell>ID</TableCell>
                                        <TableCell>Event</TableCell>
                                        <TableCell>Performed by</TableCell>
                                        <TableCell>Performed On</TableCell>
                                        <TableCell>Performed at</TableCell>
                                        <TableCell>Properties</TableCell>
                                    </TableRow>
                                </TableHeader>

                                {activities.map((a) => {
                                    return (
                                        <TableRow>
                                            <TableCell>{a.id}</TableCell>
                                            <TableCell>{a.event}</TableCell>
                                            <TableCell className="w-full">
                                                {a.causer && (
                                                    <div className="flex w-48 flex-row items-center space-x-2">
                                                        {' '}
                                                        <UserInfo user={{ ...a.causer }}></UserInfo>
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>{a.log_name}</TableCell>
                                            <TableCell>{new Date(a.created_at).toLocaleString()}</TableCell>
                                            <TableCell>
                                                {/* New attributes table */}
                                                {a.properties?.attributes ? (
                                                    <Card className="mb-2 p-0">
                                                        <Table className="rounded-lg">
                                                            <TableHeader>
                                                                <TableRow>
                                                                    {Object.keys(a.properties.attributes).map((key) => (
                                                                        <TableHead key={key} className="border-r">
                                                                            {key}
                                                                        </TableHead>
                                                                    ))}
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                <TableRow>
                                                                    {Object.values(a.properties.attributes).map((value, index) => (
                                                                        <TableCell className="border-r" key={index}>
                                                                            {String(value)}
                                                                        </TableCell>
                                                                    ))}
                                                                </TableRow>
                                                            </TableBody>
                                                        </Table>
                                                    </Card>
                                                ) : (
                                                    <em>No attributes</em>
                                                )}

                                                {/* Old values table */}
                                                {a.properties?.old ? (
                                                    <>
                                                        <ArrowBigUp />
                                                        <Card className="p-0">
                                                            <Table className="rounded-lg">
                                                                <TableHeader>
                                                                    <TableRow>
                                                                        {Object.keys(a.properties.old).map((key) => (
                                                                            <TableHead key={key} className="border-r">
                                                                                {key}
                                                                            </TableHead>
                                                                        ))}
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    <TableRow>
                                                                        {Object.values(a.properties.old).map((value, index) => (
                                                                            <TableCell className="border-r" key={index}>
                                                                                {String(value)}
                                                                            </TableCell>
                                                                        ))}
                                                                    </TableRow>
                                                                </TableBody>
                                                            </Table>
                                                        </Card>
                                                    </>
                                                ) : null}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </Table>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}
