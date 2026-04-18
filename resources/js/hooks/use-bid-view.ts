import { useEffect, useState } from 'react';
import { useHttp } from '@inertiajs/react';
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

    const listHttp = useHttp({});
    const createHttp = useHttp({
        location_id: projectId,
        co_number: '',
        description: '',
        type: 'extra' as 'extra' | 'credit',
    });

    const activeVariation = activeVariationId ? projectVariations.find((v) => v.id === activeVariationId) ?? null : null;

    useEffect(() => {
        listHttp.get(`/drawings/${drawingId}/variation-list`, {
            onSuccess: (data: { variations: VariationSummary[] }) => setProjectVariations(data.variations || []),
        });
    }, [drawingId]);

    const handleCreateVariation = async () => {
        if (!newVarCoNumber.trim() || !newVarDescription.trim()) {
            toast.error('CO number and description are required.');
            return;
        }
        createHttp.setData({
            location_id: projectId,
            co_number: newVarCoNumber.trim(),
            description: newVarDescription.trim(),
            type: newVarType,
        });
        createHttp.post('/variations/quick-store', {
            onSuccess: (data: { variation: VariationSummary }) => {
                const created = data.variation;
                setProjectVariations((prev) => [...prev, created]);
                setBidViewLayers((prev) => ({ ...prev, variations: { ...prev.variations, [created.id]: true } }));
                setActiveVariationId(created.id);
                setShowNewVariationForm(false);
                setNewVarCoNumber('');
                setNewVarDescription('');
                setNewVarType('extra');
                toast.success(`Created ${created.co_number}`);
            },
            onError: () => {
                toast.error('Failed to create variation.');
            },
        });
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
        creatingVariation: createHttp.processing,
        handleCreateVariation,
        resetVariationForm,
    };
}
