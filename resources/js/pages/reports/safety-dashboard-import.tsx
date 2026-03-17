import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft, Loader2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Reports', href: '/' },
    { title: 'Safety Dashboard', href: '/reports/safety-dashboard' },
    { title: 'Import', href: '/reports/safety-dashboard/import' },
];

type PageProps = {
    lastImport: string | null;
    totalRecords: number;
};

function formatNumber(value: number): string {
    return new Intl.NumberFormat('en-AU').format(value);
}

export default function SafetyDashboardImport() {
    const { lastImport, totalRecords } = usePage<{ props: PageProps }>().props as unknown as PageProps;

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importing, setImporting] = useState(false);
    const [lastImportTime, setLastImportTime] = useState(lastImport);
    const [recordCount, setRecordCount] = useState(totalRecords);
    const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

    const handleImport = async () => {
        const file = fileInputRef.current?.files?.[0];
        if (!file) {
            toast.error('Please select a file first');
            return;
        }

        setImporting(true);
        setImportResult(null);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/reports/safety-dashboard/import', {
                method: 'POST',
                headers: { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '' },
                body: formData,
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Imported ${data.imported} records` + (data.skipped > 0 ? `, ${data.skipped} skipped` : ''));
                setLastImportTime(data.last_import);
                setRecordCount(data.total_records);
                setImportResult({ imported: data.imported, skipped: data.skipped, errors: data.errors || [] });
            } else {
                toast.error('Import failed');
            }
        } catch {
            toast.error('Import failed — network error');
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Import Incident Register" />
            <div className="flex flex-col gap-4 p-4">
                <div className="flex items-center gap-3">
                    <Link href="/reports/safety-dashboard">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-semibold">Import Incident Register</h1>
                </div>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Upload Excel File</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="mb-4 text-sm text-muted-foreground">
                            Upload the Incident/Injury Register Excel file (.xlsx). The system reads the REGISTER sheet starting from row 4.
                            Re-uploading the same file will update existing records without creating duplicates.
                        </p>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                            <div className="flex-1">
                                <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Excel File (.xlsx)</label>
                                <Input ref={fileInputRef} type="file" accept=".xlsx,.xls" />
                            </div>
                            <Button onClick={handleImport} disabled={importing}>
                                {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                Import
                            </Button>
                        </div>
                        <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
                            <span>Total records: <strong>{formatNumber(recordCount)}</strong></span>
                            {lastImportTime && (
                                <span>Last import: <strong>{new Date(lastImportTime).toLocaleString('en-AU')}</strong></span>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {importResult && (
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Import Result</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-6 text-sm">
                                <span>Imported: <strong className="text-green-600">{importResult.imported}</strong></span>
                                <span>Skipped: <strong className="text-yellow-600">{importResult.skipped}</strong></span>
                            </div>
                            {importResult.errors.length > 0 && (
                                <div className="mt-3">
                                    <p className="mb-1 text-sm font-medium text-destructive">Errors:</p>
                                    <ul className="max-h-40 overflow-y-auto text-sm text-muted-foreground">
                                        {importResult.errors.map((err, i) => (
                                            <li key={i}>{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </AppLayout>
    );
}
