import { Button } from '@/components/ui/button';
import { AgGridReact } from 'ag-grid-react';
import { Plus, Trash2 } from 'lucide-react';
import { ReactNode, RefObject } from 'react';
import GridSizeSelector from './gridSizeSelector';
import { GridStateToolbar } from './gridStateToolbar';

interface GridToolbarProps {
    onAddRow: () => void;
    onDeleteRow: () => void;
    gridRef: RefObject<AgGridReact | null>;
    onGridSizeChange: (size: string) => void;
    extraActions?: ReactNode;
}

export function GridToolbar({
    onAddRow,
    onDeleteRow,
    gridRef,
    onGridSizeChange,
    extraActions,
}: GridToolbarProps) {
    return (
        <div className="bg-muted/30 flex flex-shrink-0 items-center justify-between border-b px-3 py-2">
            <div className="flex items-center gap-1.5">
                <Button
                    variant="default"
                    size="sm"
                    onClick={onAddRow}
                    className="bg-primary/90 hover:bg-primary h-7 gap-1.5 px-3 text-xs font-medium shadow-sm"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Add Row
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDeleteRow}
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-7 gap-1.5 px-2.5 text-xs"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Delete</span>
                </Button>
                {extraActions}
            </div>

            <div className="flex items-center gap-1.5">
                <div className="hidden items-center gap-1 sm:flex">
                    <GridStateToolbar gridRef={gridRef} />
                </div>
                <GridSizeSelector onChange={onGridSizeChange} />
            </div>
        </div>
    );
}
