import { useState } from 'react';
import { useHttp } from '@inertiajs/react';
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
    const [selectedObservationIds, setSelectedObservationIds] = useState<Set<number>>(new Set());
    const [serverObservations, setServerObservations] = useState<Observation[]>(initialObservations);

    const saveHttp = useHttp({});
    const confirmHttp = useHttp({});
    const deleteHttp = useHttp({});
    const bulkDeleteHttp = useHttp({ observation_ids: [] as number[] });
    const describeHttp = useHttp({});

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

        saveHttp.setData(formData as any);
        saveHttp.post(`/drawings/${drawingId}/observations`, {
            onSuccess: (data: Observation) => {
                setServerObservations((prev) => [...prev, data]);
                toast.success('Observation saved.');
                setDialogOpen(false);
                resetDialog();
            },
            onError: () => {
                toast.error('Failed to save observation.');
            },
        });
    };

    const handleUpdateObservation = async () => {
        if (!editingObservation) return;
        if (!description.trim()) {
            toast.error('Please add a description.');
            return;
        }

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

        saveHttp.setData(formData as any);
        saveHttp.post(`/drawings/${drawingId}/observations/${editingObservation.id}`, {
            onSuccess: (data: Observation) => {
                setServerObservations((prev) => prev.map((obs) => (obs.id === data.id ? data : obs)));
                toast.success('Observation updated.');
                setDialogOpen(false);
                resetDialog();
            },
            onError: () => {
                toast.error('Failed to update observation.');
            },
        });
    };

    const handleConfirmObservation = async () => {
        if (!editingObservation || editingObservation.source !== 'ai_comparison') return;

        confirmHttp.post(`/drawings/${drawingId}/observations/${editingObservation.id}/confirm`, {
            onSuccess: (data: Observation) => {
                setServerObservations((prev) => prev.map((obs) => (obs.id === data.id ? data : obs)));
                setEditingObservation(data);
                toast.success('AI observation confirmed.');
            },
            onError: () => {
                toast.error('Failed to confirm observation.');
            },
        });
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

        deleteHttp.delete(`/drawings/${drawingId}/observations/${editingObservation.id}`, {
            onSuccess: () => {
                setServerObservations((prev) => prev.filter((obs) => obs.id !== editingObservation.id));
                setDialogOpen(false);
                resetDialog();
                toast.success('Observation deleted.');
            },
            onError: () => {
                toast.error('Failed to delete observation.');
            },
        });
    };

    const handleDescribeWithAI = async () => {
        if (!editingObservation || editingObservation.source !== 'ai_comparison') return;

        describeHttp.post(`/drawings/${drawingId}/observations/${editingObservation.id}/describe`, {
            onSuccess: (data: { success: boolean; observation: Observation; message?: string }) => {
                if (!data.success) {
                    toast.error(data.message || 'Request failed');
                    return;
                }

                setServerObservations((prev) =>
                    prev.map((obs) => (obs.id === editingObservation.id ? data.observation : obs)),
                );
                setEditingObservation(data.observation);
                setDescription(data.observation.description);
                toast.success('AI description generated.');
            },
            onError: () => {
                toast.error('Failed to describe with AI.');
            },
        });
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

        const ids = aiObservations.map((obs) => obs.id);
        bulkDeleteHttp.setData({ observation_ids: ids });
        bulkDeleteHttp.post(`/drawings/${drawingId}/observations/bulk-delete`, {
            onSuccess: (data: { success: boolean; deleted_count: number; failed_count: number }) => {
                setServerObservations((prev) => prev.filter((obs) => obs.source !== 'ai_comparison'));

                if (data.failed_count === 0) {
                    toast.success(`Deleted ${data.deleted_count} AI observations.`);
                } else {
                    toast.warning(`Deleted ${data.deleted_count} observations. ${data.failed_count} failed.`);
                }
            },
            onError: () => {
                toast.error('Failed to delete AI observations.');
            },
        });
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

        const ids = serverObservations.filter((obs) => selectedObservationIds.has(obs.id)).map((obs) => obs.id);

        if (ids.length === 0) {
            toast.warning('Selected observations not found in current list.');
            setSelectedObservationIds(new Set());
            return;
        }

        bulkDeleteHttp.setData({ observation_ids: ids });
        bulkDeleteHttp.post(`/drawings/${drawingId}/observations/bulk-delete`, {
            onSuccess: (data: { success: boolean; deleted_count: number; failed_count: number }) => {
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
            },
            onError: () => {
                toast.error('Failed to delete selected observations.');
            },
        });
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
        saving: saveHttp.processing,
        confirming: confirmHttp.processing,
        deleting: deleteHttp.processing,
        bulkDeleting: bulkDeleteHttp.processing,
        describing: describeHttp.processing,
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
