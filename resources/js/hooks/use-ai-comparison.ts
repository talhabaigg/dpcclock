import { useState } from 'react';
import { api } from '@/lib/api';
import type { AIComparisonResult } from '@/types/takeoff';
import { router } from '@inertiajs/react';
import { toast } from 'sonner';

type UseAIComparisonParams = {
    drawingId: number;
    revisions: Array<{
        id: number;
        revision_number?: string | null;
        revision?: string | null;
        drawing_title?: string | null;
        drawing_number?: string | null;
        file_url?: string;
    }>;
};

export function useAIComparison({ drawingId, revisions }: UseAIComparisonParams) {
    const [showDialog, setShowDialog] = useState(false);
    const [drawingA, setDrawingA] = useState<string>('');
    const [drawingB, setDrawingB] = useState<string>('');
    const [comparing, setComparing] = useState(false);
    const [result, setResult] = useState<AIComparisonResult | null>(null);
    const [selectedChanges, setSelectedChanges] = useState<Set<number>>(new Set());
    const [customPrompt, setCustomPrompt] = useState('');
    const [savingObservations, setSavingObservations] = useState(false);

    const handleCompare = async (additionalPrompt?: string) => {
        if (!drawingA || !drawingB) {
            toast.error('Please select two revisions to compare.');
            return;
        }

        setComparing(true);
        setResult(null);
        setSelectedChanges(new Set());

        try {
            const data = await api.post<{
                success: boolean;
                comparison: {
                    summary: string;
                    changes: AIComparisonResult['changes'];
                    confidence?: string;
                    notes?: string;
                };
                message?: string;
                error?: string;
            }>('/drawings/compare', {
                drawing_a_id: parseInt(drawingA),
                drawing_b_id: parseInt(drawingB),
                context: 'walls and ceilings construction drawings',
                additional_prompt: additionalPrompt || undefined,
            });

            if (!data.success) {
                throw new Error(data.message || data.error || 'Comparison failed');
            }

            const comparison = data.comparison;
            setResult({
                summary: comparison?.summary ?? null,
                changes: comparison?.changes || [],
                confidence: comparison?.confidence,
                notes: comparison?.notes,
            });

            toast.success('AI comparison complete!');
        } catch (error) {
            console.error('AI comparison error:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to compare revisions');
        } finally {
            setComparing(false);
        }
    };

    const handleToggleChange = (index: number) => {
        setSelectedChanges((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    };

    const handleSelectAll = () => {
        if (result?.changes) {
            setSelectedChanges(new Set(result.changes.map((_, i) => i)));
        }
    };

    const handleDeselectAll = () => {
        setSelectedChanges(new Set());
    };

    const handleSaveAsObservations = async () => {
        if (!result || selectedChanges.size === 0) {
            toast.error('Please select at least one change to save.');
            return;
        }

        setSavingObservations(true);

        try {
            const selectedChangesToSave = result.changes.filter((_, index) => selectedChanges.has(index));

            const data = await api.post<{ success: boolean; observations?: unknown[]; message?: string }>('/drawings/compare/save-observations', {
                target_drawing_id: drawingId,
                drawing_a_id: parseInt(drawingA),
                drawing_b_id: parseInt(drawingB),
                changes: selectedChangesToSave,
            });

            if (data.success) {
                const created = Array.isArray(data.observations) ? data.observations.length : 0;
                toast.success(data.message || `Saved ${created} observations successfully!`);
                setSelectedChanges(new Set());
                router.reload({ only: ['drawing'] });
            } else {
                throw new Error(data.message || 'Failed to save observations');
            }
        } catch (error) {
            console.error('Save observations error:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to save observations');
        } finally {
            setSavingObservations(false);
        }
    };

    const handleRegenerate = () => {
        handleCompare(customPrompt || undefined);
    };

    const openDialog = () => {
        const currentId = String(drawingId);
        const otherRevisions = revisions.filter((r) => r.id !== drawingId);
        const previousId = otherRevisions.length > 0 ? String(otherRevisions[0].id) : '';
        setDrawingA(previousId);
        setDrawingB(currentId);
        setResult(null);
        setShowDialog(true);
    };

    return {
        showDialog,
        setShowDialog,
        drawingA,
        setDrawingA,
        drawingB,
        setDrawingB,
        comparing,
        result,
        selectedChanges,
        customPrompt,
        setCustomPrompt,
        savingObservations,
        handleCompare,
        handleToggleChange,
        handleSelectAll,
        handleDeselectAll,
        handleSaveAsObservations,
        handleRegenerate,
        openDialog,
    };
}
