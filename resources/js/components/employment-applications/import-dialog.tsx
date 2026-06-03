import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { router } from '@inertiajs/react';
import { useState } from 'react';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ImportDialog({ open, onOpenChange }: Props) {
    const [file, setFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);

    const submit = () => {
        if (!file) return;
        setImporting(true);
        router.post(
            '/employment-applications/import',
            { file },
            {
                forceFormData: true,
                onFinish: () => {
                    setImporting(false);
                    onOpenChange(false);
                    setFile(null);
                },
            },
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Import Employment Enquiries</DialogTitle>
                    <DialogDescription>
                        Upload an Excel file (.xlsx) to import enquiries.{' '}
                        <a href="/employment-applications/import-template" className="text-primary underline">
                            Download the template
                        </a>{' '}
                        to see the required format.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={submit} disabled={!file || importing}>
                        {importing ? 'Importing...' : 'Import'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
