import type { ChangeItem } from '@/components/drawings/change-detection-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

/**
 * One change at a time, with a decision to make about it.
 *
 * A list of forty changes is something to scroll past; a deck of forty
 * decisions is something a person finishes. The deck is ordered by
 * significance so the changes that affect what gets built are ruled on while
 * attention is freshest, and the animation leads because seeing what moved is
 * a glance where reading a description of it is a paragraph.
 *
 * Navigation moves over the whole deck rather than only the undecided cards,
 * so "previous" can reach one that was just ruled on — second thoughts about
 * the last decision are the usual reason to go back.
 */
export function ChangeReviewCard({
    drawingId,
    item,
    position,
    total,
    onDecided,
    onLocate,
    onPrev,
    onNext,
    canPrev,
    canNext,
}: {
    drawingId: number;
    item: ChangeItem;
    position: number;
    total: number;
    onDecided: (item: ChangeItem, decision: 'accept' | 'dismiss') => void;
    onLocate?: (item: ChangeItem) => void;
    onPrev: () => void;
    onNext: () => void;
    canPrev: boolean;
    canNext: boolean;
}) {
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState<'accept' | 'dismiss' | null>(null);

    // Each change is its own decision — carrying the previous card's wording
    // forward would quietly attach the wrong text to a task.
    useEffect(() => {
        setDescription(item.description ?? 'Change detected on revision comparison');
        setSaving(null);
    }, [item.id, item.description]);

    // Held in a ref so an inline callback from the parent does not re-fire the
    // jump on every render.
    const onLocateRef = useRef(onLocate);
    onLocateRef.current = onLocate;

    // The drawing follows the deck, so the card and the sheet never disagree
    // about what is being looked at.
    useEffect(() => {
        onLocateRef.current?.(item);
    }, [item]);

    const decided = item.triage_status;

    const decide = async (decision: 'accept' | 'dismiss') => {
        setSaving(decision);
        try {
            await api.post(`/drawings/${drawingId}/comparison/items/${item.id}/triage`, {
                decision,
                title: description.trim() || undefined,
                comment: description.trim() || undefined,
            });
            toast.success(decision === 'accept' ? 'Variation task raised' : 'Marked as not a change');
            onDecided(item, decision);
        } catch {
            toast.error(decision === 'accept' ? 'Could not raise the task' : 'Could not save');
            setSaving(null);
        }
    };

    return (
        // Lifted off the panel: the deck is the thing being worked through, so
        // it should read as a card sitting on top rather than another section
        // of the list behind it.
        <div className="bg-card space-y-2.5 rounded-lg border p-3 shadow-lg">
            <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-[11px] tabular-nums">
                    {position} of {total}
                </span>
                <span className="flex items-center gap-1.5">
                    {item.significance && item.significance !== 'low' && (
                        <Badge variant={item.significance === 'high' ? 'destructive' : 'default'} className="h-4 px-1.5 text-[10px] capitalize">
                            {item.significance}
                        </Badge>
                    )}
                    {item.element && <span className="text-muted-foreground truncate text-[11px]">{item.element}</span>}
                </span>
            </div>

            {/* Thumbnail first: the fastest read of what actually moved. */}
            {item.preview_url ? (
                <img src={item.preview_url} alt={`Before and after of ${item.element ?? 'this change'}`} className="w-full rounded border" />
            ) : (
                <div className="text-muted-foreground rounded border px-2 py-8 text-center text-[11px]">No before/after image for this change</div>
            )}

            {/* A textarea rather than a single line: these descriptions run to
                a full sentence and the reviewer is editing what becomes the
                task name, so it has to be readable in full. */}
            <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the change"
                rows={3}
                className="resize-none text-xs leading-snug"
                aria-label="Description of change"
            />

            {decided ? (
                <div
                    className={cn(
                        'rounded-md border px-2 py-2.5 text-center text-xs',
                        decided === 'accepted' ? 'border-success/40 text-success' : 'text-muted-foreground',
                    )}
                >
                    {decided === 'accepted' ? 'Raised as a variation task' : 'Marked as not a change'}
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="secondary" className="h-11" onClick={() => void decide('dismiss')} disabled={saving !== null}>
                        <X className="mr-1.5 h-4 w-4" />
                        {saving === 'dismiss' ? 'Saving…' : 'Not a change'}
                    </Button>
                    <Button type="button" variant="success" className="h-11" onClick={() => void decide('accept')} disabled={saving !== null}>
                        <Check className="mr-1.5 h-4 w-4" />
                        {saving === 'accept' ? 'Raising…' : 'Change'}
                    </Button>
                </div>
            )}

            <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" className="flex-1 text-xs" onClick={onPrev} disabled={!canPrev}>
                    <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                    Previous
                </Button>
                <Button type="button" size="sm" variant="outline" className="flex-1 text-xs" onClick={onNext} disabled={!canNext}>
                    Next
                    <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
}
