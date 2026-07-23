import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export type ChangeItem = {
    id: number;
    source: string;
    change_type: 'added' | 'removed' | 'modified' | 'moved';
    text_old: string | null;
    text_new: string | null;
    element: string | null;
    description: string | null;
    trade_impact: string[];
    significance: 'high' | 'medium' | 'low' | null;
    confidence: number | null;
    page_number: number | null;
    x: number | null;
    y: number | null;
    w: number | null;
    h: number | null;
};

export type RevisionNote = {
    revision: string;
    date: string;
    description: string;
};

export type ComparisonResult = {
    id: number;
    status: 'pending' | 'running' | 'complete' | 'failed';
    error: string | null;
    methods: string[];
    /**
     * False when the sheet's text coordinates could not be resolved to real
     * page positions (common with CAD exports that nest content in form
     * XObjects). The change list is still exact; only "jump to this change"
     * is unavailable.
     */
    coordinates_reliable: boolean;
    summary: string | null;
    revision_notes: RevisionNote[];
    changes_total: number;
    changes_high: number;
    analyzed_at: string | null;
    items: ChangeItem[];
};

const SIGNIFICANCE_ORDER = ['high', 'medium', 'low'] as const;

const SIGNIFICANCE_LABEL: Record<string, string> = {
    high: 'Affects what gets built',
    medium: 'Worth confirming',
    low: 'Drafting only',
};

/**
 * Badge intent per significance, mapped to shadcn tokens rather than raw
 * palette colours so the panel follows the app theme in both modes.
 */
function significanceVariant(significance: string | null): 'default' | 'secondary' | 'outline' | 'destructive' {
    if (significance === 'high') return 'destructive';
    if (significance === 'medium') return 'default';
    return 'secondary';
}

function changeTypeLabel(item: ChangeItem): string {
    switch (item.change_type) {
        case 'added':
            return 'Added';
        case 'removed':
            return 'Removed';
        case 'modified':
            return 'Changed';
        case 'moved':
            return 'Moved';
    }
}

/**
 * Detected-changes panel for a revision comparison.
 *
 * Sits alongside the visual diff overlay and answers the question the overlay
 * cannot: not *where* pixels differ, but *what* changed and whether it matters.
 * Phase 1 reads the PDF text layer, so every row here is an exact difference —
 * the model only names and ranks them.
 */
export function ChangeDetectionPanel({
    drawingId,
    oldDrawingId,
    onLocate,
}: {
    drawingId: number;
    oldDrawingId: number;
    onLocate?: (item: ChangeItem) => void;
}) {
    const [result, setResult] = useState<ComparisonResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);
    const [open, setOpen] = useState(true);
    const [showLow, setShowLow] = useState(false);

    // Cleared on unmount so a poll can't fire against a torn-down component.
    const pollRef = useRef<number | null>(null);

    const fetchResult = useCallback(async () => {
        try {
            const res = await api.get<{ comparison: ComparisonResult | null }>(`/drawings/${drawingId}/comparison`, {
                params: { compare_old: oldDrawingId },
            });
            setResult(res.comparison);
            return res.comparison;
        } catch {
            return null;
        } finally {
            setLoading(false);
        }
    }, [drawingId, oldDrawingId]);

    useEffect(() => {
        setLoading(true);
        setResult(null);
        void fetchResult();
    }, [fetchResult]);

    // Poll only while an analysis is actually in flight.
    useEffect(() => {
        const status = result?.status;
        if (status !== 'pending' && status !== 'running') return;

        pollRef.current = window.setTimeout(() => {
            void fetchResult();
        }, 3000);

        return () => {
            if (pollRef.current) window.clearTimeout(pollRef.current);
        };
    }, [result?.status, fetchResult]);

    const analyze = async () => {
        setStarting(true);
        try {
            const res = await api.post<{ comparison: ComparisonResult }>(`/drawings/${drawingId}/comparison`, {
                compare_old: oldDrawingId,
            });
            setResult(res.comparison);
        } catch {
            toast.error('Could not start change detection');
        } finally {
            setStarting(false);
        }
    };

    const running = result?.status === 'pending' || result?.status === 'running';
    // Only offer to jump to a change when its coordinates are real page
    // positions. Sending the viewer somewhere arbitrary is worse than not
    // offering the jump at all.
    const locateEnabled = Boolean(result?.coordinates_reliable);
    const items = result?.items ?? [];
    const visible = showLow ? items : items.filter((item) => item.significance !== 'low');
    const hiddenLowCount = items.length - visible.length;

    return (
        <div className="bg-background/95 absolute top-16 right-3 z-10 flex max-h-[calc(100%-5rem)] w-[22rem] flex-col rounded-md border shadow-sm backdrop-blur">
            <button type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left" onClick={() => setOpen((v) => !v)}>
                <span className="text-sm font-medium">Detected changes</span>
                <span className="flex items-center gap-2">
                    {result?.status === 'complete' && (
                        <span className="text-muted-foreground text-xs tabular-nums">
                            {result.changes_high > 0 ? `${result.changes_high} of ${result.changes_total}` : result.changes_total}
                        </span>
                    )}
                    {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                </span>
            </button>

            {open && (
                <div className="min-h-0 flex-1 overflow-y-auto border-t px-3 py-2.5">
                    {loading && (
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-1/2" />
                        </div>
                    )}

                    {!loading && !result && (
                        <div className="space-y-3">
                            <p className="text-muted-foreground text-xs">
                                Compare the text on both revisions — room names, tags, dimensions and notes — and get a ranked list of what actually
                                changed.
                            </p>
                            <Button type="button" size="sm" className="w-full" onClick={() => void analyze()} disabled={starting}>
                                {starting ? 'Starting…' : 'Detect changes'}
                            </Button>
                        </div>
                    )}

                    {running && (
                        <p className="text-muted-foreground text-xs">Reading both revisions and comparing… this usually takes under a minute.</p>
                    )}

                    {result?.status === 'failed' && (
                        <div className="space-y-3">
                            <p className="text-destructive text-xs">{result.error || 'Change detection failed.'}</p>
                            <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => void analyze()} disabled={starting}>
                                Try again
                            </Button>
                        </div>
                    )}

                    {result?.status === 'complete' && (
                        <div className="space-y-3">
                            {result.summary && <p className="text-xs leading-relaxed">{result.summary}</p>}

                            {result.revision_notes.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">Revision history</p>
                                    {result.revision_notes.map((note, index) => (
                                        <div key={`${note.revision}-${index}`} className="text-xs">
                                            <span className="font-medium">Rev {note.revision}</span>
                                            {note.date && <span className="text-muted-foreground"> · {note.date}</span>}
                                            {note.description && <div className="text-muted-foreground">{note.description}</div>}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {items.length > 0 && !locateEnabled && (
                                <p className="text-muted-foreground border-l-2 pl-2 text-[11px] leading-relaxed">
                                    This sheet stores its text in a nested coordinate space, so changes can't be located on the plan. The list itself
                                    is exact.
                                </p>
                            )}

                            {items.length === 0 && (
                                <p className="text-muted-foreground text-xs">
                                    No text differences found. Any changes are geometry only — use the overlay to spot them.
                                </p>
                            )}

                            {SIGNIFICANCE_ORDER.map((level) => {
                                const group = visible.filter((item) => item.significance === level);
                                if (group.length === 0) return null;

                                return (
                                    <div key={level} className="space-y-1.5">
                                        <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                                            {SIGNIFICANCE_LABEL[level]} ({group.length})
                                        </p>
                                        {group.map((item) => (
                                            <ChangeRow key={item.id} item={item} onLocate={locateEnabled ? onLocate : undefined} />
                                        ))}
                                    </div>
                                );
                            })}

                            {/* Un-ranked rows: the diff succeeded but interpretation
                                did not. Still exact, so still shown. */}
                            {visible.some((item) => item.significance === null) && (
                                <div className="space-y-1.5">
                                    <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">Unranked</p>
                                    {visible
                                        .filter((item) => item.significance === null)
                                        .map((item) => (
                                            <ChangeRow key={item.id} item={item} onLocate={locateEnabled ? onLocate : undefined} />
                                        ))}
                                </div>
                            )}

                            {hiddenLowCount > 0 && (
                                <Button type="button" size="sm" variant="ghost" className="h-7 w-full text-xs" onClick={() => setShowLow(true)}>
                                    Show {hiddenLowCount} drafting-only {hiddenLowCount === 1 ? 'change' : 'changes'}
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function ChangeRow({ item, onLocate }: { item: ChangeItem; onLocate?: (item: ChangeItem) => void }) {
    const locatable = item.x !== null && item.y !== null && Boolean(onLocate);

    return (
        <button
            type="button"
            disabled={!locatable}
            onClick={() => locatable && onLocate?.(item)}
            className={cn(
                'w-full rounded-md border px-2 py-1.5 text-left text-xs transition-colors',
                locatable ? 'hover:bg-accent hover:text-accent-foreground' : 'cursor-default',
            )}
        >
            <span className="flex items-center gap-1.5">
                <Badge variant={significanceVariant(item.significance)} className="h-4 px-1.5 text-[10px]">
                    {changeTypeLabel(item)}
                </Badge>
                {item.element && <span className="text-muted-foreground truncate text-[11px]">{item.element}</span>}
            </span>

            <span className="mt-1 block leading-snug">{item.description ?? describeRaw(item)}</span>

            {/* Always show the underlying strings — the description is the
                model's reading of them, and the reader may want the source. */}
            {(item.text_old || item.text_new) && (
                <span className="text-muted-foreground mt-1 block truncate font-mono text-[10px]">
                    {item.text_old && <span className="line-through">{item.text_old}</span>}
                    {item.text_old && item.text_new && <span> → </span>}
                    {item.text_new && <span>{item.text_new}</span>}
                </span>
            )}

            {item.trade_impact.length > 0 && (
                <span className="mt-1 flex flex-wrap gap-1">
                    {item.trade_impact.map((trade) => (
                        <Badge key={trade} variant="outline" className="h-4 px-1.5 text-[10px] capitalize">
                            {trade}
                        </Badge>
                    ))}
                </span>
            )}
        </button>
    );
}

/** Fallback text when the interpretation pass produced no description. */
function describeRaw(item: ChangeItem): string {
    switch (item.change_type) {
        case 'added':
            return `"${item.text_new}" added`;
        case 'removed':
            return `"${item.text_old}" removed`;
        case 'modified':
            return `"${item.text_old}" changed to "${item.text_new}"`;
        case 'moved':
            return `"${item.text_new}" moved`;
    }
}
