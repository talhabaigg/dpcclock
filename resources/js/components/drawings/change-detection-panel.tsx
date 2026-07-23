import { ChangeReviewCard } from '@/components/drawings/change-review-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Images, ListChecks, RotateCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

export type ChangeItem = {
    id: number;
    source: string;
    change_type: 'added' | 'removed' | 'modified' | 'moved';
    text_old: string | null;
    text_new: string | null;
    /** Populated on rows standing for many instances rather than one edit. */
    count_old: number | null;
    count_new: number | null;
    element: string | null;
    description: string | null;
    trade_impact: string[];
    significance: 'high' | 'medium' | 'low' | null;
    confidence: number | null;
    page_number: number | null;
    /** Whether x/y are true page coordinates the viewer can zoom to. */
    locatable: boolean;
    /** Animated before/after of this region, when one was generated. */
    preview_url: string | null;
    /** accepted | dismissed, or null while the change still needs a decision. */
    triage_status: string | null;
    site_task_id: number | null;
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
    old_revision: string | null;
    new_revision: string | null;
    /** Where a running analysis has got to, so the panel can show real motion. */
    progress: {
        stage: string | null;
        done: number | null;
        total: number | null;
        started_at: string | null;
        seconds_since_heartbeat: number | null;
        stalled: boolean;
    } | null;
    /**
     * False when the sheet's text coordinates could not be resolved to real
     * page positions (common with CAD exports that nest content in form
     * XObjects). The change list is still exact; only "jump to this change"
     * is unavailable.
     */
    coordinates_reliable: boolean;
    /**
     * False when the two PDFs split text into runs so differently that a
     * token-level diff is untrustworthy. The geometry regions are unaffected.
     */
    text_comparable: boolean;
    summary: string | null;
    revision_notes: RevisionNote[];
    changes_total: number;
    changes_high: number;
    analyzed_at: string | null;
    items: ChangeItem[];
};

/** What each backend stage is called in the panel. */
const STAGE_LABEL: Record<string, string> = {
    starting: 'Starting',
    reading_text: 'Reading both revisions',
    comparing_geometry: 'Comparing wall geometry',
    reading_regions: 'Looking at each changed area',
    ranking_changes: 'Ranking the changes',
    writing_summary: 'Writing the summary',
};

const SIGNIFICANCE_ORDER = ['high', 'medium', 'low'] as const;

const ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

/** How many unranked rows render before the rest are collapsed. */
const UNRANKED_PREVIEW = 15;

const SIGNIFICANCE_LABEL: Record<string, string> = {
    high: 'Affects what gets built',
    medium: 'Worth confirming',
    low: 'Drafting only',
};

/**
 * Left-edge accent carrying how much a change matters.
 *
 * Significance is deliberately not put on the type badge. That badge says what
 * happened — Added, Removed, Changed, Moved — and colouring it by importance
 * made one chip encode two unrelated things: a red "Changed" looked like it
 * meant something about changing, when it only ever meant "high significance".
 * The accent keeps the two readable apart, and shadcn tokens keep it themed.
 */
function significanceAccent(significance: string | null): string {
    if (significance === 'high') return 'border-l-destructive';
    if (significance === 'medium') return 'border-l-primary';
    return 'border-l-transparent';
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
    canCloud = false,
    onClouded,
    onItemsChange,
}: {
    drawingId: number;
    oldDrawingId: number;
    onLocate?: (item: ChangeItem) => void;
    canCloud?: boolean;
    onClouded?: () => void;
    /** Lets the viewer draw the same changes on the sheet. */
    onItemsChange?: (items: ChangeItem[]) => void;
}) {
    const [result, setResult] = useState<ComparisonResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);
    const [open, setOpen] = useState(true);
    const [showLow, setShowLow] = useState(false);
    const [showAllUnranked, setShowAllUnranked] = useState(false);
    const [clouding, setClouding] = useState(false);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [showSummary, setShowSummary] = useState(false);
    const [reviewing, setReviewing] = useState(false);
    const [reviewIndex, setReviewIndex] = useState(0);
    const queueRef = useRef<ChangeItem[]>([]);

    // Held in a ref so a parent that passes an inline callback does not
    // re-fire the effect on every render.
    const onItemsChangeRef = useRef(onItemsChange);
    onItemsChangeRef.current = onItemsChange;

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
        }, 2000);

        return () => {
            if (pollRef.current) window.clearTimeout(pollRef.current);
        };
    }, [result?.status, fetchResult]);

    const analyze = async (force = false) => {
        setStarting(true);
        try {
            const res = await api.post<{ comparison: ComparisonResult }>(`/drawings/${drawingId}/comparison`, {
                compare_old: oldDrawingId,
                force,
            });
            setResult(res.comparison);
            // A re-run clears the old rows, so drop any expanded state that
            // referred to them.
            setShowLow(false);
            setShowAllUnranked(false);
        } catch {
            toast.error('Could not start change detection');
        } finally {
            setStarting(false);
        }
    };

    const cloudChanges = async () => {
        setClouding(true);
        try {
            const res = await api.post<{ message: string; created: number }>(`/drawings/${drawingId}/comparison/clouds`, {
                compare_old: oldDrawingId,
            });
            toast.success(res.message);
            if (res.created > 0) onClouded?.();
        } catch {
            toast.error('Could not cloud the changes');
        } finally {
            setClouding(false);
        }
    };

    const onDecided = (decided: ChangeItem, decision: 'accept' | 'dismiss') => {
        setResult((prev) =>
            prev
                ? {
                      ...prev,
                      items: prev.items.map((row) =>
                          row.id === decided.id ? { ...row, triage_status: decision === 'accept' ? 'accepted' : 'dismissed' } : row,
                      ),
                  }
                : prev,
        );
        // Advance to the next card still needing a decision rather than the next
        // card outright, so a second pass does not walk back over work already
        // done.
        const deck = queueRef.current;
        const from = deck.findIndex((row) => row.id === decided.id);
        const nextUndecided = deck.findIndex((row, i) => i > from && row.triage_status === null && row.id !== decided.id);
        setReviewIndex(nextUndecided === -1 ? Math.min(from + 1, deck.length - 1) : nextUndecided);
    };

    const running = result?.status === 'pending' || result?.status === 'running';
    const all = useMemo(() => result?.items ?? [], [result]);

    useEffect(() => {
        onItemsChangeRef.current?.(all);
    }, [all]);

    // Visual changes lead. They are the ones seen on the drawing itself — a
    // wall that moved — which is what the trades are being asked about, and
    // they carry a before/after animation. Text findings follow as supporting
    // detail: real, exact, but a tag or a dimension rather than built work.
    const visual = all.filter((item) => item.source === 'raster');
    const textual = all.filter((item) => item.source !== 'raster');

    const rank = (item: ChangeItem) => ORDER[item.significance ?? ''] ?? 3;
    const bySignificance = (a: ChangeItem, b: ChangeItem) => rank(a) - rank(b);

    // Review queue: everything still awaiting a decision, most significant
    // first, visual before text because it is the more actionable evidence.
    // The review deck. Every change is in it, most significant first and visual
    // ahead of text, so priority is automatic rather than something the
    // reviewer has to impose. Decided cards keep their place so Previous can
    // reach them — second thoughts are the usual reason to go back.
    const queue = [...all].sort((a, b) => {
        const bySig = rank(a) - rank(b);
        if (bySig !== 0) return bySig;
        return (a.source === 'raster' ? 0 : 1) - (b.source === 'raster' ? 0 : 1);
    });

    const undecided = queue.filter((item) => item.triage_status === null).length;
    const reviewed = queue.length - undecided;
    const reviewedPct = queue.length > 0 ? Math.round((reviewed / queue.length) * 100) : 0;

    queueRef.current = queue;

    const visualRanked = [...visual].sort(bySignificance);
    // A region nothing could read is not a finding, it is a place to look.
    const visualDescribed = visualRanked.filter((item) => item.description !== null);
    const visualUnread = visualRanked.filter((item) => item.description === null);

    const visible = showLow ? textual : textual.filter((item) => item.significance !== 'low');
    const hiddenLowCount = textual.length - visible.length;
    const unranked = visible.filter((item) => item.significance === null);
    // Unranked rows are the fallback path: ranking was skipped, capped, or
    // failed. Showing hundreds of them unbounded is what made this panel
    // unusable, so only a sample renders until asked for the rest.
    const unrankedShown = showAllUnranked ? unranked : unranked.slice(0, UNRANKED_PREVIEW);
    // Only changes that are both ranked worth seeing and actually locatable can
    // become clouds — the rest have nowhere trustworthy to draw.
    const cloudable = all.filter((item) => item.locatable && (item.significance === 'high' || item.significance === 'medium')).length;

    return (
        <div // A docked pane rather than a floating card: reviewing a hundred
            // changes is the main task while it is open, and a panel that runs
            // the height of the viewer fits the whole card without scrolling
            // the decision buttons out of reach.
            className="bg-background/95 absolute top-0 right-0 bottom-0 z-10 flex w-[24rem] max-w-[85vw] flex-col border-l shadow-xl backdrop-blur"
        >
            <button type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left" onClick={() => setOpen((v) => !v)}>
                <span className="text-sm font-medium">Detected changes</span>
                <span className="flex items-center gap-2">
                    {reviewing && (
                        <span
                            role="button"
                            tabIndex={0}
                            className="border-border hover:bg-accent flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] transition-colors"
                            onClick={(e) => {
                                e.stopPropagation();
                                setReviewing(false);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.stopPropagation();
                                    setReviewing(false);
                                }
                            }}
                        >
                            <ListChecks className="h-3 w-3" />
                            List
                        </span>
                    )}
                    {!reviewing && result?.status === 'complete' && (
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

                    {running && <RunningState result={result} onRestart={() => void analyze(true)} restarting={starting} />}

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
                            {textual.length > 0 && result.text_comparable === false && (
                                <p className="text-muted-foreground border-l-2 pl-2 text-[11px] leading-relaxed">
                                    These two PDFs encode their text differently, so the text changes below are unreliable for this pair and may
                                    include export artefacts. The changed areas are unaffected — they come from comparing the drawn image.
                                </p>
                            )}

                            {all.length === 0 && <p className="text-muted-foreground text-xs">No differences found between these two revisions.</p>}

                            {reviewing && (
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs">
                                            <span className="font-semibold">{reviewed}</span>
                                            <span className="text-muted-foreground"> of {queue.length} reviewed</span>
                                        </span>
                                        <span className="text-muted-foreground text-[11px] tabular-nums">{reviewedPct}%</span>
                                    </div>
                                    <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                                        <div
                                            className="bg-success h-full rounded-full transition-all duration-300"
                                            style={{ width: `${reviewedPct}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {reviewing && queue.length > 0 && (
                                <ChangeReviewCard
                                    drawingId={drawingId}
                                    item={queue[Math.min(reviewIndex, queue.length - 1)]}
                                    position={Math.min(reviewIndex, queue.length - 1) + 1}
                                    total={queue.length}
                                    oldRevision={result.old_revision}
                                    newRevision={result.new_revision}
                                    onDecided={onDecided}
                                    onLocate={onLocate}
                                    onPrev={() => setReviewIndex((i) => Math.max(0, i - 1))}
                                    onNext={() => setReviewIndex((i) => Math.min(queue.length - 1, i + 1))}
                                    canPrev={reviewIndex > 0}
                                    canNext={reviewIndex < queue.length - 1}
                                />
                            )}

                            {!reviewing && queue.length > 0 && (
                                <Button
                                    type="button"
                                    size="sm"
                                    className="w-full gap-1.5"
                                    onClick={() => {
                                        // Open on the first thing still needing a
                                        // decision, not on work already done.
                                        const first = queue.findIndex((row) => row.triage_status === null);
                                        setReviewIndex(first === -1 ? 0 : first);
                                        setReviewing(true);
                                    }}
                                >
                                    <ListChecks className="h-4 w-4" />
                                    {undecided > 0 ? `Review ${undecided} change${undecided === 1 ? '' : 's'}` : 'Review changes again'}
                                </Button>
                            )}

                            {/* Visual changes lead: seen on the drawing itself,
                                and each carries a before/after animation. */}
                            {!reviewing && visualDescribed.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                                        Wall &amp; geometry changes ({visualDescribed.length})
                                    </p>
                                    {visualDescribed.map((item) => (
                                        <ChangeRow
                                            key={item.id}
                                            item={item}
                                            onLocate={onLocate}
                                            expanded={expandedId === item.id}
                                            onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                                        />
                                    ))}
                                </div>
                            )}

                            {!reviewing && visualUnread.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                                        Other potential changes ({visualUnread.length})
                                    </p>
                                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                                        Line work changed here but was not read. Open one to compare before and after.
                                    </p>
                                    {visualUnread.map((item, index) => (
                                        <ChangeRow
                                            key={item.id}
                                            item={item}
                                            index={index + 1}
                                            onLocate={onLocate}
                                            expanded={expandedId === item.id}
                                            onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Text findings: exact, but tags and dimensions
                                rather than built work, so they sit below. */}
                            {!reviewing &&
                                SIGNIFICANCE_ORDER.map((level) => {
                                    const group = visible.filter((item) => item.significance === level);
                                    if (group.length === 0) return null;

                                    return (
                                        <div key={level} className="space-y-1.5">
                                            <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                                                Text &middot; {SIGNIFICANCE_LABEL[level]} ({group.length})
                                            </p>
                                            {group.map((item) => (
                                                <ChangeRow key={item.id} item={item} onLocate={onLocate} />
                                            ))}
                                        </div>
                                    );
                                })}

                            {/* Un-ranked rows: the diff succeeded but interpretation
                                did not. Still exact, so still shown. */}
                            {!reviewing && unranked.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                                        Text &middot; not ranked ({unranked.length})
                                    </p>
                                    {unrankedShown.map((item) => (
                                        <ChangeRow key={item.id} item={item} onLocate={onLocate} />
                                    ))}
                                    {unranked.length > unrankedShown.length && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-full text-xs"
                                            onClick={() => setShowAllUnranked(true)}
                                        >
                                            Show {unranked.length - unrankedShown.length} more
                                        </Button>
                                    )}
                                </div>
                            )}

                            {/* Context, not the headline. The changes are what
                                the reader came for; the roll-up is background
                                and sits out of the way until asked for. */}
                            {(result.summary || result.revision_notes.length > 0) && (
                                <div className="space-y-1.5 border-t pt-2">
                                    <button
                                        type="button"
                                        className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 text-left text-[11px] font-medium tracking-wide uppercase transition-colors"
                                        onClick={() => setShowSummary((v) => !v)}
                                    >
                                        {showSummary ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                        Summary &amp; revision history
                                    </button>

                                    {showSummary && (
                                        <div className="space-y-2">
                                            {result.summary && <p className="text-xs leading-relaxed">{result.summary}</p>}

                                            {result.revision_notes.map((note, index) => (
                                                <div key={`${note.revision}-${index}`} className="text-xs">
                                                    <span className="font-medium">Rev {note.revision}</span>
                                                    {note.date && <span className="text-muted-foreground"> · {note.date}</span>}
                                                    {note.description && <div className="text-muted-foreground">{note.description}</div>}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex items-center justify-between gap-2 border-t pt-2">
                                <span className="text-muted-foreground text-[11px]">
                                    {result.analyzed_at ? `Analysed ${new Date(result.analyzed_at).toLocaleString()}` : 'Analysed'}
                                </span>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 shrink-0 gap-1.5 text-xs"
                                    onClick={() => void analyze(true)}
                                    disabled={starting}
                                    title="Discard these results and analyse the two revisions again"
                                >
                                    <RotateCw className="h-3.5 w-3.5" />
                                    {starting ? 'Restarting…' : 'Run again'}
                                </Button>
                                {reviewing && (
                                    <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setReviewing(false)}>
                                        Show list
                                    </Button>
                                )}
                            </div>

                            {!reviewing && canCloud && cloudable > 0 && (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => void cloudChanges()}
                                    disabled={clouding}
                                >
                                    {clouding ? 'Clouding…' : `Cloud ${cloudable} change${cloudable === 1 ? '' : 's'} on the drawing`}
                                </Button>
                            )}

                            {!reviewing && hiddenLowCount > 0 && (
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

function ChangeRow({
    item,
    index,
    onLocate,
    expanded = false,
    onToggle,
}: {
    item: ChangeItem;
    index?: number;
    onLocate?: (item: ChangeItem) => void;
    expanded?: boolean;
    onToggle?: () => void;
}) {
    const locatable = item.x !== null && item.y !== null && item.locatable && Boolean(onLocate);
    const hasPreview = Boolean(item.preview_url) && Boolean(onToggle);
    // Points to millimetres on the printed sheet — the size a person holding
    // the drawing would perceive.
    const mm = (pt: number | null) => Math.round((pt ?? 0) * 0.3528);

    return (
        <div className={cn('rounded-md border border-l-2 text-xs', significanceAccent(item.significance))}>
            <button
                type="button"
                disabled={!locatable && !hasPreview}
                onClick={() => {
                    // Locating and expanding are both useful, and a row that can
                    // do both should do both — jump the viewer there and open
                    // the comparison in one press.
                    if (locatable) onLocate?.(item);
                    if (hasPreview) onToggle?.();
                }}
                className={cn(
                    'w-full px-2 py-1.5 text-left transition-colors',
                    locatable || hasPreview ? 'hover:bg-accent hover:text-accent-foreground' : 'cursor-default',
                )}
            >
                <span className="flex items-center gap-1.5">
                    <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                        {changeTypeLabel(item)}
                    </Badge>
                    {item.significance !== null && item.significance !== 'low' && (
                        <span className="text-muted-foreground text-[10px] capitalize">{item.significance}</span>
                    )}
                    {item.element && <span className="text-muted-foreground truncate text-[11px]">{item.element}</span>}
                    {item.source === 'raster' && (
                        <Badge variant="outline" className="ml-auto h-4 shrink-0 px-1.5 text-[10px]" title="Read from the drawing image">
                            visual
                        </Badge>
                    )}
                </span>

                <span className="mt-1 block leading-snug">
                    {index !== undefined && item.description === null ? `Area ${index} — ` : ''}
                    {item.description ?? describeRaw(item)}
                </span>

                {/* Population rows carry the tally rather than a before/after string. */}
                {item.count_old !== null && item.count_new !== null && (
                    <span className="text-muted-foreground mt-1 block text-[10px] tabular-nums">
                        {item.count_old} → {item.count_new}
                    </span>
                )}

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

                {hasPreview && (
                    <span className="text-muted-foreground mt-1 flex items-center gap-1 text-[10px]">
                        <Images className="h-3 w-3" />
                        {expanded ? 'Hide comparison' : 'Compare before / after'}
                        {item.w !== null && item.h !== null && (
                            <span className="ml-auto tabular-nums">
                                {mm(item.w)} × {mm(item.h)} mm
                            </span>
                        )}
                    </span>
                )}
            </button>

            {/* Loaded only once opened. A panel that eagerly fetched forty
                animations would pull several megabytes for rows most people
                never look at. */}
            {expanded && item.preview_url && (
                <div className="border-t p-1.5">
                    <img
                        src={item.preview_url}
                        alt={`Before and after of ${item.element ?? 'this change'}`}
                        className="w-full rounded"
                        loading="lazy"
                    />
                </div>
            )}
        </div>
    );
}

/**
 * What a run in flight looks like.
 *
 * These take minutes, so a bare spinner is not enough: with nothing moving,
 * a stuck job and a working one look identical, and the reasonable response to
 * that is to press the button again. Naming the stage and counting the work
 * makes the difference visible, and a job that has stopped checking in says so
 * and offers a way out rather than spinning forever.
 */
function RunningState({ result, onRestart, restarting }: { result: ComparisonResult; onRestart: () => void; restarting: boolean }) {
    const progress = result.progress;
    const [now, setNow] = useState(() => Date.now());

    // Elapsed has to tick on its own; the poll only moves when the server has
    // something new to say.
    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(id);
    }, []);

    const startedAt = progress?.started_at ? new Date(progress.started_at).getTime() : null;
    const elapsed = startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : null;
    const elapsedLabel = elapsed === null ? null : elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;

    const stage = progress?.stage ? (STAGE_LABEL[progress.stage] ?? 'Working') : 'Working';
    const done = progress?.done ?? null;
    const total = progress?.total ?? null;
    const pct = done !== null && total !== null && total > 0 ? Math.min(100, Math.round((done / total) * 100)) : null;

    if (progress?.stalled) {
        return (
            <div className="space-y-2">
                <p className="text-xs leading-relaxed">
                    This analysis stopped responding{elapsedLabel ? ` after ${elapsedLabel}` : ''}. The job may have been interrupted.
                </p>
                <Button type="button" size="sm" variant="outline" className="w-full" onClick={onRestart} disabled={restarting}>
                    {restarting ? 'Restarting…' : 'Start it again'}
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">{stage}…</span>
                <span className="text-muted-foreground text-[11px] tabular-nums">
                    {done !== null && total !== null && total > 0 ? `${done} / ${total}` : elapsedLabel}
                </span>
            </div>

            <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                <div
                    className={cn('bg-primary h-full rounded-full transition-all duration-500', pct === null && 'w-1/3 animate-pulse')}
                    style={pct === null ? undefined : { width: `${pct}%` }}
                />
            </div>

            <p className="text-muted-foreground text-[11px] leading-relaxed">
                Running for {elapsedLabel ?? 'a moment'}. A heavily revised sheet takes several minutes — you can leave this page and come back.
            </p>
        </div>
    );
}

/** Fallback text when the interpretation pass produced no description. */
function describeRaw(item: ChangeItem): string {
    // Rows standing for many instances: state the tally, never invent the
    // individual values behind it.
    if (item.count_old !== null && item.count_new !== null) {
        const label = item.text_new ?? item.text_old;

        if (label === null) {
            const removed = item.count_old;
            const added = item.count_new;
            const parts = [removed > 0 ? `${removed} removed` : null, added > 0 ? `${added} added` : null].filter(Boolean);

            return `${item.element ?? 'Labels'} revised in this area — ${parts.join(', ')}`;
        }

        return `"${label}" now appears ${item.count_new} times, was ${item.count_old}`;
    }

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
