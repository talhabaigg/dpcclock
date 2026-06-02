import { ErrorAlertFlash, SuccessAlertFlash } from '@/components/alert-flash';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { router } from '@inertiajs/react';
import { Loader2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface InjuryImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface ImportResult {
    imported: number;
    skipped: number;
    errors: string[];
}

export default function InjuryImportDialog({ open, onOpenChange }: InjuryImportDialogProps) {
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [flash, setFlash] = useState<{ success?: string; error?: string }>({});
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setResult(null);
            setFlash({});
        }
    }, [open]);

    const handleImport = async () => {
        const file = fileRef.current?.files?.[0];
        if (!file) {
            setFlash({ error: 'Please select a file first' });
            return;
        }
        setImporting(true);
        setResult(null);
        setFlash({});
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch('/injury-register/import', {
                method: 'POST',
                headers: { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '' },
                body: formData,
            });
            const data = await res.json();
            if (data.success) {
                setFlash({ success: `Imported ${data.imported} records` + (data.skipped > 0 ? `, ${data.skipped} skipped` : '') });
                setResult({ imported: data.imported, skipped: data.skipped, errors: data.errors || [] });
                if (data.imported > 0) {
                    router.reload({ only: ['injuries'] });
                }
            } else {
                setFlash({ error: 'Import failed' });
            }
        } catch {
            setFlash({ error: 'Import failed — network error' });
        } finally {
            setImporting(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md" onCloseAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>Import Legacy Injury Records</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    {flash.success && <SuccessAlertFlash message={flash.success} />}
                    {flash.error && <ErrorAlertFlash error={{ message: flash.error }} />}
                    <p className="text-muted-foreground text-sm">
                        Upload an exported Injury Register Excel file (.xlsx). Existing records (matched by ID) will be skipped.
                    </p>
                    <div className="space-y-2">
                        <Label>Excel File (.xlsx)</Label>
                        <Input ref={fileRef} type="file" accept=".xlsx,.xls" />
                    </div>
                    {result && (
                        <div className="space-y-2 rounded-md border p-3">
                            <div className="flex gap-6 text-sm">
                                <span>Imported: <strong className="text-green-600">{result.imported}</strong></span>
                                <span>Skipped: <strong className="text-yellow-600">{result.skipped}</strong></span>
                            </div>
                            {result.errors.length > 0 && (
                                <div>
                                    <p className="text-destructive mb-1 text-sm font-medium">Errors:</p>
                                    <ul className="max-h-40 overflow-y-auto text-sm text-muted-foreground">
                                        {result.errors.map((err, i) => (
                                            <li key={i}>{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleImport} disabled={importing}>
                        {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        {importing ? 'Importing...' : 'Import'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
