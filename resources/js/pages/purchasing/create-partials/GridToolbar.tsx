import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { RefObject, ReactNode } from 'react';
import { AgGridReact } from 'ag-grid-react';
import GridSizeSelector from './gridSizeSelector';
import { GridStateToolbar } from './gridStateToolbar';
import PasteTableButton from './pasteTableButton';

interface GridToolbarProps {
    onAddRow: () => void;
    onDeleteRow: () => void;
    gridRef: RefObject<AgGridReact | null>;
    rowData: any[];
    setRowData: (data: any[]) => void;
    projectId: number;
    setPastingItems: (value: boolean) => void;
    onGridSizeChange: (size: string) => void;
    extraActions?: ReactNode;
}

export function GridToolbar({
    onAddRow,
    onDeleteRow,
    gridRef,
    rowData,
    setRowData,
    projectId,
    setPastingItems,
    onGridSizeChange,
    extraActions,
}: GridToolbarProps) {
    return (
        <div className="flex flex-shrink-0 items-center justify-between border-b bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-1.5">
                <Button
                    variant="default"
                    size="sm"
                    onClick={onAddRow}
                    className="h-7 gap-1.5 bg-primary/90 px-3 text-xs font-medium shadow-sm hover:bg-primary"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Add Row
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDeleteRow}
                    className="h-7 gap-1.5 px-2.5 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Delete</span>
                </Button>
                {extraActions}
            </div>

            <div className="flex items-center gap-1.5">
                <div className="hidden items-center gap-1 sm:flex">
                    <GridStateToolbar gridRef={gridRef} />
                    <PasteTableButton
                        rowData={rowData}
                        setRowData={setRowData}
                        projectId={projectId}
                        setPastingItems={setPastingItems}
                    />
                </div>
                <GridSizeSelector onChange={onGridSizeChange} />
            </div>
        </div>
    );
}
