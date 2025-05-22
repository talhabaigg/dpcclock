import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ClipboardPaste } from 'lucide-react';

interface PasteTableButtonProps {
    onClick: () => void;
}
export default function PasteTableButton({ onClick }: PasteTableButtonProps) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger onClick={onClick} className="mx-2 h-6 w-6 p-1 text-xs">
                    <ClipboardPaste className="h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent className="h-32 space-y-2">
                    <Label>Click to paste items from excel in format below</Label>
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
