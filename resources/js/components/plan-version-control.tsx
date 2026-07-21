import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { CalendarClock, Check, GitCompareArrows, History } from 'lucide-react';
import { useMemo, useState } from 'react';

export type PlanVersionOption = {
    id: number;
    revision_number: string | null;
    status: string;
    created_at: string;
};

export type PlanOption = {
    key: string;
    sheet_number: string | null;
    title: string | null;
    display_name: string;
    versions: PlanVersionOption[];
};

type Mode = 'history' | 'compare';

function queryVersion(name: string): number | null {
    if (typeof window === 'undefined') return null;
    const value = Number(new URLSearchParams(window.location.search).get(name));
    return Number.isFinite(value) && value > 0 ? value : null;
}

function formatUploadDate(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

function versionLabel(version: PlanVersionOption): string {
    const revision = version.revision_number ? `Rev ${version.revision_number} · ` : '';
    return `${revision}${formatUploadDate(version.created_at)}`;
}

export function PlanVersionControl({ planOptions, currentDrawingId }: { planOptions: PlanOption[]; currentDrawingId: number }) {
    const requestedOldId = queryVersion('compare_old');
    const requestedNewId = queryVersion('compare_new');
    const hasComparisonQuery = requestedOldId !== null && requestedNewId !== null;

    const currentPlan = useMemo(
        () => planOptions.find((plan) => plan.versions.some((version) => version.id === currentDrawingId)) ?? planOptions[0],
        [currentDrawingId, planOptions],
    );

    const planForVersion = (versionId: number | null) =>
        versionId === null ? undefined : planOptions.find((plan) => plan.versions.some((version) => version.id === versionId));

    const requestedOldPlan = planForVersion(requestedOldId);
    const requestedNewPlan = planForVersion(requestedNewId);
    const defaultNewVersionId = requestedNewId ?? currentDrawingId;
    const defaultOldVersionId =
        requestedOldId ?? currentPlan?.versions.find((version) => version.id !== defaultNewVersionId)?.id ?? defaultNewVersionId;

    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<Mode>(hasComparisonQuery ? 'compare' : 'history');
    const [oldPlanKey, setOldPlanKey] = useState(requestedOldPlan?.key ?? currentPlan?.key ?? '');
    const [newPlanKey, setNewPlanKey] = useState(requestedNewPlan?.key ?? currentPlan?.key ?? '');
    const [oldVersionId, setOldVersionId] = useState(defaultOldVersionId);
    const [newVersionId, setNewVersionId] = useState(defaultNewVersionId);

    const oldPlan = planOptions.find((plan) => plan.key === oldPlanKey);
    const newPlan = planOptions.find((plan) => plan.key === newPlanKey);
    const canCompare = oldVersionId > 0 && newVersionId > 0 && oldVersionId !== newVersionId;

    const changePlan = (role: 'old' | 'new', key: string) => {
        const plan = planOptions.find((option) => option.key === key);
        const firstVersionId = plan?.versions[0]?.id ?? 0;

        if (role === 'old') {
            setOldPlanKey(key);
            setOldVersionId(firstVersionId);
            return;
        }

        setNewPlanKey(key);
        setNewVersionId(firstVersionId);
    };

    const openVersion = (versionId: number) => {
        setOpen(false);
        router.visit(`/drawings/${versionId}/plan`);
    };

    const startComparison = () => {
        if (!canCompare) return;
        setOpen(false);
        router.visit(`/drawings/${newVersionId}/plan?compare_old=${oldVersionId}&compare_new=${newVersionId}`);
    };

    return (
        <>
            <Button
                type="button"
                variant={hasComparisonQuery ? 'secondary' : 'outline'}
                size="sm"
                className="bg-background/90 absolute bottom-3 left-3 z-10 h-9 gap-2 shadow-sm backdrop-blur"
                onClick={() => setOpen(true)}
            >
                <GitCompareArrows className="h-4 w-4" />
                Plans &amp; compare
                {hasComparisonQuery && (
                    <span className="flex items-center gap-1" aria-label="Comparison selected">
                        <span className="h-2 w-2 rounded-full bg-red-600" />
                        <span className="h-2 w-2 rounded-full bg-blue-600" />
                    </span>
                )}
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="overflow-hidden p-0 sm:max-w-xl">
                    <DialogHeader className="gap-1 px-6 pt-6">
                        <DialogTitle>Plans and versions</DialogTitle>
                        <DialogDescription>Open an earlier upload or compare any two plans in this project.</DialogDescription>
                    </DialogHeader>

                    <div className="border-b px-6 pt-4">
                        <div className="flex gap-6" role="tablist" aria-label="Plan actions">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={mode === 'history'}
                                className={cn(
                                    'text-muted-foreground hover:text-foreground focus-visible:ring-ring relative flex min-h-11 items-center gap-2 pb-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                                    mode === 'history' &&
                                        'text-foreground after:bg-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5',
                                )}
                                onClick={() => setMode('history')}
                            >
                                <History className="h-4 w-4" />
                                View history
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={mode === 'compare'}
                                className={cn(
                                    'text-muted-foreground hover:text-foreground focus-visible:ring-ring relative flex min-h-11 items-center gap-2 pb-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                                    mode === 'compare' &&
                                        'text-foreground after:bg-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5',
                                )}
                                onClick={() => setMode('compare')}
                            >
                                <GitCompareArrows className="h-4 w-4" />
                                Compare plans
                            </button>
                        </div>
                    </div>

                    {mode === 'history' ? (
                        <div className="px-6 pb-6">
                            <div className="flex items-start justify-between gap-4 py-4">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold">{currentPlan?.display_name ?? 'Current plan'}</p>
                                    <p className="text-muted-foreground text-xs">Choose an upload to open in the viewer.</p>
                                </div>
                                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                                    {currentPlan?.versions.length ?? 0} version{currentPlan?.versions.length === 1 ? '' : 's'}
                                </span>
                            </div>

                            <ScrollArea className="max-h-72">
                                <div className="divide-y border-y">
                                    {currentPlan?.versions.map((version) => {
                                        const active = version.id === currentDrawingId;
                                        return (
                                            <button
                                                type="button"
                                                key={version.id}
                                                className="hover:bg-muted/60 focus-visible:ring-ring flex min-h-14 w-full items-center gap-3 px-1 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
                                                onClick={() => openVersion(version.id)}
                                            >
                                                <span className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                                                    {active ? (
                                                        <Check className="h-4 w-4" />
                                                    ) : (
                                                        <CalendarClock className="text-muted-foreground h-4 w-4" />
                                                    )}
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-medium">{formatUploadDate(version.created_at)}</span>
                                                    <span className="text-muted-foreground block text-xs">
                                                        {version.revision_number ? `Revision ${version.revision_number}` : 'Uploaded version'}
                                                        {version.status === 'active' ? ' · Latest' : ''}
                                                    </span>
                                                </span>
                                                {active && <span className="text-xs font-medium">Viewing</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                        </div>
                    ) : (
                        <div className="grid gap-6 px-6 pt-5 pb-6">
                            <VersionSelector
                                role="old"
                                color="red"
                                planOptions={planOptions}
                                selectedPlanKey={oldPlanKey}
                                selectedVersionId={oldVersionId}
                                selectedPlan={oldPlan}
                                onPlanChange={(key) => changePlan('old', key)}
                                onVersionChange={setOldVersionId}
                            />

                            <VersionSelector
                                role="new"
                                color="blue"
                                planOptions={planOptions}
                                selectedPlanKey={newPlanKey}
                                selectedVersionId={newVersionId}
                                selectedPlan={newPlan}
                                onPlanChange={(key) => changePlan('new', key)}
                                onVersionChange={setNewVersionId}
                            />

                            <div className="flex items-center justify-between gap-4 border-t pt-4">
                                <p className="text-muted-foreground max-w-[34ch] text-xs leading-5">
                                    Tasks added during comparison will belong to the new plan.
                                </p>
                                <Button type="button" onClick={startComparison} disabled={!canCompare} className="shrink-0 gap-2">
                                    <GitCompareArrows className="h-4 w-4" />
                                    Compare
                                </Button>
                            </div>

                            {!canCompare && oldVersionId === newVersionId && (
                                <p className="text-destructive -mt-4 text-xs" role="alert">
                                    Select two different versions to compare.
                                </p>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

function VersionSelector({
    role,
    color,
    planOptions,
    selectedPlanKey,
    selectedVersionId,
    selectedPlan,
    onPlanChange,
    onVersionChange,
}: {
    role: 'old' | 'new';
    color: 'red' | 'blue';
    planOptions: PlanOption[];
    selectedPlanKey: string;
    selectedVersionId: number;
    selectedPlan?: PlanOption;
    onPlanChange: (key: string) => void;
    onVersionChange: (id: number) => void;
}) {
    const title = role === 'old' ? 'Old plan' : 'New plan';

    return (
        <section aria-labelledby={`${role}-plan-heading`} className="grid gap-3">
            <div className="flex items-center gap-2">
                <span className={cn('h-2.5 w-2.5 rounded-full', color === 'red' ? 'bg-red-600' : 'bg-blue-600')} />
                <h3 id={`${role}-plan-heading`} className="text-sm font-semibold">
                    {title}
                </h3>
                <span className="text-muted-foreground text-xs">{color === 'red' ? 'Shown in red' : 'Shown in blue · receives task pins'}</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                <div className="grid min-w-0 gap-1.5">
                    <Label htmlFor={`${role}-plan`}>Floor plan</Label>
                    <Select value={selectedPlanKey} onValueChange={onPlanChange}>
                        <SelectTrigger
                            id={`${role}-plan`}
                            className="h-auto min-h-11 min-w-0 overflow-hidden py-1.5 whitespace-normal *:data-[slot=select-value]:line-clamp-2"
                            title={selectedPlan?.display_name}
                        >
                            <SelectValue className="min-w-0 overflow-hidden text-left leading-4 whitespace-normal" placeholder="Select floor plan" />
                        </SelectTrigger>
                        <SelectContent>
                            {planOptions.map((plan) => (
                                <SelectItem key={plan.key} value={plan.key}>
                                    {plan.display_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid min-w-0 gap-1.5">
                    <Label htmlFor={`${role}-version`}>Version and timeframe</Label>
                    <Select value={selectedVersionId > 0 ? String(selectedVersionId) : ''} onValueChange={(value) => onVersionChange(Number(value))}>
                        <SelectTrigger id={`${role}-version`} className="min-w-0 overflow-hidden">
                            <SelectValue className="min-w-0 overflow-hidden text-ellipsis" placeholder="Select version" />
                        </SelectTrigger>
                        <SelectContent>
                            {selectedPlan?.versions.map((version) => (
                                <SelectItem key={version.id} value={String(version.id)}>
                                    {versionLabel(version)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </section>
    );
}
