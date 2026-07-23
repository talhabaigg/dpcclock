import type { ChangeItem } from '@/components/drawings/change-detection-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { Check, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

/**
 * One change at a time, with a decision to make about it.
 *
 * A list of forty changes is something to scroll past; a queue of forty
 * decisions is something a person finishes. The queue is ordered by
 * significance so the changes that affect what gets built are ruled on while
 * attention is freshest, and the animation leads because it is the fastest way
 * to understand what actually moved.
 */
export function ChangeReviewCard({
    drawingId,
    item,
    position,
    total,
    onDecided,
    onLocate,
}: {
    drawingId: number;
    item: ChangeItem;
    position: number;
    total: number;
    onDecided: (item: ChangeItem, decision: 'accept' | 'dismiss') => void;
    onLocate?: (item: ChangeItem) => void;
}) {
    const [title, setTitle] = useState('');
    const [comment, setComment] = useState('');
    const [saving, setSaving] = useState<'accept' | 'dismiss' | null>(null);

    // Each change is its own decision — carrying the previous one's wording
    // into the next card would quietly attach the wrong note to a task.
    useEffect(() => {
        setTitle('');
        setComment('');
        setSaving(null);
    }, [item.id]);

    // Held in a ref so an inline callback from the parent does not re-fire the
    // jump on every render.
    const onLocateRef = useRef(onLocate);
    onLocateRef.current = onLocate;

    // Jump the drawing to whatever is under review, so the card and the sheet
    // never disagree about what is being looked at.
    useEffect(() => {
        onLocateRef.current?.(item);
    }, [item.id]);

    const decide = async (decision: 'accept' | 'dismiss') => {
        setSaving(decision);
        try {
            await api.post(`/drawings/${drawingId}/comparison/items/${item.id}/triage`, {
                decision,
                title: title.trim() || undefined,
                comment: comment.trim() || undefined,
            });
            toast.success(decision === 'accept' ? 'Task raised' : 'Dismissed');
            onDecided(item, decision);
        } catch {
            toast.error(decision === 'accept' ? 'Could not raise the task' : 'Could not dismiss');
            setSaving(null);
        }
    };

    const suggested = item.description ?? 'Change detected on revision comparison';

    return (
        <div className="space-y-2.5">
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

            {/* The animation leads. Reading what moved takes a glance; reading a
                description of it takes a paragraph. */}
            {item.preview_url ? (
                <img src={item.preview_url} alt={`Before and after of ${item.element ?? 'this change'}`} className="w-full rounded border" />
            ) : (
                <div className="text-muted-foreground rounded border px-2 py-6 text-center text-[11px]">No before/after image for this change</div>
            )}

            <p className="text-xs leading-snug">{suggested}</p>

            <div className="space-y-1.5">
                <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={suggested}
                    className="h-8 text-xs"
                    aria-label="Task name"
                />
                <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Add a note (optional)"
                    rows={2}
                    className="resize-none text-xs"
                    aria-label="Comment"
                />
            </div>

            <div className="grid grid-cols-2 gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => void decide('dismiss')} disabled={saving !== null}>
                    <X className="mr-1 h-4 w-4" />
                    {saving === 'dismiss' ? 'Skipping…' : 'No'}
                </Button>
                <Button type="button" size="sm" onClick={() => void decide('accept')} disabled={saving !== null}>
                    <Check className="mr-1 h-4 w-4" />
                    {saving === 'accept' ? 'Raising…' : 'Yes, raise'}
                </Button>
            </div>

            <p className="text-muted-foreground text-[10px] leading-relaxed">
                "Yes" raises a Potential Variation task pinned here, with this before/after image attached.
            </p>
        </div>
    );
}
