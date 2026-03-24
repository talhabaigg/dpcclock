import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Printer } from 'lucide-react';
import { useMemo } from 'react';
import { generateReportHtml, type ManagementReportData } from './management-report-html';

interface ManagementReportDialogProps extends ManagementReportData {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ManagementReportDialog({ open, onOpenChange, ...data }: ManagementReportDialogProps) {
    const html = useMemo(() => (open ? generateReportHtml(data) : ''), [open]);

    const handlePrint = () => {
        const printHtml = generateReportHtml(data);
        const printWindow = window.open('', '', 'width=1200,height=800');
        if (!printWindow) return;

        printWindow.document.write(printHtml);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="min-w-[900px] max-w-6xl h-[90vh] flex flex-col p-0">
                <DialogHeader className="flex flex-row items-center justify-between px-6 pt-5 pb-3 border-b shrink-0">
                    <DialogTitle className="text-sm font-semibold">Monthly Project Report Preview</DialogTitle>
                    <Button onClick={handlePrint} variant="default" size="icon" className="h-8 w-8 mr-2">
                        <Printer className="h-3.5 w-3.5" />
                    </Button>
                </DialogHeader>
                <div className="flex-1 overflow-hidden bg-slate-100 p-4">
                    <iframe
                        srcDoc={html}
                        className="w-full h-full bg-white rounded shadow-sm border"
                        title="Report Preview"
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
