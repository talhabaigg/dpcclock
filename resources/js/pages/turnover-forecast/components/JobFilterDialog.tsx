import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

const companyOnlyFilters: { company: CompanyKey; label: string; borderClass: string }[] = [
    { company: 'SWCP', label: 'SWCP Only', borderClass: 'border-emerald-300 dark:border-emerald-700' },
    { company: 'GRE', label: 'GRE Only', borderClass: 'border-blue-300 dark:border-blue-700' },
    { company: 'Forecast', label: 'Forecast Only', borderClass: 'border-violet-300 dark:border-violet-700' },
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
    const showOnlyCompany = (company: CompanyKey) => {
        const nonCompanyIds = data.filter((r) => r.company !== company).map((r) => `${r.type}-${r.id}`);
        onSetExcludedJobIds(new Set(nonCompanyIds));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[90vh] w-[95vw] flex-col overflow-hidden sm:max-h-[80vh] sm:max-w-2xl">
                <DialogHeader className="pb-2">
                    <DialogTitle className="flex items-center justify-between">
                        <span>Filter Jobs</span>
                        <span className="text-muted-foreground text-sm font-normal">
                            {filteredCount}/{data.length} selected
                        </span>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 space-y-4 overflow-y-auto pr-1">
                    {/* Quick Filters */}
                    <div className="space-y-3">
                        <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Quick Filters</div>
                        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                            <Button
                                variant={excludedJobIds.size === 0 ? 'default' : 'outline'}
                                className="h-10 sm:h-9"
                                onClick={() => onSetExcludedJobIds(new Set())}
                            >
                                Show All
                            </Button>
                            <Button
                                variant={excludedJobIds.size === data.length ? 'default' : 'outline'}
                                className="h-10 sm:h-9"
                                onClick={() => onSetExcludedJobIds(new Set(data.map((r) => `${r.type}-${r.id}`)))}
                            >
                                Hide All
                            </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {companyOnlyFilters.map(({ company, label, borderClass }) => (
                                <Button
                                    key={company}
                                    variant={isCompanyOnlyActive(data, company, excludedJobIds) ? 'default' : 'outline'}
                                    className={`h-10 text-xs sm:h-9 sm:text-sm ${borderClass}`}
                                    onClick={() => showOnlyCompany(company)}
                                >
                                    {label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Individual Selection */}
                    <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Select Individual Jobs</div>

                    <CompanyFilterGroup label="SWCP" company="SWCP" color="emerald" data={data} excludedJobIds={excludedJobIds} onToggleJob={onToggleJob} onSelectAll={onSelectAll} onDeselectAll={onDeselectAll} />
                    <CompanyFilterGroup label="GRE" company="GRE" color="blue" data={data} excludedJobIds={excludedJobIds} onToggleJob={onToggleJob} onSelectAll={onSelectAll} onDeselectAll={onDeselectAll} />
                    <CompanyFilterGroup label="Forecast" company="Forecast" color="violet" data={data} excludedJobIds={excludedJobIds} onToggleJob={onToggleJob} onSelectAll={onSelectAll} onDeselectAll={onDeselectAll} />
                    <CompanyFilterGroup label="Other" company="Unknown" color="slate" data={data} excludedJobIds={excludedJobIds} onToggleJob={onToggleJob} onSelectAll={onSelectAll} onDeselectAll={onDeselectAll} defaultOpen={false} />
                </div>

                {/* Footer with Done button for mobile */}
                <div className="mt-2 border-t pt-3 sm:hidden">
                    <Button className="h-11 w-full" onClick={() => onOpenChange(false)}>
                        Done
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
