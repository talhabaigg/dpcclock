import { Button } from '@/components/ui/button';
import { RotateCcw, Save, X } from 'lucide-react';
import { useCallback } from 'react';
import { toast } from 'sonner';

declare global {
    interface Window {
        colState: any;
    }
}

const GridStateToolbar = ({ gridRef }: { gridRef: any }) => {
    const resetState = useCallback(() => {
        gridRef.current!.api.resetColumnState();
        localStorage.removeItem('colState');
        window.colState = null;

        toast('Column Order reset', {
            description: 'The column order has been reset successfully.',
            action: {
                label: 'Save',
                onClick: () => saveState(),
            },
        });
    }, []);

    const saveState = useCallback(() => {
        const fullState = gridRef.current!.api.getColumnState();
        const filteredState = fullState.map(({ ...rest }) => rest);
        window.colState = filteredState;
        localStorage.setItem('colState', JSON.stringify(filteredState));
        toast('Column Order saved', {
            description: 'The column order has been saved successfully.',
            action: {
                label: 'Undo',
                onClick: () => resetState(),
            },
        });
    }, [resetState]);

    const restoreState = useCallback(() => {
        const savedState = localStorage.getItem('colState');
        if (!savedState) {
            return;
        }
        gridRef.current!.api.applyColumnState({
            state: JSON.parse(savedState),
            applyOrder: true,
        });
        toast('Column Order restored', {
            description: 'The column order has been restored successfully.',
            action: {
                label: 'Clear',
                onClick: () => resetState(),
            },
        });
    }, [resetState]);

    return (
        <>
            <Button onClick={saveState} variant="ghost" title="Save column settings">
                <Save />
            </Button>
            <Button onClick={restoreState} variant="ghost" title="Restore column settings">
                <RotateCcw />
            </Button>
            <Button onClick={resetState} variant="ghost" title="Reset column settings">
                <X />
            </Button>
        </>
    );
};

export { GridStateToolbar };
