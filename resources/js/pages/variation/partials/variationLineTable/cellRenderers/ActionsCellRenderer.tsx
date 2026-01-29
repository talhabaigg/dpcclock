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
        <div className="flex items-center justify-center">
            <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 text-muted-foreground "
                onClick={handleDelete}
                aria-label={`Delete line ${props.data?.line_number || ''}`}
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    );
};
