import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { VariationSummary } from '@/types/takeoff';
import { toast } from 'sonner';

type UseBidViewParams = {
    drawingId: number;
    projectId: number;
};

export function useBidView({ drawingId, projectId }: UseBidViewParams) {
    const [projectVariations, setProjectVariations] = useState<VariationSummary[]>([]);
    const [showBidViewPanel, setShowBidViewPanel] = useState(false);
    const [bidViewLayers, setBidViewLayers] = useState<{
        baseBid: boolean;
        variations: Record<number, boolean>;
    }>({ baseBid: true, variations: {} });
    const [activeVariationId, setActiveVariationId] = useState<number | null>(null);
    const [showNewVariationForm, setShowNewVariationForm] = useState(false);
    const [newVarCoNumber, setNewVarCoNumber] = useState('');
    const [newVarDescription, setNewVarDescription] = useState('');
    const [newVarType, setNewVarType] = useState<'extra' | 'credit'>('extra');
    const [creatingVariation, setCreatingVariation] = useState(false);

    const activeVariation = activeVariationId ? projectVariations.find((v) => v.id === activeVariationId) ?? null : null;

    useEffect(() => {
        api.get<{ variations: VariationSummary[] }>(`/drawings/${drawingId}/variation-list`)
            .then((data) => setProjectVariations(data.variations || []))
            .catch(() => {});
    }, [drawingId]);

    const handleCreateVariation = async () => {
        if (!newVarCoNumber.trim() || !newVarDescription.trim()) {
            toast.error('CO number and description are required.');
            return;
        }
        setCreatingVariation(true);
        try {
            const data = await api.post<{ variation: VariationSummary }>('/variations/quick-store', {
                location_id: projectId,
                co_number: newVarCoNumber.trim(),
                description: newVarDescription.trim(),
                type: newVarType,
            });
            const created = data.variation;
            setProjectVariations((prev) => [...prev, created]);
            setBidViewLayers((prev) => ({ ...prev, variations: { ...prev.variations, [created.id]: true } }));
            setActiveVariationId(created.id);
            setShowNewVariationForm(false);
            setNewVarCoNumber('');
            setNewVarDescription('');
            setNewVarType('extra');
            toast.success(`Created ${created.co_number}`);
        } catch {
            toast.error('Failed to create variation.');
        } finally {
            setCreatingVariation(false);
        }
    };

    const resetVariationForm = () => {
        setNewVarCoNumber('');
        setNewVarDescription('');
        setNewVarType('extra');
        setShowNewVariationForm(false);
    };

    return {
        projectVariations,
        setProjectVariations,
        showBidViewPanel,
        setShowBidViewPanel,
        bidViewLayers,
        setBidViewLayers,
        activeVariationId,
        setActiveVariationId,
        activeVariation,
        showNewVariationForm,
        setShowNewVariationForm,
        newVarCoNumber,
        setNewVarCoNumber,
        newVarDescription,
        setNewVarDescription,
        newVarType,
        setNewVarType,
        creatingVariation,
        handleCreateVariation,
        resetVariationForm,
    };
}
