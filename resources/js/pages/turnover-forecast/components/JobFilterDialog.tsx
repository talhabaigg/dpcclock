import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertTriangle, Search, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { TurnoverRow } from '../lib/data-transformer';
import { CompanyFilterGroup } from './CompanyFilterGroup';

interface JobFilterDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    data: TurnoverRow[];
    filteredCount: number;
    excludedJobIds: Set<string>;
    onSetExcludedJobIds: (ids: Set<string>) => void;
    onToggleJob: (row: TurnoverRow) => void;
    onSelectAll: (ids: string[]) => void;
    onDeselectAll: (ids: string[]) => void;
}

type CompanyKey = TurnoverRow['company'];

const companyOnlyFilters: { company: CompanyKey; label: string }[] = [
    { company: 'SWCP', label: 'SWCP Only' },
    { company: 'GRE', label: 'GRE Only' },
    { company: 'Forecast', label: 'Forecast Only' },
];

function isCompanyOnlyActive(data: TurnoverRow[], company: CompanyKey, excludedJobIds: Set<string>): boolean {
    const companyRows = data.filter((r) => r.company === company);
    if (companyRows.length === 0) return false;
    return (
        companyRows.every((r) => !excludedJobIds.has(`${r.type}-${r.id}`)) &&
        data.filter((r) => r.company !== company).every((r) => excludedJobIds.has(`${r.type}-${r.id}`))
    );
}

export function JobFilterDialog({
    open,
    onOpenChange,
    data,
    filteredCount,
    excludedJobIds,
    onSetExcludedJobIds,
    onToggleJob,
    onSelectAll,
    onDeselectAll,
}: JobFilterDialogProps) {
    const [search, setSearch] = useState('');
    const previousStateRef = useRef<Set<string> | null>(null);

    const setBulk = useCallback(
        (next: Set<string>, label: string) => {
            previousStateRef.current = new Set(excludedJobIds);
            onSetExcludedJobIds(next);
            toast(label, {
                action: {
                    label: 'Undo',
                    onClick: () => {
                        if (previousStateRef.current) {
                            onSetExcludedJobIds(previousStateRef.current);
                            previousStateRef.current = null;
                        }
                    },
                },
                duration: 5000,
            });
        },
        [excludedJobIds, onSetExcludedJobIds],
    );

    const showOnlyCompany = (company: CompanyKey) => {
        const nonCompanyIds = data.filter((r) => r.company !== company).map((r) => `${r.type}-${r.id}`);
        setBulk(new Set(nonCompanyIds), `Showing ${company} only`);
    };

    const allHidden = excludedJobIds.size === data.length;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
                <SheetHeader>
                    <SheetTitle className="flex items-center justify-between pr-8">
                        <span>Filter Jobs</span>
                        <span className="text-muted-foreground text-sm font-normal tabular-nums">
                            {filteredCount}/{data.length}
                        </span>
                    </SheetTitle>
                    <SheetDescription>Choose which jobs to include in the turnover forecast.</SheetDescription>
                </SheetHeader>

                <div className="flex flex-col gap-3 px-4">
                    {/* Search */}
                    <div className="relative">
                        <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
                        <Input
                            placeholder="Search jobs..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8 pr-8"
                        />
                        {search && (
                            <button
                                type="button"
                                aria-label="Clear search"
                                onClick={() => setSearch('')}
                                className="text-muted-foreground hover:text-foreground absolute right-2.5 top-1/2 -translate-y-1/2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Quick Filters — hidden when searching */}
                    {!search && (
                        <div className="space-y-2">
                            <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Quick Filters</div>
                            <div className="flex flex-wrap gap-1.5">
                                <Button
                                    variant={excludedJobIds.size === 0 ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setBulk(new Set(), 'Showing all jobs')}
                                >
                                    Show All
                                </Button>
                                <Button
                                    variant={allHidden ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() =>
                                        setBulk(new Set(data.map((r) => `${r.type}-${r.id}`)), 'Hidden all jobs')
                                    }
                                >
                                    Hide All
                                </Button>
                                {companyOnlyFilters.map(({ company, label }) => (
                                    <Button
                                        key={company}
                                        variant={isCompanyOnlyActive(data, company, excludedJobIds) ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => showOnlyCompany(company)}
                                    >
                                        {label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Empty state warning */}
                    {allHidden && (
                        <div className="text-muted-foreground flex items-center gap-2 rounded-md border px-3 py-2 text-xs">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            No jobs selected — the forecast will be empty.
                        </div>
                    )}
                </div>

                {/* Scrollable job list */}
                <div className="flex-1 space-y-2 overflow-y-auto px-4 pt-1 pb-4">
                    <CompanyFilterGroup label="SWCP" company="SWCP" color="emerald" data={data} excludedJobIds={excludedJobIds} onToggleJob={onToggleJob} onSelectAll={onSelectAll} onDeselectAll={onDeselectAll} search={search} />
                    <CompanyFilterGroup label="GRE" company="GRE" color="blue" data={data} excludedJobIds={excludedJobIds} onToggleJob={onToggleJob} onSelectAll={onSelectAll} onDeselectAll={onDeselectAll} search={search} />
                    <CompanyFilterGroup label="Forecast" company="Forecast" color="violet" data={data} excludedJobIds={excludedJobIds} onToggleJob={onToggleJob} onSelectAll={onSelectAll} onDeselectAll={onDeselectAll} search={search} />
                    <CompanyFilterGroup label="Other" company="Unknown" color="slate" data={data} excludedJobIds={excludedJobIds} onToggleJob={onToggleJob} onSelectAll={onSelectAll} onDeselectAll={onDeselectAll} defaultOpen={false} search={search} />
                </div>
            </SheetContent>
        </Sheet>
    );
}
