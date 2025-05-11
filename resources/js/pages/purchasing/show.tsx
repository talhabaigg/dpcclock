import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { CircleCheck } from 'lucide-react';
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Requisitions',
        href: '/requisitions',
    },
];

export default function RequisitionShow() {
    const { requisition } = usePage().props as unknown as {
        requisition: {
            id: number;
            project_number: string;
            supplier_number: number;
            delivery_contact: string;
            requested_by: string;
            deliver_to: string;
            date_required: string;
            supplier: { name: string };
            creator: { name: string };
            line_items: {
                id: number;
                itemcode: string;
                description: string;
                qty: number;
                unitcost: number;
                total: number;
            }[];
        };
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Requisition #${requisition.id}`} />

            <div className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                    <table className="w-1/2 text-sm">
                        <tbody>
                            <tr>
                                <td className="w-1/4 border border-2 bg-gray-100 p-1 py-1 pr-4 font-medium dark:bg-gray-700">Project:</td>
                                <td className="w-1/4 border border-2 p-1 py-1 pr-4"> {requisition.location?.name}</td>
                            </tr>
                            <tr>
                                <td className="border border-2 bg-gray-100 p-1 py-1 pr-4 font-medium dark:bg-gray-700">Supplier:</td>
                                <td className="border border-2 p-1 py-1 pr-4">{requisition.supplier?.name}</td>
                            </tr>
                            <tr>
                                <td className="border border-2 bg-gray-100 p-1 py-1 pr-4 font-medium dark:bg-gray-700">Deliver To:</td>
                                <td className="border border-2 p-1 py-1 pr-4">{requisition.deliver_to}</td>
                            </tr>
                            <tr>
                                <td className="border border-2 bg-gray-100 p-1 py-1 pr-4 font-medium dark:bg-gray-700">Requested By:</td>
                                <td className="border border-2 p-1 py-1 pr-4">{requisition.requested_by}</td>
                            </tr>
                            <tr>
                                <td className="border border-2 bg-gray-100 p-1 py-1 pr-4 font-medium dark:bg-gray-700">Delivery Contact:</td>
                                <td className="border border-2 p-1 py-1 pr-4">{requisition.delivery_contact}</td>
                            </tr>
                            <tr>
                                <td className="border border-2 bg-gray-100 p-1 py-1 pr-4 font-medium dark:bg-gray-700">Date Required:</td>
                                <td className="border border-2 p-1 py-1 pr-4">{requisition.date_required}</td>
                            </tr>
                            <tr>
                                <td className="border border-2 bg-gray-100 p-1 py-1 pr-4 font-medium dark:bg-gray-700">Created by:</td>
                                <td className="border border-2 p-1 py-1 pr-4">{requisition.creator?.name}</td>
                            </tr>

                            <tr>
                                <td className="border border-2 bg-gray-100 p-1 py-1 pr-4 font-medium dark:bg-gray-700">Requisition Value:</td>
                                <td className="border border-2 p-1 py-1 pr-4">
                                    ${' '}
                                    {requisition.line_items && requisition.line_items.length > 0
                                        ? requisition.line_items.reduce((sum, item) => sum + (Number(item.total_cost) || 0), 0).toFixed(2)
                                        : '0.00'}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <div className="flex w-1/2 flex-col items-end justify-end gap-2 self-start md:flex-row">
                        <Link
                            href={`/requisition/${requisition.id}/edit`}
                            className={requisition.status === 'processed' ? 'pointer-events-none' : ''}
                        >
                            <Button className="w-28 text-xs" size="sm" disabled={requisition.status === 'processed'}>
                                Edit
                            </Button>
                        </Link>
                        <a href={`/requisition/excel/${requisition.id}`}>
                            <Button className="w-28 text-xs" size="sm" variant="outline">
                                Download Excel
                            </Button>
                        </a>

                        <a href={`/requisition/pdf/${requisition.id}`}>
                            <Button className="w-28 text-xs" size="sm" variant="outline">
                                Print to PDF
                            </Button>
                        </a>
                        {requisition.status === 'processed' ? (
                            <Button className="w-28 bg-green-500 text-xs text-white dark:bg-green-900" size="sm" disabled>
                                Processed
                            </Button>
                        ) : (
                            <Link href={`/requisition/${requisition.id}/process`}>
                                <Button className="w-28 text-xs" size="sm" variant="outline">
                                    <CircleCheck />
                                    Process
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>

                <table className="w-full border border-gray-200 text-sm dark:border-none">
                    <thead>
                        <tr className="bg-gray-100 dark:bg-gray-700">
                            <th className="p-1 text-left">Item Code</th>
                            <th className="p-1 text-left">Description</th>
                            <th className="p-1 text-left">Qty</th>
                            <th className="p-1 text-left">Unit Cost</th>
                            <th className="p-1 text-left">Total</th>
                            <th className="p-1 text-left">Cost Code</th>
                            <th className="p-1 text-left">Price List</th>
                        </tr>
                    </thead>
                    <tbody>
                        {requisition.line_items.map((item) => (
                            <tr key={item.id} className="border-t">
                                <td className="p-1">{item.code}</td>
                                <td className="p-1">{item.description}</td>
                                <td className="p-1 text-left">{item.qty}</td>
                                <td className="p-1 text-left">$ {Number(item.unit_cost)?.toFixed(2) || '0.00'}</td>
                                <td className="p-1 text-left">$ {Number(item.total_cost)?.toFixed(2) || '0.00'}</td>
                                <td className="p-1 text-left">{item.cost_code || 'N/A'}</td>
                                <td className="p-1 text-left">{item.price_list || 'N/A'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </AppLayout>
    );
}
