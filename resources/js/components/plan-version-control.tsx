import { SearchSelect } from '@/components/search-select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { Check, GitCompareArrows, History } from 'lucide-react';
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
    return version.revision_number ? `Rev ${version.revision_number}` : formatUploadDate(version.created_at);
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

    const [menuOpen, setMenuOpen] = useState(false);
    const [compareOpen, setCompareOpen] = useState(false);
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
        setMenuOpen(false);
        router.visit(`/drawings/${versionId}/plan`);
    };

    const openCompare = () => {
        setMenuOpen(false);
        setCompareOpen(true);
    };

    const startComparison = () => {
        if (!canCompare) return;
        setCompareOpen(false);
        router.visit(`/drawings/${newVersionId}/plan?compare_old=${oldVersionId}&compare_new=${newVersionId}`);
    };

    return (
        <>
            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant={hasComparisonQuery ? 'secondary' : 'outline'}
                        size="sm"
                        className="bg-background/90 absolute bottom-3 left-3 z-10 h-9 gap-2 shadow-sm backdrop-blur"
                    >
                        <History className="h-4 w-4" />
                        Versions
                        {hasComparisonQuery && (
                            <span className="flex items-center gap-1" aria-label="Comparison selected">
                                <span className="h-2 w-2 rounded-full bg-red-600" />
                                <span className="h-2 w-2 rounded-full bg-blue-600" />
                            </span>
                        )}
                    </Button>
                </PopoverTrigger>

                <PopoverContent align="start" side="top" className="w-56 gap-0 p-1">
                    <div className="max-h-72 overflow-y-auto">
                        {currentPlan?.versions.map((version, index) => {
                            const viewing = version.id === currentDrawingId;
                            const label = version.revision_number ? `Rev ${version.revision_number}` : formatUploadDate(version.created_at);
                            return (
                                <button
                                    type="button"
                                    key={version.id}
                                    className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                                    onClick={() => openVersion(version.id)}
                                >
                                    <span className="flex-1 truncate">
                                        {label}
                                        {index === 0 && <span className="text-muted-foreground"> (New)</span>}
                                    </span>
                                    {viewing && <Check className="h-4 w-4 shrink-0" />}
                                </button>
                            );
                        })}
                    </div>

                    <div className="bg-border -mx-1 my-1 h-px" />

                    <button
                        type="button"
                        className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
                        onClick={openCompare}
                    >
                        <GitCompareArrows className="h-4 w-4" />
                        Compare
                        {hasComparisonQuery && (
                            <span className="ml-auto flex items-center gap-1" aria-label="Comparison active">
                                <span className="h-2 w-2 rounded-full bg-red-600" />
                                <span className="h-2 w-2 rounded-full bg-blue-600" />
                            </span>
                        )}
                    </button>
                </PopoverContent>
            </Popover>

            <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
                <DialogContent className="overflow-hidden p-0 sm:max-w-xl">
                    <DialogHeader className="px-6 pt-6">
                        <DialogTitle>Compare Versions</DialogTitle>
                        <DialogDescription className="sr-only">Compare any two plans in this project.</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 px-6 pt-2 pb-6">
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

                        {!canCompare && oldVersionId === newVersionId && (
                            <p className="text-destructive text-xs" role="alert">
                                Select two different versions to compare.
                            </p>
                        )}

                        <Button type="button" onClick={startComparison} disabled={!canCompare} className="mt-2 w-full">
                            Compare
                        </Button>
                    </div>
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
    return (
        <div className="flex items-center gap-3">
            <span
                className={cn('h-2.5 w-2.5 shrink-0 rounded-full', color === 'red' ? 'bg-red-600' : 'bg-blue-600')}
                aria-label={role === 'old' ? 'Old plan (shown in red)' : 'New plan (shown in blue)'}
            />
            <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] items-center gap-2">
                <SearchSelect
                    optionName="floor plan"
                    placeholder="Select floor plan"
                    selectedOption={selectedPlanKey}
                    onValueChange={onPlanChange}
                    options={planOptions.map((plan) => ({ value: plan.key, label: plan.display_name }))}
                    className="h-auto min-h-11 py-1.5 text-left whitespace-normal *:data-[slot=combobox-value]:line-clamp-2"
                    renderSelected={() => (
                        <span className="line-clamp-2 min-w-0 flex-1 leading-4">{selectedPlan?.display_name ?? 'Select floor plan'}</span>
                    )}
                />

                <Select value={selectedVersionId > 0 ? String(selectedVersionId) : ''} onValueChange={(value) => onVersionChange(Number(value))}>
                    <SelectTrigger className="min-h-11 min-w-0 overflow-hidden" aria-label={`Select ${role} version`}>
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
    );
}
