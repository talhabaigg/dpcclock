import { Button } from '@/components/ui/button';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { useEffect } from 'react';

export default function RequisitionPrint() {
    const { requisition, printedBy, printedAt } = usePage().props as unknown as {
        printedBy: string;
        printedAt: string;
        requisition: {
            id: number;
            po_number: string;
            project_number: string;
            supplier_number: number;
            delivery_contact: string;
            requested_by: string;
            pickup_by: string;
            deliver_to: string;
            date_required: string;
            order_reference: string;
            created_at: string;
            status: string;
            location: { name: string; external_id: string };
            supplier: { name: string; code: string };
            creator: { name: string };
            line_items: {
                id: number;
                code: string;
                description: string;
                qty: number;
            }[];
        };
    };

    const handlePrint = () => {
        window.print();
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                e.preventDefault();
                handlePrint();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const itemCount = requisition.line_items?.length || 0;

    return (
        <>
            <Head title={`Print PO${requisition.po_number || requisition.id}`} />

            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    * { box-shadow: none !important; }
                    html, body {
                        font-size: 11pt;
                        margin: 0;
                        padding: 0;
                        background: white !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    @page {
                        margin: 10mm;
                        size: A4;
                    }
                    .print-container {
                        max-width: 100% !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                        border-radius: 0 !important;
                        border: none !important;
                    }
                    table { page-break-inside: auto; }
                    tr { page-break-inside: avoid; page-break-after: auto; }
                }
                @media screen {
                    body { background-color: #f1f5f9; }
                }
            `}</style>

            {/* Action Bar */}
            <div className="no-print sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm">
                <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
                    <Link href={`/requisition/${requisition.id}`}>
                        <Button variant="ghost" size="sm" className="gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Button>
                    </Link>
                    <div className="flex items-center gap-2">
                        <a href={`/requisition/pdf/${requisition.id}`}>
                            <Button variant="outline" size="sm" className="gap-2">
                                <Download className="h-4 w-4" />
                                PDF
                            </Button>
                        </a>
                        <Button onClick={handlePrint} size="sm" className="gap-2 bg-slate-900 text-white hover:bg-slate-800">
                            <Printer className="h-4 w-4" />
                            Print
                        </Button>
                    </div>
                </div>
            </div>

            {/* Preview hint */}
            <div className="no-print py-4">
                <p className="text-center text-sm text-slate-500">
                    Press <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-xs">Ctrl</kbd> + <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-xs">P</kbd> to print
                </p>
            </div>

            {/* Printable Document */}
            <div className="print-container mx-auto max-w-4xl bg-white p-8 shadow-lg md:my-4 md:rounded-lg">

                {/* Document Header */}
                <header className="mb-8">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <img
                                src="/logo.png"
                                alt="Company Logo"
                                className="h-14 w-auto"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                            <div>
                                <h1 className="text-xl font-bold uppercase tracking-wide text-slate-800">
                                    Purchase Order
                                </h1>
                                <p className="text-sm text-slate-500">Internal Requisition</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold text-slate-900">
                                {requisition.po_number ? `PO${requisition.po_number}` : `REQ-${requisition.id}`}
                            </div>
                            <div className="mt-1 text-sm text-slate-600">
                                Date: {new Date(requisition.created_at).toLocaleDateString('en-GB')}
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 h-px bg-slate-900" />
                </header>

                {/* Key Information Grid */}
                <section className="mb-6 grid grid-cols-2 gap-6">
                    {/* Left: Job/Project Info */}
                    <div className="border border-slate-300 p-4">
                        <h2 className="mb-3 border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                            Deliver To
                        </h2>
                        <div className="space-y-1.5 text-sm">
                            <p className="font-semibold text-slate-900">{requisition.location?.name}</p>
                            <p className="text-slate-600">Job #: {requisition.location?.external_id}</p>
                            {requisition.deliver_to && (
                                <p className="mt-2 whitespace-pre-line text-slate-700">{requisition.deliver_to}</p>
                            )}
                            {requisition.delivery_contact && (
                                <p className="text-slate-600">
                                    <span className="font-medium">Contact:</span> {requisition.delivery_contact}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Right: Supplier Info */}
                    <div className="border border-slate-300 p-4">
                        <h2 className="mb-3 border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                            Supplier
                        </h2>
                        <div className="space-y-1.5 text-sm">
                            <p className="font-semibold text-slate-900">{requisition.supplier?.name}</p>
                            {requisition.supplier?.code && (
                                <p className="text-slate-600">Code: {requisition.supplier.code}</p>
                            )}
                        </div>
                    </div>
                </section>

                {/* Order Details Row */}
                <section className="mb-6 grid grid-cols-4 gap-4 border border-slate-300 p-4">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Required By</p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-900">
                            {new Date(requisition.date_required).toLocaleDateString('en-GB')}
                        </p>
                    </div>
                    {requisition.requested_by && (
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Requested By</p>
                            <p className="mt-0.5 text-sm font-semibold text-slate-900">{requisition.requested_by}</p>
                        </div>
                    )}
                    {requisition.pickup_by && (
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Pickup By</p>
                            <p className="mt-0.5 text-sm font-semibold text-slate-900">{requisition.pickup_by}</p>
                        </div>
                    )}
                    {requisition.order_reference && (
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Reference</p>
                            <p className="mt-0.5 text-sm font-semibold text-slate-900">{requisition.order_reference}</p>
                        </div>
                    )}
                </section>

                {/* Line Items Table */}
                <section className="mb-6">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="border-y-2 border-slate-900">
                                <th className="w-12 py-2 pr-2 text-left text-xs font-bold uppercase tracking-wider text-slate-700">#</th>
                                <th className="py-2 pr-4 text-left text-xs font-bold uppercase tracking-wider text-slate-700">Code</th>
                                <th className="py-2 pr-4 text-left text-xs font-bold uppercase tracking-wider text-slate-700">Description</th>
                                <th className="w-20 py-2 text-right text-xs font-bold uppercase tracking-wider text-slate-700">Qty</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requisition.line_items?.map((item, index) => (
                                <tr key={item.id} className="border-b border-slate-200">
                                    <td className="py-2.5 pr-2 text-slate-500">{index + 1}</td>
                                    <td className="py-2.5 pr-4 font-mono text-xs text-slate-700">{item.code}</td>
                                    <td className="py-2.5 pr-4 text-slate-800">{item.description}</td>
                                    <td className="py-2.5 text-right font-semibold tabular-nums text-slate-900">{item.qty}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-slate-900">
                                <td colSpan={3} className="py-2.5 text-right text-xs font-bold uppercase tracking-wider text-slate-600">
                                    Total Items
                                </td>
                                <td className="py-2.5 text-right font-bold tabular-nums text-slate-900">{itemCount}</td>
                            </tr>
                        </tfoot>
                    </table>
                </section>

                {/* Document Footer */}
                <footer className="border-t border-slate-300 pt-3">
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <div>
                            <span className="font-medium">REF:</span> {requisition.id} |
                            <span className="ml-2 font-medium">Created:</span> {new Date(requisition.created_at).toLocaleDateString('en-GB')}
                        </div>
                        <div>
                            Printed by {printedBy} on {printedAt}
                        </div>
                    </div>
                </footer>
            </div>

            <div className="no-print h-8" />
        </>
    );
}
