import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import type { TurnoverRow } from '../lib/data-transformer';

interface CompanyFilterGroupProps {
    label: string;
    company: TurnoverRow['company'];
    color?: string;
    data: TurnoverRow[];
    excludedJobIds: Set<string>;
    onToggleJob: (row: TurnoverRow) => void;
    onSelectAll: (ids: string[]) => void;
    onDeselectAll: (ids: string[]) => void;
    defaultOpen?: boolean;
    search?: string;
}

export function CompanyFilterGroup({
    label,
    company,
    data,
    excludedJobIds,
    onToggleJob,
    onSelectAll,
    onDeselectAll,
    defaultOpen = true,
    search = '',
}: CompanyFilterGroupProps) {
    const companyRows = useMemo(() => data.filter((row) => row.company === company), [data, company]);

    const visibleRows = useMemo(() => {
        if (!search) return companyRows;
        const q = search.toLowerCase();
        return companyRows.filter(
            (row) => row.job_name.toLowerCase().includes(q) || row.job_number?.toLowerCase().includes(q),
        );
    }, [companyRows, search]);

    if (companyRows.length === 0) return null;
    if (search && visibleRows.length === 0) return null;

    const companyIds = companyRows.map((r) => `${r.type}-${r.id}`);
    const selectedCount = companyRows.filter((r) => !excludedJobIds.has(`${r.type}-${r.id}`)).length;

    return (
        <Collapsible defaultOpen={defaultOpen}>
            <CollapsibleTrigger className="group/trigger flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted">
                <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0 transition-transform duration-200 group-data-[panel-open]/trigger:rotate-90" />
                <span className="font-medium">{label}</span>
                <span className="text-muted-foreground text-xs tabular-nums">
                    {selectedCount}/{companyRows.length}
                </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className="ml-6 space-y-0.5 border-l py-1 pl-3">
                    {!search && (
                        <div className="flex gap-1 pb-1">
                            <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs"
                                onClick={() => onSelectAll(companyIds)}
                            >
                                Select All
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs"
                                onClick={() => onDeselectAll(companyIds)}
                            >
                                Deselect All
                            </Button>
                        </div>
                    )}
                    {visibleRows.map((row) => {
                        const key = `${row.type}-${row.id}`;
                        const isExcluded = excludedJobIds.has(key);
                        return (
                            <label
                                key={key}
                                htmlFor={key}
                                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted"
                            >
                                <Checkbox
                                    id={key}
                                    checked={!isExcluded}
                                    onCheckedChange={() => onToggleJob(row)}
                                />
                                <span className="flex-1 text-sm leading-tight">
                                    {row.job_name}
                                    <span className="text-muted-foreground block text-xs">{row.job_number}</span>
                                </span>
                            </label>
                        );
                    })}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
