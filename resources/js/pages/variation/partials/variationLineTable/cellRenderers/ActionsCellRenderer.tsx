import { Button } from '@/components/ui/button';
import { CustomCellRendererProps } from 'ag-grid-react';
import { Trash2 } from 'lucide-react';

interface ActionsCellRendererProps extends CustomCellRendererProps {
    onDelete?: (data: any) => void;
    canDelete?: boolean;
}

export const ActionsCellRenderer = (props: ActionsCellRendererProps) => {
    const handleDelete = () => {
        if (props.onDelete && props.data) {
            props.onDelete(props.data);
        }
    };

    if (!props.canDelete) {
        return null;
    }

    return (
        <div className="flex h-full items-center justify-center">
            <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7 w-7"
                onClick={handleDelete}
                aria-label={`Delete line ${props.data?.line_number || ''}`}
            >
                <Trash2 className="h-3.5 w-3.5" />
            </Button>
        </div>
    );
};
