import { Button } from '@/components/ui/button';
import { RotateCcw, Save, X } from 'lucide-react';
import { useCallback } from 'react';
import { toast } from 'sonner';

const GridStateToolbar = ({ gridRef }: { gridRef: any }) => {
    const resetState = useCallback(() => {
        gridRef.current!.api.resetColumnState();
        localStorage.removeItem('colState');
        window.colState = null;
        console.log('column state reset');
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
        const filteredState = fullState.map(({ width, ...rest }) => rest);
        window.colState = filteredState;
        localStorage.setItem('colState', JSON.stringify(filteredState));
        console.log('column state saved (no width)', filteredState);
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
            console.log('no columns state to restore by, you must save state first');
            return;
        }
        gridRef.current!.api.applyColumnState({
            state: JSON.parse(savedState),
            applyOrder: true,
        });
        console.log('column state restored', window.colState);
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
            <Button onClick={saveState} variant="icon" title="Save column settings">
                <Save />
            </Button>
            <Button onClick={restoreState} variant="icon" title="Restore column settings">
                <RotateCcw />
            </Button>
            <Button onClick={resetState} variant="icon" title="Reset column settings">
                <X />
            </Button>
        </>
    );
};

export { GridStateToolbar };
