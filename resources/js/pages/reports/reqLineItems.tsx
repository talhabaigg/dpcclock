import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import Papa from 'papaparse';
import React, { useEffect } from 'react';
import { DateRange } from 'react-day-picker';
import { toast } from 'sonner';
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Reports',
        href: '/',
    },
    {
        title: 'Req Line Items Descrepencies Report',
        href: '/reports/req-line-items-desc',
    },
];

type LineItem = {
    id: number;
    code: string;
    description: string;
    unit_cost: number;
    requisition: {
        id: number;
        supplier: {
            id: number;
            name: string;
        };
        po_number: string;
        created_at: string;
    };
};

const tableHeader = [
    { title: 'ID', key: 'id' },
    { title: 'Code', key: 'code' },
    { title: 'Description', key: 'description' },
    { title: 'Unit Cost', key: 'unit_cost' },
    { title: 'Requisition Id', key: 'requisition_id' },
    { title: 'Created at', key: 'created_at' },
    { title: 'PO Number', key: 'po_number' },
    { title: 'Supplier', key: 'Supplier' },
];

export default function RequisitionList() {
    const { lineItems, flash } = usePage<{ lineItems: LineItem[]; flash: { success: string; error: string; message: string } }>().props;

    const LOCAL_STORAGE_KEY = 'reqLineItemsDateRange';
    const [filteredLineItems, setFilteredLineItems] = React.useState<LineItem[]>(lineItems);
    const savedDateJson = localStorage.getItem(LOCAL_STORAGE_KEY);
    const initialDate: DateRange | undefined = savedDateJson ? JSON.parse(savedDateJson) : undefined;

    // Use saved date or default
    const [date, setDate] = React.useState<DateRange | undefined>(initialDate ?? { from: new Date(), to: new Date() });

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
        if (flash.error) {
            toast.error(flash.error);
        }
        if (flash.message) {
            toast.info(flash.message);
        }
    }, [flash]);

    useEffect(() => {
        if (date) {
            // Save date to localStorage as JSON string
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(date));
        } else {
            // Optionally clear it if date is undefined
            localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
    }, [date]);
    useEffect(() => {
        if (!date?.from || !date?.to) return;

        const from = new Date(date.from).setHours(0, 0, 0, 0);
        const to = new Date(date.to).setHours(23, 59, 59, 999);

        const filtered = lineItems.filter((item) => {
            const createdAt = new Date(item.requisition.created_at).getTime();
            return createdAt >= from && createdAt <= to;
        });

        setFilteredLineItems(filtered);
    }, [date, lineItems]);

    const generateCSV = (items: LineItem[]) => {
        if (!items.length) return alert('No data available to download.');

        const csv = Papa.unparse(
            items.map((item) => ({
                ID: item.id,
                Code: item.code || 'No Code',
                Description: item.description,
                'Unit Cost': item.unit_cost,
                'Requisition ID': item.requisition.id,
                'Created At': new Date(item.requisition.created_at).toLocaleDateString(),
                'PO Number': item.requisition.po_number || 'Not Generated',
                Supplier: item.requisition.supplier.name,
            })),
        );

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const name =
            'report-req-line-items-descrepencies-' +
            new Date(date.from).toLocaleDateString('en-AU') +
            '-' +
            new Date(date.to).toLocaleDateString('en-AU') +
            '.csv';
        a.download = name;
        a.click();
    };
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="LineItems Report" />
            <div className="m-2 flex items-start justify-start gap-2">
                <Calendar mode="range" selected={date} defaultMonth={date?.from} onSelect={setDate} />
                <Button
                    variant="link"
                    onClick={() => {
                        localStorage.removeItem(LOCAL_STORAGE_KEY);
                        setDate(null);
                    }}
                >
                    Clear
                </Button>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => generateCSV(filteredLineItems)}>
                        Download CSV
                    </Button>
                </div>
                {/* <div className="m-2 flex items-center gap-2">{flash.success && toast(flash.success)}</div> */}
            </div>

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
                        {filteredLineItems.map((item, index) => (
                            <TableRow key={index}>
                                <TableCell>{item.id}</TableCell>
                                <TableCell>{item.code ? item.code : 'No Code was entered'}</TableCell>
                                <TableCell>{item.description}</TableCell>
                                <TableCell>{item.unit_cost}</TableCell>
                                <TableCell>{item.requisition.id}</TableCell>
                                <TableCell>{new Date(item.requisition.created_at).toLocaleDateString()}</TableCell>
                                <TableCell>{item.requisition.po_number ? item.requisition.po_number : 'PO Number Not generated'}</TableCell>
                                <TableCell>{item.requisition.supplier.name}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </AppLayout>
    );
}
