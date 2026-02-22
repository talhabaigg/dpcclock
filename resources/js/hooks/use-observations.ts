import { useState } from 'react';
import { api } from '@/lib/api';
import type { Observation, PendingPoint } from '@/types/takeoff';
import { toast } from 'sonner';

type UseObservationsParams = {
    drawingId: number;
    initialObservations: Observation[];
    confirm: (opts: {
        title: string;
        description: string;
        confirmLabel?: string;
        variant?: 'default' | 'destructive';
    }) => Promise<boolean>;
};

export function useObservations({ drawingId, initialObservations, confirm }: UseObservationsParams) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [pendingPoint, setPendingPoint] = useState<PendingPoint | null>(null);
    const [editingObservation, setEditingObservation] = useState<Observation | null>(null);
    const [observationType, setObservationType] = useState<'defect' | 'observation'>('defect');
    const [description, setDescription] = useState('');
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [is360Photo, setIs360Photo] = useState(false);
    const [saving, setSaving] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [describing, setDescribing] = useState(false);
    const [selectedObservationIds, setSelectedObservationIds] = useState<Set<number>>(new Set());
    const [serverObservations, setServerObservations] = useState<Observation[]>(initialObservations);

    const resetDialog = () => {
        setPendingPoint(null);
        setEditingObservation(null);
        setObservationType('defect');
        setDescription('');
        setPhotoFile(null);
        setIs360Photo(false);
    };

    const detect360FromFile = (file: File) => {
        const img = new Image();
        img.onload = () => {
            const aspectRatio = img.naturalWidth / img.naturalHeight;
            if (Math.abs(aspectRatio - 2.0) < 0.05) {
                setIs360Photo(true);
            }
            URL.revokeObjectURL(img.src);
        };
        img.src = URL.createObjectURL(file);
    };

    const handleCreateObservation = async () => {
        if (!pendingPoint) return;
        if (!description.trim()) {
            toast.error('Please add a description.');
            return;
        }

        setSaving(true);

        try {
            const formData = new FormData();
            formData.append('type', observationType);
            formData.append('description', description.trim());
            formData.append('page_number', pendingPoint.pageNumber.toString());
            formData.append('x', pendingPoint.x.toString());
            formData.append('y', pendingPoint.y.toString());
            if (photoFile) {
                formData.append('photo', photoFile);
            }
            formData.append('is_360_photo', is360Photo ? '1' : '0');

            const saved = await api.post<Observation>(`/drawings/${drawingId}/observations`, formData);
            setServerObservations((prev) => [...prev, saved]);
            toast.success('Observation saved.');
            setDialogOpen(false);
            resetDialog();
        } catch {
            toast.error('Failed to save observation.');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateObservation = async () => {
        if (!editingObservation) return;
        if (!description.trim()) {
            toast.error('Please add a description.');
            return;
        }

        setSaving(true);

        try {
            const formData = new FormData();
            formData.append('type', observationType);
            formData.append('description', description.trim());
            formData.append('page_number', editingObservation.page_number.toString());
            formData.append('x', editingObservation.x.toString());
            formData.append('y', editingObservation.y.toString());
            if (photoFile) {
                formData.append('photo', photoFile);
            }
            formData.append('is_360_photo', is360Photo ? '1' : '0');

            const saved = await api.post<Observation>(
                `/drawings/${drawingId}/observations/${editingObservation.id}`,
                formData,
            );
            setServerObservations((prev) => prev.map((obs) => (obs.id === saved.id ? saved : obs)));
            toast.success('Observation updated.');
            setDialogOpen(false);
            resetDialog();
        } catch {
            toast.error('Failed to update observation.');
        } finally {
            setSaving(false);
        }
    };

    const handleConfirmObservation = async () => {
        if (!editingObservation || editingObservation.source !== 'ai_comparison') return;

        setConfirming(true);

        try {
            const confirmed = await api.post<Observation>(
                `/drawings/${drawingId}/observations/${editingObservation.id}/confirm`,
            );
            setServerObservations((prev) => prev.map((obs) => (obs.id === confirmed.id ? confirmed : obs)));
            setEditingObservation(confirmed);
            toast.success('AI observation confirmed.');
        } catch {
            toast.error('Failed to confirm observation.');
        } finally {
            setConfirming(false);
        }
    };

    const handleDeleteObservation = async () => {
        if (!editingObservation) return;

        const confirmed = await confirm({
            title: 'Delete observation',
            description: 'Are you sure you want to delete this observation? This action cannot be undone.',
            confirmLabel: 'Delete',
            variant: 'destructive',
        });
        if (!confirmed) return;

        setDeleting(true);

        try {
            await api.delete(`/drawings/${drawingId}/observations/${editingObservation.id}`);
            setServerObservations((prev) => prev.filter((obs) => obs.id !== editingObservation.id));
            setDialogOpen(false);
            resetDialog();
            toast.success('Observation deleted.');
        } catch {
            toast.error('Failed to delete observation.');
        } finally {
            setDeleting(false);
        }
    };

    const handleDescribeWithAI = async () => {
        if (!editingObservation || editingObservation.source !== 'ai_comparison') return;

        setDescribing(true);

        try {
            const data = await api.post<{ success: boolean; observation: Observation; message?: string }>(
                `/drawings/${drawingId}/observations/${editingObservation.id}/describe`,
            );

            if (!data.success) {
                throw new Error(data.message || 'Request failed');
            }

            setServerObservations((prev) =>
                prev.map((obs) => (obs.id === editingObservation.id ? data.observation : obs)),
            );
            setEditingObservation(data.observation);
            setDescription(data.observation.description);
            toast.success('AI description generated.');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to describe with AI.');
        } finally {
            setDescribing(false);
        }
    };

    const handleDeleteAllAIObservations = async () => {
        const aiObservations = serverObservations.filter((obs) => obs.source === 'ai_comparison');
        if (aiObservations.length === 0) {
            toast.info('No AI observations to delete.');
            return;
        }

        const confirmed = await confirm({
            title: 'Delete all AI observations',
            description: `Are you sure you want to delete all ${aiObservations.length} AI-generated observations? This action cannot be undone.`,
            confirmLabel: 'Delete all',
            variant: 'destructive',
        });
        if (!confirmed) return;

        setBulkDeleting(true);

        try {
            const ids = aiObservations.map((obs) => obs.id);
            const data = await api.post<{ success: boolean; deleted_count: number; failed_count: number }>(
                `/drawings/${drawingId}/observations/bulk-delete`,
                { observation_ids: ids },
            );

            setServerObservations((prev) => prev.filter((obs) => obs.source !== 'ai_comparison'));

            if (data.failed_count === 0) {
                toast.success(`Deleted ${data.deleted_count} AI observations.`);
            } else {
                toast.warning(`Deleted ${data.deleted_count} observations. ${data.failed_count} failed.`);
            }
        } catch {
            toast.error('Failed to delete AI observations.');
        } finally {
            setBulkDeleting(false);
        }
    };

    const handleDeleteSelectedObservations = async () => {
        if (selectedObservationIds.size === 0) {
            toast.info('No observations selected.');
            return;
        }

        const confirmed = await confirm({
            title: 'Delete selected observations',
            description: `Are you sure you want to delete ${selectedObservationIds.size} selected observation${selectedObservationIds.size !== 1 ? 's' : ''}? This action cannot be undone.`,
            confirmLabel: 'Delete selected',
            variant: 'destructive',
        });
        if (!confirmed) return;

        setBulkDeleting(true);

        try {
            const ids = serverObservations.filter((obs) => selectedObservationIds.has(obs.id)).map((obs) => obs.id);

            if (ids.length === 0) {
                toast.warning('Selected observations not found in current list.');
                setBulkDeleting(false);
                setSelectedObservationIds(new Set());
                return;
            }

            const data = await api.post<{ success: boolean; deleted_count: number; failed_count: number }>(
                `/drawings/${drawingId}/observations/bulk-delete`,
                { observation_ids: ids },
            );

            const deletedSet = new Set(ids);
            setServerObservations((prev) => prev.filter((obs) => !deletedSet.has(obs.id)));
            setSelectedObservationIds(new Set());

            if (data.failed_count === 0) {
                toast.success(
                    `Deleted ${data.deleted_count} observation${data.deleted_count !== 1 ? 's' : ''}.`,
                );
            } else {
                toast.warning(`Deleted ${data.deleted_count} observations. ${data.failed_count} failed.`);
            }
        } catch {
            toast.error('Failed to delete selected observations.');
        } finally {
            setBulkDeleting(false);
        }
    };

    const handleClearSelection = () => {
        setSelectedObservationIds(new Set());
    };

    const openForNew = (x: number, y: number) => {
        resetDialog();
        setPendingPoint({ pageNumber: 1, x, y });
        setDialogOpen(true);
    };

    const openForEdit = (obs: Observation) => {
        setEditingObservation(obs);
        setObservationType(obs.type);
        setDescription(obs.description);
        setIs360Photo(obs.is_360_photo ?? false);
        setDialogOpen(true);
    };

    return {
        dialogOpen,
        setDialogOpen,
        pendingPoint,
        editingObservation,
        observationType,
        setObservationType,
        description,
        setDescription,
        photoFile,
        setPhotoFile,
        is360Photo,
        setIs360Photo,
        saving,
        confirming,
        deleting,
        bulkDeleting,
        describing,
        selectedObservationIds,
        setSelectedObservationIds,
        serverObservations,
        setServerObservations,
        resetDialog,
        detect360FromFile,
        handleCreateObservation,
        handleUpdateObservation,
        handleConfirmObservation,
        handleDeleteObservation,
        handleDescribeWithAI,
        handleDeleteAllAIObservations,
        handleDeleteSelectedObservations,
        handleClearSelection,
        openForNew,
        openForEdit,
    };
}
