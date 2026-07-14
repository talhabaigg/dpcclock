import { Badge } from '@/components/ui/badge';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

type Item = {
    key: string;
    label: string;
    qty: number;
    size: string | null;
    make_model: string | null;
    reason: string;
    reason_label: string;
};

interface Props {
    location: { id: number; name: string; external_id: string | null };
    issuance: {
        id: string;
        submitted_at_formatted: string | null;
        reason: string;
        reason_label: string;
        ppe_returned: string;
        returned_label: string;
        fit_test_completed: boolean | null;
        source: 'qr' | 'kiosk';
        items: Item[];
        employee: { id: number; name: string; full_name: string } | null;
        authorised_by: { id: number; name: string } | null;
        deleted_at: string | null;
    };
}

export default function PpeRegisterShow({ location, issuance }: Props) {
    const baseUrl = `/locations/${location.id}/ppe-register`;
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'PPE/RPE Register', href: '/ppe-register' },
        { title: location.name, href: baseUrl },
        { title: issuance.employee?.name ?? issuance.id, href: `${baseUrl}/${issuance.id}` },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`PPE — ${issuance.employee?.name ?? 'Entry'}`} />
            <div className="mx-auto w-full max-w-3xl space-y-6 p-4">
                <div className="bg-card rounded-lg border p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">Issued to</p>
                            <h1 className="text-xl font-semibold tracking-tight">{issuance.employee?.full_name ?? '—'}</h1>
                            <p className="text-muted-foreground mt-1 text-xs">
                                {issuance.submitted_at_formatted} · {location.name}
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <Badge variant="outline" className="text-[10px]">
                                {issuance.source === 'qr' ? 'PPE cabinet QR' : 'Site kiosk'}
                            </Badge>
                            {issuance.deleted_at && (
                                <Badge variant="destructive" className="text-[10px]">
                                    Trashed
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-card rounded-lg border">
                    <div className="border-b px-5 py-3">
                        <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">PPE/RPE issued</p>
                    </div>
                    <div className="divide-y">
                        {issuance.items.length === 0 ? (
                            <p className="text-muted-foreground px-5 py-4 text-sm italic">No items recorded.</p>
                        ) : (
                            issuance.items.map((it) => (
                                <div key={it.key} className="flex items-center justify-between px-5 py-3">
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">{it.label}</p>
                                        <p className="text-muted-foreground text-xs">
                                            {[it.size ? `Size ${it.size}` : null, it.make_model].filter(Boolean).join(' · ')}
                                        </p>
                                        <p className="text-muted-foreground mt-1 text-xs">
                                            Reason: <span className="text-foreground">{it.reason_label}</span>
                                        </p>
                                    </div>
                                    <p className="text-sm font-semibold tabular-nums">×{it.qty}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {issuance.fit_test_completed !== null && (
                    <Field label="Quantitative fit test completed">{issuance.fit_test_completed ? 'Yes' : 'No'}</Field>
                )}

                <Field label="Authorised by">{issuance.authorised_by?.name ?? '—'}</Field>

                <Field label="Damaged or worn PPE returned to supervisor">{issuance.returned_label}</Field>
            </div>
        </AppLayout>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="bg-card rounded-lg border px-5 py-4">
            <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">{label}</p>
            <p className="text-foreground mt-1 text-sm">{children}</p>
        </div>
    );
}
