import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import axios from 'axios';
import { ArrowRight, Check, ChevronLeft, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface ProblemItem {
    line_item_id: number;
    serial_number: number;
    code: string;
    description: string;
    qty: number;
    unit_cost: number;
    total_cost: number;
    reasons: string[];
    item_exists_in_db: boolean;
}

interface CatalogMatch {
    catalog_item_id: number;
    code: string;
    description: string;
    unit_cost: number;
    price_source: string;
    cost_code: string | null;
    cost_code_id: number | null;
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;
}

interface AIAssessment {
    success: boolean;
    assessment: string;
    path: 'not_in_price_list' | 'custom_length';
    recommended_action: string | null;
    parsed_length: number | null;
    is_meterage: boolean;
    matches: CatalogMatch[];
    error?: string;
}

interface PathAAnswers {
    path: 'not_in_price_list';
    field_worker_choice: 'remove_item' | 'keep_for_office' | 'other' | null;
    field_worker_notes: string;
    ai_assessment: string;
}

interface PathBAnswers {
    path: 'custom_length';
    is_custom_length: boolean | null;
    field_worker_choice?: 'remove_item' | 'keep_for_office' | null;
    matched_catalog_code: string | null;
    matched_catalog_item_id: number | null;
    matched_catalog_description: string | null;
    matched_catalog_unit_cost: number | null;
    requested_length_meters: number | null;
    field_worker_notes: string;
    ai_assessment: string;
    ai_matches: CatalogMatch[];
}

type FieldWorkerAnswers = PathAAnswers | PathBAnswers;

interface SmartPricingWizardProps {
    open: boolean;
    onClose: () => void;
    requisitionId: number;
    problems: ProblemItem[];
    onComplete: () => void;
}

/*
 * Path B step IDs:
 *   0 = "Is this a custom length?"
 *   1 = "Which catalog match?" (skip if no matches)
 *   2 = "How many meters?" (skip if not meterage)
 *   3 = "Anything else for the office?"
 */
const PATH_B_STEPS = [0, 1, 2, 3] as const;

function AiMessage({ children, animate = false }: { children: React.ReactNode; animate?: boolean }) {
    return (
        <div className={`flex gap-3 ${animate ? 'animate-in fade-in-0 slide-in-from-bottom-2 duration-300' : ''}`}>
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                <Sparkles className="h-3 w-3 text-gray-500 dark:text-gray-400" />
            </div>
            <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-gray-700 dark:text-gray-300">
                {children}
            </div>
        </div>
    );
}

export function SmartPricingWizard({ open, onClose, requisitionId, problems, onComplete }: SmartPricingWizardProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [aiResults, setAiResults] = useState<Record<number, AIAssessment>>({});
    const [loadingAI, setLoadingAI] = useState(false);
    const [saving, setSaving] = useState(false);
    const [answers, setAnswers] = useState<Record<number, FieldWorkerAnswers>>({});
    const [completing, setCompleting] = useState(false);
    const [removedItems, setRemovedItems] = useState<Set<number>>(new Set());
    const [step, setStep] = useState(0);
    const scrollEndRef = useRef<HTMLDivElement>(null);

    const activeProblems = problems.filter((p) => !removedItems.has(p.line_item_id));
    const currentProblem = activeProblems[currentIndex];
    const currentAI = currentProblem ? aiResults[currentProblem.line_item_id] : undefined;
    const currentAnswer = currentProblem ? answers[currentProblem.line_item_id] : undefined;
    const effectivePath = currentAI?.path ?? (currentProblem?.reasons.includes('not_in_price_list') ? 'not_in_price_list' : null);

    // Reset step when problem changes
    useEffect(() => { setStep(0); }, [currentProblem?.line_item_id]);

    // Auto-scroll to bottom when step changes
    useEffect(() => {
        const t = setTimeout(() => scrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100);
        return () => clearTimeout(t);
    }, [step]);

    function getDefaultPathAAnswers(assessment: string): PathAAnswers {
        return { path: 'not_in_price_list', field_worker_choice: null, field_worker_notes: '', ai_assessment: assessment };
    }

    function getDefaultPathBAnswers(assessment: string, ai?: AIAssessment): PathBAnswers {
        const topMatch = ai?.matches?.[0];
        return {
            path: 'custom_length',
            is_custom_length: ai?.is_meterage ? true : null,
            matched_catalog_code: topMatch?.code ?? null,
            matched_catalog_item_id: topMatch?.catalog_item_id ?? null,
            matched_catalog_description: topMatch?.description ?? null,
            matched_catalog_unit_cost: topMatch?.unit_cost ?? null,
            requested_length_meters: ai?.parsed_length ?? null,
            field_worker_notes: '',
            ai_assessment: assessment,
            ai_matches: ai?.matches ?? [],
        };
    }

    const updateAnswer = useCallback(
        (field: string, value: any) => {
            if (!currentProblem) return;
            setAnswers((prev) => ({
                ...prev,
                [currentProblem.line_item_id]: {
                    ...(prev[currentProblem.line_item_id] ?? { path: effectivePath ?? 'custom_length' }),
                    [field]: value,
                } as FieldWorkerAnswers,
            }));
        },
        [currentProblem, effectivePath],
    );

    useEffect(() => {
        if (!currentProblem || aiResults[currentProblem.line_item_id]) return;
        const fetchAssessment = async () => {
            setLoadingAI(true);
            try {
                const res = await axios.post(`/requisition/${requisitionId}/smart-pricing-assess`, {
                    line_item_id: currentProblem.line_item_id, reasons: currentProblem.reasons,
                });
                const data = res.data as AIAssessment;
                setAiResults((prev) => ({ ...prev, [currentProblem.line_item_id]: data }));
                if (data.success) {
                    if (data.path === 'not_in_price_list') {
                        setAnswers((prev) => ({ ...prev, [currentProblem.line_item_id]: prev[currentProblem.line_item_id] ?? getDefaultPathAAnswers(data.assessment) }));
                    } else {
                        setAnswers((prev) => ({ ...prev, [currentProblem.line_item_id]: prev[currentProblem.line_item_id] ?? getDefaultPathBAnswers(data.assessment, data) }));
                    }
                }
            } catch {
                setAiResults((prev) => ({
                    ...prev,
                    [currentProblem.line_item_id]: {
                        success: false, assessment: '', path: currentProblem.reasons.includes('not_in_price_list') ? 'not_in_price_list' : 'custom_length',
                        recommended_action: null, parsed_length: null, is_meterage: false, matches: [], error: 'Failed to load assessment',
                    },
                }));
            } finally { setLoadingAI(false); }
        };
        fetchAssessment();
    }, [currentProblem?.line_item_id, requisitionId]);

    // ── Path B step logic ──
    const hasMatches = (currentAI?.matches?.length ?? 0) > 0;
    const isYesCustomLength = (currentAnswer as PathBAnswers)?.is_custom_length === true;
    const needsLength = !!(currentAI?.is_meterage || isYesCustomLength);

    /** Given a Path B step, return the next applicable step (skipping inapplicable ones). Returns null if done. */
    const getNextPathBStep = useCallback((from: number): number | null => {
        // "No" and "Not sure" — step 1 is the final step
        if (!isYesCustomLength && from >= 1) return null;
        for (let s = from + 1; s <= 3; s++) {
            if (!isYesCustomLength && s > 1) return null;
            if (s === 1 && isYesCustomLength && !hasMatches) continue;
            if (s === 2 && !needsLength) continue;
            return s;
        }
        return null;
    }, [hasMatches, needsLength, isYesCustomLength]);

    /** The final applicable Path B step for this item. */
    const finalPathBStep = (() => {
        if (!isYesCustomLength) return 1; // "No" and "Not sure" end at step 1
        let last = 0;
        for (const s of PATH_B_STEPS) {
            if (s === 1 && !hasMatches) continue;
            if (s === 2 && !needsLength) continue;
            last = s;
        }
        return last;
    })();

    const isOnFinalStep = effectivePath !== 'custom_length' || step >= finalPathBStep;

    /** Get previous applicable Path B step. Returns null if already at step 0. */
    const getPrevPathBStep = useCallback((from: number): number | null => {
        if (from <= 0) return null;
        // "No" / "Not sure" only ever reach step 1, so back always goes to 0
        if (!isYesCustomLength) return 0;
        for (let s = from - 1; s >= 0; s--) {
            if (s === 1 && !hasMatches) continue;
            if (s === 2 && !needsLength) continue;
            return s;
        }
        return null;
    }, [hasMatches, needsLength, isYesCustomLength]);

    const canGoBack = effectivePath === 'custom_length' && step > 0;

    /** Can the user advance from the current Path B step? */
    const canContinueStep = (() => {
        if (effectivePath !== 'custom_length') return true;
        const pb = currentAnswer as PathBAnswers | undefined;
        switch (step) {
            case 0: return pb?.is_custom_length !== undefined; // they've picked something (true/false/null all valid since null = "not sure" which is explicitly selected)
            case 1:
                if (pb?.is_custom_length === null) return pb?.field_worker_choice != null; // "Not sure" — must pick an option
                return true; // "Yes" match optional, "No" notes optional
            case 2: return (pb?.requested_length_meters ?? 0) > 0;
            case 3: return true; // notes always optional
            default: return true;
        }
    })();

    const advanceOrComplete = () => {
        if (currentIndex < activeProblems.length - 1) setCurrentIndex((i) => i + 1);
        else { setCompleting(true); onComplete(); }
    };

    const handleContinue = () => {
        if (!isOnFinalStep) {
            const next = getNextPathBStep(step);
            if (next !== null) { setStep(next); return; }
        }
        // Final step → save
        saveAndNext();
    };

    const saveAndNext = async () => {
        if (!currentProblem || !currentAnswer) return;
        setSaving(true);
        try {
            await axios.post(`/requisition/${requisitionId}/smart-pricing-context`, {
                line_item_id: currentProblem.line_item_id, ...currentAnswer, item_exists_in_db: currentProblem.item_exists_in_db,
            });
            advanceOrComplete();
        } catch (err) { console.error('Failed to save context', err); }
        finally { setSaving(false); }
    };

    const removeItemAndNext = async () => {
        if (!currentProblem) return;
        setSaving(true);
        try {
            await axios.post(`/requisition/${requisitionId}/smart-pricing-remove-item`, { line_item_id: currentProblem.line_item_id });
            setRemovedItems((prev) => new Set(prev).add(currentProblem.line_item_id));
            const remaining = activeProblems.filter((p) => p.line_item_id !== currentProblem.line_item_id);
            if (remaining.length === 0 || currentIndex >= remaining.length) { setCompleting(true); onComplete(); }
        } catch (err) { console.error('Failed to remove item', err); }
        finally { setSaving(false); }
    };

    const skipAndNext = async () => {
        if (!currentProblem) return;
        setSaving(true);
        try {
            const path = effectivePath ?? 'custom_length';
            await axios.post(`/requisition/${requisitionId}/smart-pricing-context`, {
                line_item_id: currentProblem.line_item_id, path,
                field_worker_choice: path === 'not_in_price_list' ? 'keep_for_office' : undefined,
                field_worker_notes: '', ai_assessment: currentAI?.assessment ?? '',
                ai_matches: currentAI?.matches ?? [], item_exists_in_db: currentProblem.item_exists_in_db,
            });
            advanceOrComplete();
        } catch (err) { console.error('Failed to save context', err); }
        finally { setSaving(false); }
    };

    const selectMatch = (match: CatalogMatch) => {
        if (!currentProblem) return;
        setAnswers((prev) => {
            const existing = prev[currentProblem.line_item_id];
            return {
                ...prev,
                [currentProblem.line_item_id]: {
                    ...(existing ?? getDefaultPathBAnswers(currentAI?.assessment ?? '', currentAI ?? undefined)),
                    path: 'custom_length' as const,
                    matched_catalog_code: match.code, matched_catalog_item_id: match.catalog_item_id,
                    matched_catalog_description: match.description, matched_catalog_unit_cost: match.unit_cost,
                    ai_matches: currentAI?.matches ?? [],
                } as PathBAnswers,
            };
        });
    };

    if (!currentProblem) return null;

    const isPathA = effectivePath === 'not_in_price_list';
    const pathAAnswer = currentAnswer as PathAAnswers | undefined;
    const pathBAnswer = currentAnswer as PathBAnswers | undefined;
    const canSavePathA = pathAAnswer?.field_worker_choice != null;
    const isLast = currentIndex >= activeProblems.length - 1;

    // Steps applicable to this item (for step dots)
    const applicableSteps = (() => {
        if (isPathA) return [0];
        const steps = [0];
        if (isYesCustomLength) {
            if (hasMatches) steps.push(1);
            if (needsLength) steps.push(2);
            steps.push(3);
        } else {
            steps.push(1);
        }
        return steps;
    })();
    const currentStepIndex = applicableSteps.indexOf(step);
    const showStepDots = effectivePath === 'custom_length' && !loadingAI && applicableSteps.length > 1;

    const reasonLabel = (r: string) => {
        switch (r) {
            case 'no_code': return 'no item code';
            case 'no_price': return 'no price set';
            case 'unmatched_code': return 'code not in catalog';
            case 'not_in_price_list': return 'not in project price list';
            default: return r;
        }
    };

    // Footer button logic
    const footerDisabled = saving || completing || loadingAI;
    let footerLabel = '';
    let footerIcon: React.ReactNode = null;
    let footerAction = handleContinue;
    let footerVariant: 'default' | 'remove' = 'default';
    let footerCanClick = true;

    const isPathBRemove = !isPathA && pathBAnswer?.is_custom_length === null && pathBAnswer?.field_worker_choice === 'remove_item' && isOnFinalStep;

    if (isPathA && pathAAnswer?.field_worker_choice === 'remove_item') {
        footerLabel = isLast ? 'Remove & Send' : 'Remove & Next';
        footerIcon = saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />;
        footerAction = removeItemAndNext;
        footerVariant = 'remove';
    } else if (isPathBRemove) {
        footerLabel = isLast ? 'Remove & Send' : 'Remove & Next';
        footerIcon = saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />;
        footerAction = removeItemAndNext;
        footerVariant = 'remove';
    } else if (isPathA) {
        footerLabel = isLast ? 'Send to Office' : 'Next';
        footerIcon = saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isLast ? <Check className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />;
        footerAction = saveAndNext;
        footerCanClick = canSavePathA;
    } else if (!isOnFinalStep) {
        footerLabel = 'Continue';
        footerIcon = <ArrowRight className="h-3.5 w-3.5" />;
        footerAction = handleContinue;
        footerCanClick = canContinueStep;
    } else {
        footerLabel = isLast ? 'Send to Office' : 'Next';
        footerIcon = saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isLast ? <Check className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />;
        footerAction = handleContinue;
        footerCanClick = canContinueStep;
    }

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-h-[90vh] max-w-lg overflow-hidden p-0 sm:max-w-xl">
                {/* Header */}
                <DialogHeader className="px-6 pt-5 pb-0">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="flex items-center gap-2.5 text-sm font-medium tracking-tight">
                            <Sparkles className="h-4 w-4 text-gray-400" />
                            Smart Pricing
                        </DialogTitle>
                        <span className="text-muted-foreground text-xs tabular-nums">
                            Item {currentIndex + 1} of {activeProblems.length}
                            {showStepDots && <> &middot; Step {currentStepIndex + 1}/{applicableSteps.length}</>}
                        </span>
                    </div>
                    {/* Segmented progress: one segment per item, current fills by step */}
                    <div className="mt-3 flex gap-1">
                        {activeProblems.map((_, i) => {
                            const isDone = i < currentIndex;
                            const isCurrent = i === currentIndex;
                            const stepPct = isCurrent && applicableSteps.length > 1
                                ? ((currentStepIndex + 1) / applicableSteps.length) * 100
                                : isCurrent ? 50 : 0;
                            return (
                                <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                                    <div
                                        className="h-full rounded-full bg-gray-900 transition-all duration-300 ease-out dark:bg-gray-100"
                                        style={{ width: isDone ? '100%' : isCurrent ? `${stepPct}%` : '0%' }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </DialogHeader>

                <ScrollArea className="max-h-[calc(90vh-150px)]">
                    <div className="space-y-5 px-6 pt-4 pb-5">

                        {/* ── AI introduces the item ── */}
                        <AiMessage>
                            I'm looking at <strong>item #{currentProblem.serial_number}</strong> on your order:
                            <div className="mt-2 rounded-lg border border-gray-150 bg-gray-50/80 px-3.5 py-2.5 dark:border-gray-800 dark:bg-gray-900/60">
                                <p className="text-[13px] font-medium text-gray-900 dark:text-gray-100">
                                    {currentProblem.description}
                                </p>
                                <p className="text-muted-foreground mt-1 font-mono text-xs">
                                    {currentProblem.code || 'No code'}
                                    <span className="mx-1.5">&middot;</span>
                                    Qty {currentProblem.qty}
                                    {Number(currentProblem.unit_cost) > 0 && (
                                        <> &times; ${Number(currentProblem.unit_cost).toFixed(2)}</>
                                    )}
                                </p>
                            </div>
                        </AiMessage>

                        {/* ── Loading ── */}
                        {loadingAI && (
                            <AiMessage>
                                <div className="flex items-center gap-2">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
                                    <span className="text-muted-foreground text-[13px]">Thinking...</span>
                                </div>
                                <div className="mt-3 space-y-2">
                                    <Skeleton className="h-4 w-4/5" />
                                    <Skeleton className="h-4 w-3/5" />
                                </div>
                            </AiMessage>
                        )}

                        {!loadingAI && (
                            <>
                                {/* ── AI assessment ── */}
                                {currentAI?.assessment && (
                                    <AiMessage>
                                        {currentAI.assessment}
                                        {currentProblem.reasons.length > 0 && (
                                            <span className="text-muted-foreground">
                                                {' '}The issue: {currentProblem.reasons.map(reasonLabel).join(', ')}.
                                            </span>
                                        )}
                                    </AiMessage>
                                )}

                                {/* ══════════ PATH A ══════════ */}
                                {isPathA && (
                                    <>
                                        <AiMessage>
                                            This item isn't on your project price list, so it'll need a separate quote.
                                            <strong className="mt-1.5 block text-gray-900 dark:text-gray-100">
                                                What would you like to do?
                                            </strong>
                                        </AiMessage>

                                        <div className="space-y-2 pl-9">
                                            {([
                                                { value: 'remove_item', label: 'Remove from order', desc: "I'll send a quote directly" },
                                                { value: 'keep_for_office', label: 'Keep without price', desc: 'Let the office handle it' },
                                                { value: 'other', label: 'Something else', desc: null },
                                            ] as const).map((opt) => {
                                                const selected = pathAAnswer?.field_worker_choice === opt.value;
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => updateAnswer('field_worker_choice', opt.value)}
                                                        className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-all ${
                                                            selected
                                                                ? 'border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900'
                                                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:hover:border-gray-700 dark:hover:bg-gray-900/50'
                                                        }`}
                                                    >
                                                        <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] ${selected ? 'border-white bg-white dark:border-gray-900 dark:bg-gray-900' : 'border-gray-300 dark:border-gray-600'}`}>
                                                            {selected && <div className="h-1.5 w-1.5 rounded-full bg-gray-900 dark:bg-gray-100" />}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className={`text-[13px] font-medium ${selected ? '' : 'text-gray-900 dark:text-gray-100'}`}>{opt.label}</span>
                                                            {opt.desc && <p className={`mt-0.5 text-xs ${selected ? 'text-gray-300 dark:text-gray-600' : 'text-muted-foreground'}`}>{opt.desc}</p>}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {pathAAnswer?.field_worker_choice === 'other' && (
                                            <div className="pl-9">
                                                <Label htmlFor="notes_a" className="mb-1.5 block text-[13px] font-medium">Tell us more</Label>
                                                <Textarea
                                                    id="notes_a"
                                                    placeholder="What should happen with this item?"
                                                    value={pathAAnswer.field_worker_notes}
                                                    onChange={(e) => updateAnswer('field_worker_notes', e.target.value)}
                                                    rows={3}
                                                    className="text-[13px]"
                                                />
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* ══════════ PATH B — Stepped ══════════ */}
                                {effectivePath === 'custom_length' && (
                                    <>
                                        {/* Step 0: Custom length? */}
                                        {step === 0 && (
                                            <>
                                                <AiMessage animate>
                                                    <strong className="text-gray-900 dark:text-gray-100">
                                                        Is this a custom length of an existing item?
                                                    </strong>
                                                </AiMessage>

                                                <div className="flex flex-wrap gap-2 pl-9">
                                                    {([
                                                        { value: 'yes', label: 'Yes', test: pathBAnswer?.is_custom_length === true },
                                                        { value: 'no', label: 'No, something new', test: pathBAnswer?.is_custom_length === false },
                                                        { value: 'not_sure', label: 'Not sure', test: pathBAnswer?.is_custom_length === null },
                                                    ]).map((opt) => (
                                                        <button
                                                            key={opt.value}
                                                            type="button"
                                                            onClick={() => {
                                                                const val = opt.value === 'yes' ? true : opt.value === 'no' ? false : null;
                                                                updateAnswer('is_custom_length', val);
                                                                setTimeout(() => {
                                                                    // "Yes" skips step 1 if no catalog matches
                                                                    setStep(val === true && !hasMatches ? 2 : 1);
                                                                }, 250);
                                                            }}
                                                            className={`rounded-full border px-4 py-1.5 text-[13px] transition-all ${
                                                                opt.test
                                                                    ? 'border-gray-900 bg-gray-900 font-medium text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900'
                                                                    : 'border-gray-200 text-gray-700 hover:border-gray-400 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-500'
                                                            }`}
                                                        >
                                                            {opt.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}

                                        {/* Step 1 — "Yes": Catalog matches */}
                                        {step === 1 && isYesCustomLength && hasMatches && (
                                            <>
                                                <AiMessage animate>
                                                    I found {currentAI!.matches.length === 1 ? 'a match' : `${currentAI!.matches.length} possible matches`} in
                                                    your project price list. <strong className="text-gray-900 dark:text-gray-100">Which one is it?</strong>
                                                </AiMessage>

                                                <div className="space-y-2 pl-9">
                                                    {currentAI!.matches.map((match) => {
                                                        const isSelected = pathBAnswer?.matched_catalog_item_id === match.catalog_item_id;
                                                        return (
                                                            <button
                                                                key={match.catalog_item_id}
                                                                type="button"
                                                                onClick={() => { selectMatch(match); setTimeout(() => setStep(2), 250); }}
                                                                className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all ${
                                                                    isSelected
                                                                        ? 'border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900'
                                                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:hover:border-gray-700 dark:hover:bg-gray-900/50'
                                                                }`}
                                                            >
                                                                <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] ${isSelected ? 'border-white bg-white dark:border-gray-900 dark:bg-gray-900' : 'border-gray-300 dark:border-gray-600'}`}>
                                                                    {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-gray-900 dark:bg-gray-100" />}
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-baseline gap-2">
                                                                        <span className={`font-mono text-[13px] font-semibold ${isSelected ? '' : 'text-gray-900 dark:text-gray-100'}`}>{match.code}</span>
                                                                        <span className={`text-xs capitalize ${isSelected ? 'text-gray-400 dark:text-gray-500' : 'text-muted-foreground'}`}>{match.confidence}</span>
                                                                    </div>
                                                                    <p className={`mt-0.5 truncate text-xs ${isSelected ? 'text-gray-300 dark:text-gray-600' : 'text-muted-foreground'}`}>{match.description}</p>
                                                                </div>
                                                                <span className={`shrink-0 font-mono text-[13px] font-semibold ${isSelected ? '' : 'text-gray-900 dark:text-gray-100'}`}>
                                                                    ${Number(match.unit_cost).toFixed(2)}
                                                                    <span className={`text-xs font-normal ${isSelected ? 'text-gray-400 dark:text-gray-500' : 'text-muted-foreground'}`}>/{currentAI!.is_meterage ? 'm' : 'ea'}</span>
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </>
                                        )}

                                        {step === 1 && isYesCustomLength && !hasMatches && currentAI?.success && (
                                            <AiMessage animate>
                                                <span className="text-muted-foreground">I couldn't find any matching items in your project price list.</span>
                                            </AiMessage>
                                        )}

                                        {/* Step 1 — "No, something new": Ask what it is */}
                                        {step === 1 && pathBAnswer?.is_custom_length === false && (
                                            <>
                                                <AiMessage animate>
                                                    Got it — this is something new.
                                                    <strong className="mt-1 block text-gray-900 dark:text-gray-100">
                                                        What is it? Include a cost code if you have one.
                                                    </strong>
                                                </AiMessage>
                                                <div className="pl-9">
                                                    <Textarea
                                                        id="notes_new_item"
                                                        placeholder="e.g. Custom bracket for panel mount — cost code 32-01"
                                                        value={pathBAnswer?.field_worker_notes ?? ''}
                                                        onChange={(e) => updateAnswer('field_worker_notes', e.target.value)}
                                                        rows={2}
                                                        className="text-[13px]"
                                                    />
                                                </div>
                                            </>
                                        )}

                                        {/* Step 1 — "Not sure": Process guidance + options */}
                                        {step === 1 && pathBAnswer?.is_custom_length === null && (
                                            <>
                                                <AiMessage animate>
                                                    As per the process, if this is a one-off item you should get a quote for it.
                                                    <strong className="mt-1 block text-gray-900 dark:text-gray-100">
                                                        What would you like to do?
                                                    </strong>
                                                </AiMessage>
                                                <div className="space-y-2 pl-9">
                                                    {([
                                                        { value: 'remove_item', label: 'Remove from order', desc: "I'll get a quote myself" },
                                                        { value: 'keep_for_office', label: 'Let the office handle it', desc: 'Office will arrange the quote' },
                                                    ] as const).map((opt) => {
                                                        const selected = pathBAnswer?.field_worker_choice === opt.value;
                                                        return (
                                                            <button
                                                                key={opt.value}
                                                                type="button"
                                                                onClick={() => updateAnswer('field_worker_choice', opt.value)}
                                                                className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-all ${
                                                                    selected
                                                                        ? 'border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900'
                                                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:hover:border-gray-700 dark:hover:bg-gray-900/50'
                                                                }`}
                                                            >
                                                                <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] ${selected ? 'border-white bg-white dark:border-gray-900 dark:bg-gray-900' : 'border-gray-300 dark:border-gray-600'}`}>
                                                                    {selected && <div className="h-1.5 w-1.5 rounded-full bg-gray-900 dark:bg-gray-100" />}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <span className={`text-[13px] font-medium ${selected ? '' : 'text-gray-900 dark:text-gray-100'}`}>{opt.label}</span>
                                                                    <p className={`mt-0.5 text-xs ${selected ? 'text-gray-300 dark:text-gray-600' : 'text-muted-foreground'}`}>{opt.desc}</p>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </>
                                        )}

                                        {/* Step 2: Length (only if applicable & step >= 2) */}
                                        {step === 2 && needsLength && (
                                            <>
                                                <AiMessage animate>
                                                    <strong className="text-gray-900 dark:text-gray-100">
                                                        How many meters do you need?
                                                    </strong>
                                                    {currentAI?.parsed_length && (
                                                        <span className="text-muted-foreground">
                                                            {' '}I'm guessing {currentAI.parsed_length}m from the description.
                                                        </span>
                                                    )}
                                                </AiMessage>
                                                <div className="pl-9">
                                                    <Input
                                                        id="length"
                                                        type="number"
                                                        step="0.1"
                                                        min="0"
                                                        placeholder="e.g. 15"
                                                        value={pathBAnswer?.requested_length_meters ?? ''}
                                                        onChange={(e) => updateAnswer('requested_length_meters', e.target.value ? parseFloat(e.target.value) : null)}
                                                        className="w-28 text-[13px]"
                                                    />
                                                </div>
                                            </>
                                        )}

                                        {/* Step 3: Notes (always last, step >= 3) */}
                                        {step === 3 && (
                                            <>
                                                <AiMessage animate>
                                                    <strong className="text-gray-900 dark:text-gray-100">
                                                        Anything else the office should know?
                                                    </strong>
                                                    <span className="text-muted-foreground"> (optional)</span>
                                                </AiMessage>
                                                <div className="pl-9">
                                                    <Textarea
                                                        id="notes_b"
                                                        placeholder="e.g. For conduit run in building B"
                                                        value={pathBAnswer?.field_worker_notes ?? ''}
                                                        onChange={(e) => updateAnswer('field_worker_notes', e.target.value)}
                                                        rows={2}
                                                        className="text-[13px]"
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </>
                                )}

                                {/* AI Error fallback */}
                                {currentAI?.error && !currentAI.assessment && (
                                    <AiMessage>
                                        <span className="text-muted-foreground">I wasn't able to analyze this item. The office will review it manually.</span>
                                    </AiMessage>
                                )}
                            </>
                        )}

                        {/* Scroll anchor */}
                        <div ref={scrollEndRef} />
                    </div>
                </ScrollArea>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3 dark:border-gray-800">
                    <div className="flex items-center gap-1">
                        {canGoBack && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { const prev = getPrevPathBStep(step); if (prev !== null) setStep(prev); }}
                                disabled={footerDisabled}
                                className="text-muted-foreground gap-1 text-xs hover:text-gray-700 dark:hover:text-gray-300"
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                                Back
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={skipAndNext}
                            disabled={footerDisabled}
                            className="text-muted-foreground text-xs hover:text-gray-700 dark:hover:text-gray-300"
                        >
                            Skip
                        </Button>
                    </div>

                    <Button
                        size="sm"
                        onClick={footerAction}
                        disabled={footerDisabled || !footerCanClick}
                        className={`gap-1.5 ${
                            footerVariant === 'remove'
                                ? 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:text-white dark:hover:bg-red-700'
                                : 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200'
                        }`}
                    >
                        {footerIcon}
                        {footerLabel}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
