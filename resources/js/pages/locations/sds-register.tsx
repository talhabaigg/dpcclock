import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { AlertTriangle, CircleCheck, Download, Loader2, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface SdsRecord {
    id: number;
    product_name: string;
    manufacturer: string;
    hazard_classifications: string[];
    expires_at: string;
    is_expired: boolean;
}

interface LocationRef {
    id: number;
    name: string;
    external_id: string | null;
}

interface PageProps {
    location: LocationRef;
    allSds: SdsRecord[];
    assignedIds: number[];
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function LocationSdsRegister() {
    const { location, allSds, assignedIds } = usePage<{ props: PageProps }>().props as unknown as PageProps;
    const { flash } = usePage<{ flash: { success?: string; error?: string } }>().props;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Locations', href: '/locations' },
        { title: location.external_id || location.name, href: `/locations/${location.id}` },
        { title: 'SDS Register', href: `/locations/${location.id}/sds` },
    ];

    const [selected, setSelected] = useState<Set<number>>(new Set(assignedIds));
    const [searchQuery, setSearchQuery] = useState('');
    const [saving, setSaving] = useState(false);
    const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        if (flash?.success) setAlertMessage({ type: 'success', text: flash.success });
        else if (flash?.error) setAlertMessage({ type: 'error', text: flash.error });
    }, [flash?.success, flash?.error]);

    const filtered = useMemo(() => {
        if (!searchQuery) return allSds;
        const q = searchQuery.toLowerCase();
        return allSds.filter(
            (s) => s.product_name.toLowerCase().includes(q) || s.manufacturer.toLowerCase().includes(q),
        );
    }, [allSds, searchQuery]);

    const toggle = (id: number) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        setSelected(new Set(filtered.map((s) => s.id)));
    };

    const deselectAll = () => {
        setSelected(new Set());
    };

    const hasChanges = useMemo(() => {
        const origSet = new Set(assignedIds);
        if (selected.size !== origSet.size) return true;
        for (const id of selected) {
            if (!origSet.has(id)) return true;
        }
        return false;
    }, [selected, assignedIds]);

    const handleSave = () => {
        setSaving(true);
        router.post(`/locations/${location.id}/sds/sync`, { sds_ids: Array.from(selected) }, {
            onFinish: () => setSaving(false),
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`SDS Register — ${location.name}`} />

            <div className="flex flex-col gap-4 p-3 sm:p-4">
                {alertMessage && (
                    <div
                        className={`flex items-center gap-2 rounded-md border p-3 text-sm ${
                            alertMessage.type === 'success'
                                ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/20 dark:text-green-300'
                                : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/20 dark:text-red-300'
                        }`}
                    >
                        {alertMessage.type === 'success' ? <CircleCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                        <span className="flex-1">{alertMessage.text}</span>
                        <button onClick={() => setAlertMessage(null)}>
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}

                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h2 className="text-lg font-semibold">SDS Register — {location.name}</h2>
                        <p className="text-muted-foreground text-sm">Select which SDS records apply to this project.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <a href={`/locations/${location.id}/sds/download`}>
                            <Button variant="outline" size="sm" className="gap-1.5" disabled={selected.size === 0}>
                                <Download size={14} />
                                Download Merged PDF
                            </Button>
                        </a>
                        <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </div>
                </div>

                {/* Search + Select actions */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-full sm:max-w-xs">
                        <Search className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" size={18} />
                        <Input
                            type="text"
                            placeholder="Search by product or manufacturer..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <Button variant="outline" size="sm" onClick={selectAll}>
                        Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={deselectAll}>
                        Deselect All
                    </Button>
                    <span className="text-muted-foreground text-sm">{selected.size} of {allSds.length} selected</span>
                </div>

                {/* SDS List */}
                <div className="flex flex-col gap-1 rounded-lg border">
                    {filtered.length === 0 && (
                        <div className="text-muted-foreground py-8 text-center text-sm">No SDS records found.</div>
                    )}
                    {filtered.map((sds) => (
                        <label
                            key={sds.id}
                            className="hover:bg-accent flex cursor-pointer items-center gap-3 border-b px-4 py-3 last:border-b-0 transition-colors"
                        >
                            <Checkbox
                                checked={selected.has(sds.id)}
                                onCheckedChange={() => toggle(sds.id)}
                            />
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-medium">{sds.product_name}</div>
                                    <div className="text-muted-foreground text-xs">{sds.manufacturer}</div>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {sds.hazard_classifications.map((h) => (
                                        <Badge key={h} variant="outline" className="text-[10px]">
                                            {h}
                                        </Badge>
                                    ))}
                                </div>
                                <div className={`shrink-0 text-xs font-medium ${sds.is_expired ? 'text-red-600' : 'text-muted-foreground'}`}>
                                    {formatDate(sds.expires_at)}
                                    {sds.is_expired && <span className="ml-1">(Expired)</span>}
                                </div>
                            </div>
                        </label>
                    ))}
                </div>
            </div>
        </AppLayout>
    );
}
