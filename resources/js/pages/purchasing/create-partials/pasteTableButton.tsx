// PasteTableButton.tsx

import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ClipboardPaste } from 'lucide-react';
import { toast } from 'sonner';

interface PasteTableButtonProps {
    rowData: any[];
    setRowData: React.Dispatch<React.SetStateAction<any[]>>;
    projectId: number | null;
    setPastingItems: React.Dispatch<React.SetStateAction<boolean>>;
}

const handlePasteTableData = async (
    rowData: any[],
    setRowData: React.Dispatch<React.SetStateAction<any[]>>,
    projectId: number | null,
    setPastingItems: React.Dispatch<React.SetStateAction<boolean>>,
) => {
    try {
        setPastingItems(true);
        const text = await navigator.clipboard.readText();
        const rows = text.trim().split('\n');

        if (!projectId) {
            alert('Please select a project first.');
            setPastingItems(false);
            return;
        }

        const expiredItems: string[] = [];

        const parsedRows = await Promise.all(
            rows.slice(1).map(async (row, index) => {
                const [codeRaw, descRaw, qtyRaw, unitCostRaw] = row.split('\t');

                const code = codeRaw?.trim() || '';
                const fallbackDescription = descRaw?.trim() || '';
                const qty = parseFloat((qtyRaw?.trim() || '0').replace(/,/g, ''));
                const unit_cost = parseFloat((unitCostRaw?.trim() || '0').replace(/,/g, ''));

                let item = null;
                try {
                    const res = await fetch(`/material-items/code/${code}/${projectId}`);
                    if (res.ok) item = await res.json();
                } catch (err) {
                    alert(`Failed to fetch item with code ${code}. Please check the code and try again.` + err);
                }

                // Check if price is expired
                if (item?.price_expired) {
                    expiredItems.push(code);
                    return null; // Skip this item
                }

                return {
                    code: code,
                    description: item?.description || `${code} ${fallbackDescription}`.trim(),
                    qty,
                    unit_cost: unit_cost ? unit_cost : item?.unit_cost || 0,
                    total_cost: (unit_cost ? unit_cost : item?.unit_cost) * qty,
                    cost_code: item?.cost_code || '',
                    price_list: item?.price_list || '',
                    serial_number: rowData.length + index + 1,
                };
            }),
        );

        // Filter out null items (expired ones)
        const validRows = parsedRows.filter((row) => row !== null);

        // Show warning for expired items
        if (expiredItems.length > 0) {
            toast.error(
                `The following items have expired prices and were not added: ${expiredItems.join(', ')}. Please update the prices in the database or get a quote from the supplier.`,
                { duration: 10000 },
            );
        }

        setRowData([...rowData, ...validRows]);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        setPastingItems(false);
    } catch (err) {
        alert('Unable to paste data. Please try again or check clipboard permissions. ' + err);
        setPastingItems(false);
    }
};

export default function PasteTableButton({ rowData, setRowData, projectId, setPastingItems }: PasteTableButtonProps) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger
                    onClick={() => handlePasteTableData(rowData, setRowData, projectId, setPastingItems)}
                    className="mx-2 h-6 w-6 p-1 text-xs"
                >
                    <ClipboardPaste className="h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent className="h-32 space-y-2">
                    <Label>Click to paste items from Excel in format below</Label>
                    <Table className="mt-2 text-xs">
                        <TableHeader>
                            <TableRow>
                                <TableCell>Item Code</TableCell>
                                <TableCell>Description</TableCell>
                                <TableCell>Qty</TableCell>
                                <TableCell>Unit Cost</TableCell>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell>10303000</TableCell>
                                <TableCell>51mm (w) x 32mm</TableCell>
                                <TableCell>1</TableCell>
                                <TableCell>$10.00</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
