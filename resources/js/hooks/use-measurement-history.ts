import { useHttp } from '@inertiajs/react';
import type { MeasurementData } from '@/components/measurement-layer';
import { useCallback, useRef } from 'react';
import { toast } from 'sonner';

const MAX_STACK = 50;

type UndoAction =
    | { type: 'create'; measurement: MeasurementData; drawingId: number }
    | { type: 'delete'; measurement: MeasurementData; drawingId: number }
    | { type: 'update'; measurementId: number; drawingId: number; before: Partial<MeasurementData>; after: Partial<MeasurementData> };

type Callbacks = {
    onMeasurementRestored: (measurement: MeasurementData) => void;
    onMeasurementRemoved: (measurementId: number) => void;
    onMeasurementUpdated: (measurement: MeasurementData) => void;
};

export function useMeasurementHistory(callbacks: Callbacks) {
    const undoStackRef = useRef<UndoAction[]>([]);
    const redoStackRef = useRef<UndoAction[]>([]);
    const processingRef = useRef(false);

    const http = useHttp({});

    const pushUndo = useCallback((action: UndoAction) => {
        undoStackRef.current.push(action);
        if (undoStackRef.current.length > MAX_STACK) {
            undoStackRef.current.shift();
        }
        redoStackRef.current = [];
    }, []);

    const executeAction = useCallback(
        async (action: UndoAction, isUndo: boolean) => {
            if (processingRef.current) return;
            processingRef.current = true;

            try {
                if (action.type === 'create' && isUndo) {
                    await http.delete(`/drawings/${action.drawingId}/measurements/${action.measurement.id}`, {
                        onSuccess: () => {
                            callbacks.onMeasurementRemoved(action.measurement.id);
                            toast.success('Undo: measurement removed');
                        },
                    });
                } else if (action.type === 'create' && !isUndo) {
                    await http.post(
                        `/drawings/${action.drawingId}/measurements/${action.measurement.id}/restore`,
                        {
                            onSuccess: (data: MeasurementData) => {
                                callbacks.onMeasurementRestored(data);
                                toast.success('Redo: measurement restored');
                            },
                        },
                    );
                } else if (action.type === 'delete' && isUndo) {
                    await http.post(
                        `/drawings/${action.drawingId}/measurements/${action.measurement.id}/restore`,
                        {
                            onSuccess: (data: MeasurementData) => {
                                callbacks.onMeasurementRestored(data);
                                toast.success('Undo: measurement restored');
                            },
                        },
                    );
                } else if (action.type === 'delete' && !isUndo) {
                    await http.delete(`/drawings/${action.drawingId}/measurements/${action.measurement.id}`, {
                        onSuccess: () => {
                            callbacks.onMeasurementRemoved(action.measurement.id);
                            toast.success('Redo: measurement removed');
                        },
                    });
                } else if (action.type === 'update') {
                    const payload = isUndo ? action.before : action.after;
                    http.setData(payload);
                    await http.put(
                        `/drawings/${action.drawingId}/measurements/${action.measurementId}`,
                        {
                            onSuccess: (data: MeasurementData) => {
                                callbacks.onMeasurementUpdated(data);
                                toast.success(isUndo ? 'Undo: measurement reverted' : 'Redo: measurement updated');
                            },
                        },
                    );
                }
            } catch {
                toast.error(isUndo ? 'Undo failed' : 'Redo failed');
            } finally {
                processingRef.current = false;
            }
        },
        [callbacks, http],
    );

    const undo = useCallback(() => {
        const action = undoStackRef.current.pop();
        if (!action) return;
        redoStackRef.current.push(action);
        executeAction(action, true);
    }, [executeAction]);

    const redo = useCallback(() => {
        const action = redoStackRef.current.pop();
        if (!action) return;
        undoStackRef.current.push(action);
        executeAction(action, false);
    }, [executeAction]);

    const canUndo = useCallback(() => undoStackRef.current.length > 0, []);
    const canRedo = useCallback(() => redoStackRef.current.length > 0, []);

    return { pushUndo, undo, redo, canUndo, canRedo };
}
