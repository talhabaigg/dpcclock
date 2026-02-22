import { useState } from 'react';
import { api } from '@/lib/api';
import type { Point, CalibrationData, MeasurementData, ViewMode } from '@/components/measurement-layer';
import { toast } from 'sonner';

type UseCalibrationParams = {
    drawingId: number;
    confirm: (opts: { title: string; description: string; confirmLabel?: string; variant?: 'default' | 'destructive' }) => Promise<boolean>;
    onCalibrationSaved: (calibration: CalibrationData, measurements: MeasurementData[]) => void;
    onCalibrationDeleted: () => void;
    setViewMode: (mode: ViewMode) => void;
    setShowTakeoffPanel: (show: boolean) => void;
};

export function useCalibration({
    drawingId,
    confirm,
    onCalibrationSaved,
    onCalibrationDeleted,
    setViewMode,
    setShowTakeoffPanel,
}: UseCalibrationParams) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [method, setMethod] = useState<'manual' | 'preset'>('preset');
    const [pendingPoints, setPendingPoints] = useState<{ a: Point; b: Point } | null>(null);
    const [distance, setDistance] = useState('');
    const [unit, setUnit] = useState('m');
    const [paperSize, setPaperSize] = useState('A1');
    const [scale, setScale] = useState('1:50');
    const [customScale, setCustomScale] = useState('');
    const [saving, setSaving] = useState(false);

    const handleCalibrationComplete = (pointA: Point, pointB: Point) => {
        setPendingPoints({ a: pointA, b: pointB });
        setMethod('manual');
        setDialogOpen(true);
        setViewMode('pan');
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            let body: Record<string, unknown>;
            if (method === 'manual') {
                if (!pendingPoints) {
                    toast.error('Draw a reference line first.');
                    setSaving(false);
                    return;
                }
                body = {
                    method: 'manual',
                    point_a_x: pendingPoints.a.x,
                    point_a_y: pendingPoints.a.y,
                    point_b_x: pendingPoints.b.x,
                    point_b_y: pendingPoints.b.y,
                    real_distance: parseFloat(distance),
                    unit,
                };
            } else {
                const scaleValue = scale === 'Custom' ? customScale : scale;
                body = {
                    method: 'preset',
                    paper_size: paperSize,
                    drawing_scale: scaleValue,
                    unit,
                };
            }

            const data = await api.post<{ calibration: CalibrationData; measurements: MeasurementData[] }>(
                `/drawings/${drawingId}/calibration`,
                body,
            );
            onCalibrationSaved(data.calibration, data.measurements || []);
            setDialogOpen(false);
            setPendingPoints(null);
            toast.success('Scale calibration saved.');
        } catch {
            toast.error('Failed to save calibration.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        const confirmed = await confirm({
            title: 'Delete Calibration',
            description: 'Delete scale calibration? Measurement values will be cleared.',
            confirmLabel: 'Delete',
            variant: 'destructive',
        });
        if (!confirmed) return;

        try {
            await api.delete(`/drawings/${drawingId}/calibration`);
            onCalibrationDeleted();
            toast.success('Calibration deleted.');
        } catch {
            toast.error('Failed to delete calibration.');
        }
    };

    const handleOpenDialog = (m: 'manual' | 'preset') => {
        if (m === 'manual') {
            setViewMode('calibrate');
            setShowTakeoffPanel(true);
        } else {
            setMethod('preset');
            setDialogOpen(true);
        }
    };

    return {
        dialogOpen,
        setDialogOpen,
        method,
        setMethod,
        pendingPoints,
        distance,
        setDistance,
        unit,
        setUnit,
        paperSize,
        setPaperSize,
        scale,
        setScale,
        customScale,
        setCustomScale,
        saving,
        handleCalibrationComplete,
        handleSave,
        handleDelete,
        handleOpenDialog,
    };
}
