import type { ChangeItem } from '@/components/drawings/change-detection-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Check, ChevronLeft, ChevronRight, Loader2, MapPin, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

/**
 * Tags a reader would recognise off the drawing — partition types, door
 * numbers, room types. Derived from the description rather than stored,
 * because the model writes them into its own sentence and re-deriving them
 * here is cheaper than a second round trip to ask for them separately.
 */
const TAG_PATTERN = /\b(?:PT\d+[a-z]?|D\d+[a-z]?|Rw\d+|TYPE\s+[A-Z]\d?)\b/gi;

function affectedTags(item: ChangeItem): string[] {
    const source = [item.description, item.text_new, item.text_old].filter(Boolean).join(' ');
    const found = source.match(TAG_PATTERN) ?? [];

    // Case-insensitive dedupe — "PT23" and "pt23" are one tag, and showing
    // both would read as two separate changes.
    const seen = new Set<string>();
    for (const tag of found) {
        seen.add(tag.toUpperCase().replace(/\s+/g, ' '));
    }

    return [...seen].slice(0, 6);
}

/**
 * One change at a time, with a decision to make about it.
 *
 * A list of a hundred changes is something to scroll past; a deck of a hundred
 * decisions is something a person finishes. The deck is ordered by significance
 * so the changes that affect what gets built are ruled on while attention is
 * freshest, and the animation leads because seeing what moved is a glance where
 * reading a description of it is a paragraph.
 *
 * Navigation moves over the whole deck rather than only the undecided cards, so
 * "previous" can reach one that was just ruled on — second thoughts about the
 * last decision are the usual reason to go back.
 */
export function ChangeReviewCard({
    drawingId,
    item,
    position,
    total,
    oldRevision,
    newRevision,
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
    oldRevision: string | null;
    newRevision: string | null;
    onDecided: (item: ChangeItem, decision: 'accept' | 'dismiss') => void;
    onLocate?: (item: ChangeItem) => void;
    onPrev: () => void;
    onNext: () => void;
    canPrev: boolean;
    canNext: boolean;
}) {
    const [description, setDescription] = useState('');
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState<'accept' | 'dismiss' | null>(null);

    // Animations are dropped once a change is ruled on, and expire a day after
    // it is detected. Reopening one redraws it from the stored coordinates,
    // which means rasterizing the two sheets again — seconds, not milliseconds,
    // and the first change opened on a sheet pays the most. Without a visible
    // wait the card just looks broken for that time.
    const [imageState, setImageState] = useState<'loading' | 'ready' | 'missing'>('loading');

    // Each change is its own decision — carrying the previous card's wording
    // forward would quietly attach the wrong text to a task.
    useEffect(() => {
        setDescription(item.description ?? 'Change detected on revision comparison');
        setNote('');
        setSaving(null);
        setImageState('loading');
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
    const tags = affectedTags(item);
    const title = item.element && item.element !== 'changed area' ? item.element : 'Changed area';

    // Only states the two things actually known about where this came from.
    // A grid reference would be more useful and is not available, and guessing
    // one would be worse than saying less.
    const subtitle = [
        item.significance ? `${item.significance} significance` : null,
        item.source === 'raster' ? 'seen on the drawing' : 'text change',
    ]
        .filter(Boolean)
        .join(' · ');

    const decide = async (decision: 'accept' | 'dismiss') => {
        setSaving(decision);
        try {
            await api.post(`/drawings/${drawingId}/comparison/items/${item.id}/triage`, {
                decision,
                title: description.trim() || undefined,
                comment: note.trim() || description.trim() || undefined,
            });
            toast.success(decision === 'accept' ? 'Variation task raised' : 'Marked as not a change');
            onDecided(item, decision);
        } catch {
            toast.error(decision === 'accept' ? 'Could not raise the task' : 'Could not save');
            setSaving(null);
        }
    };

    return (
        // Flat inside the pane: the pane is the surface now, and a card with
        // its own border and shadow inside a bordered panel reads as two
        // stacked containers rather than one thing to work through.
        <div className="space-y-3">
            <div>
                <h3 className="text-base leading-tight font-semibold capitalize">{title}</h3>
                <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs capitalize">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {subtitle}
                </p>
            </div>

            {/* The animation, not a tabbed pair: the change is easiest to read
                when the two states swap in place. */}
            <div className="overflow-hidden rounded-md border">
                <div className="text-muted-foreground flex items-center justify-between gap-2 border-b px-2 py-1.5 text-[10px] tracking-wide uppercase">
                    <span>Before / after</span>
                    {(oldRevision || newRevision) && (
                        <span className="font-mono">
                            Rev {oldRevision ?? '?'} → Rev {newRevision ?? '?'}
                        </span>
                    )}
                </div>
                {item.preview_url && imageState !== 'missing' ? (
                    <div className="relative">
                        {/* Kept mounted while loading so the browser actually
                            starts the request; the placeholder sits over it. */}
                        <img
                            src={item.preview_url}
                            alt={`Before and after of ${title}`}
                            className={cn('w-full', imageState !== 'ready' && 'invisible')}
                            onLoad={() => setImageState('ready')}
                            onError={() => setImageState('missing')}
                        />
                        {imageState === 'loading' && (
                            <div className="bg-muted/40 absolute inset-0 flex min-h-40 flex-col items-center justify-center gap-2">
                                <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
                                <p className="text-muted-foreground text-[11px]">Redrawing this change…</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-muted-foreground px-2 py-10 text-center text-[11px]">No before/after image for this change</div>
                )}
            </div>

            <div className="space-y-1.5">
                <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">What changed</p>
                {/* Editable: this becomes the task name, so the detected wording
                    is a starting point rather than the last word. */}
                <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the change"
                    rows={3}
                    className="resize-none text-xs leading-snug"
                    aria-label="What changed"
                />
            </div>

            {tags.length > 0 && (
                <div className="space-y-1.5">
                    <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">Affected tags</p>
                    <div className="flex flex-wrap gap-1">
                        {tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="h-5 px-2 font-mono text-[10px]">
                                {tag}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}

            <div className="space-y-1.5">
                <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">Add note</p>
                <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Leave a comment for the design team…"
                    rows={2}
                    className="resize-none text-xs leading-snug"
                    aria-label="Add note"
                />
            </div>

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
                        {saving === 'accept' ? 'Raising…' : 'Confirm change'}
                    </Button>
                </div>
            )}

            <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" className="flex-1 text-xs" onClick={onPrev} disabled={!canPrev}>
                    <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                    Previous
                </Button>
                <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                    {position} / {total}
                </span>
                <Button type="button" size="sm" variant="outline" className="flex-1 text-xs" onClick={onNext} disabled={!canNext}>
                    Next
                    <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
}
