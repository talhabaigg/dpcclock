import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import type { TurnoverRow } from '../lib/data-transformer';

type CompanyColor = 'emerald' | 'blue' | 'violet' | 'slate';

const colorConfig: Record<
    CompanyColor,
    {
        border: string;
        triggerBg: string;
        triggerHover: string;
        dot: string;
        title: string;
        contentBg: string;
        divider: string;
        itemHover: string;
        itemActive: string;
    }
> = {
    emerald: {
        border: 'border-emerald-200 dark:border-emerald-800',
        triggerBg: 'bg-emerald-50 dark:bg-emerald-950/30',
        triggerHover: 'hover:bg-emerald-100 dark:hover:bg-emerald-950/50',
        dot: 'bg-emerald-500',
        title: 'text-emerald-800 dark:text-emerald-300',
        contentBg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
        divider: 'border-emerald-200 dark:border-emerald-800',
        itemHover: 'hover:bg-emerald-100 dark:hover:bg-emerald-900/30',
        itemActive: 'active:bg-emerald-200 dark:active:bg-emerald-900/50',
    },
    blue: {
        border: 'border-blue-200 dark:border-blue-800',
        triggerBg: 'bg-blue-50 dark:bg-blue-950/30',
        triggerHover: 'hover:bg-blue-100 dark:hover:bg-blue-950/50',
        dot: 'bg-blue-500',
        title: 'text-blue-800 dark:text-blue-300',
        contentBg: 'bg-blue-50/50 dark:bg-blue-950/20',
        divider: 'border-blue-200 dark:border-blue-800',
        itemHover: 'hover:bg-blue-100 dark:hover:bg-blue-900/30',
        itemActive: 'active:bg-blue-200 dark:active:bg-blue-900/50',
    },
    violet: {
        border: 'border-violet-200 dark:border-violet-800',
        triggerBg: 'bg-violet-50 dark:bg-violet-950/30',
        triggerHover: 'hover:bg-violet-100 dark:hover:bg-violet-950/50',
        dot: 'bg-violet-500',
        title: 'text-violet-800 dark:text-violet-300',
        contentBg: 'bg-violet-50/50 dark:bg-violet-950/20',
        divider: 'border-violet-200 dark:border-violet-800',
        itemHover: 'hover:bg-violet-100 dark:hover:bg-violet-900/30',
        itemActive: 'active:bg-violet-200 dark:active:bg-violet-900/50',
    },
    slate: {
        border: 'border-slate-200 dark:border-slate-700',
        triggerBg: 'bg-slate-50 dark:bg-slate-900/30',
        triggerHover: 'hover:bg-slate-100 dark:hover:bg-slate-900/50',
        dot: 'bg-slate-500',
        title: 'text-slate-700 dark:text-slate-300',
        contentBg: 'bg-slate-50/50 dark:bg-slate-950/20',
        divider: 'border-slate-200 dark:border-slate-700',
        itemHover: 'hover:bg-slate-100 dark:hover:bg-slate-800/30',
        itemActive: 'active:bg-slate-200 dark:active:bg-slate-800/50',
    },
};

interface CompanyFilterGroupProps {
    label: string;
    company: TurnoverRow['company'];
    color: CompanyColor;
    data: TurnoverRow[];
    excludedJobIds: Set<string>;
    onToggleJob: (row: TurnoverRow) => void;
    onSelectAll: (ids: string[]) => void;
    onDeselectAll: (ids: string[]) => void;
    defaultOpen?: boolean;
}

export function CompanyFilterGroup({
    label,
    company,
    color,
    data,
    excludedJobIds,
    onToggleJob,
    onSelectAll,
    onDeselectAll,
    defaultOpen = true,
}: CompanyFilterGroupProps) {
    const companyRows = data.filter((row) => row.company === company);
    if (companyRows.length === 0) return null;

    const companyIds = companyRows.map((r) => `${r.type}-${r.id}`);
    const selectedCount = companyRows.filter((r) => !excludedJobIds.has(`${r.type}-${r.id}`)).length;
    const c = colorConfig[color];

    return (
        <Collapsible defaultOpen={defaultOpen} className={`overflow-hidden rounded-lg border ${c.border}`}>
            <CollapsibleTrigger className={`flex w-full items-center justify-between p-3 transition-colors sm:p-2 ${c.triggerBg} ${c.triggerHover}`}>
                <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${c.dot}`} />
                    <span className={`font-semibold ${c.title}`}>{label}</span>
                    <span className="text-muted-foreground text-sm">
                        ({selectedCount}/{companyRows.length})
                    </span>
                </div>
                <ChevronDown className="text-muted-foreground h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className={`space-y-1 p-2 ${c.contentBg}`}>
                    <div className={`flex gap-2 border-b pb-2 ${c.divider}`}>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 flex-1 px-3 text-xs"
                            onClick={() => onSelectAll(companyIds)}
                        >
                            Select All
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 flex-1 px-3 text-xs"
                            onClick={() => onDeselectAll(companyIds)}
                        >
                            Deselect All
                        </Button>
                    </div>
                    {companyRows.map((row) => {
                        const key = `${row.type}-${row.id}`;
                        const isExcluded = excludedJobIds.has(key);
                        return (
                            <label
                                key={key}
                                htmlFor={key}
                                className={`flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors ${c.itemHover} ${c.itemActive}`}
                            >
                                <Checkbox
                                    id={key}
                                    checked={!isExcluded}
                                    onCheckedChange={() => onToggleJob(row)}
                                    className="h-5 w-5"
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
