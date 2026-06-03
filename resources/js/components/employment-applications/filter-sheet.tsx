import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxTrigger } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Filter } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export interface Filters {
    status?: string;
    occupation?: string;
    search?: string;
    suburb?: string;
    date_from?: string;
    date_to?: string;
    duplicates_only?: string;
    apprentice?: string;
    apprentice_year?: string;
    per_page?: string | number;
}

export function countActiveFilters(filters: Filters): number {
    return [
        filters.status,
        filters.occupation,
        filters.suburb,
        filters.date_from || filters.date_to,
        filters.duplicates_only,
        filters.apprentice,
        filters.apprentice_year,
    ].filter(Boolean).length;
}

type ComboItem = { value: string; label: string };

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    filters: Filters;
    statuses: Record<string, string>;
    occupations: string[];
    onApply: (partial: Partial<Filters>) => void;
    onReset: () => void;
}

export function FilterSheet({ open, onOpenChange, filters, statuses, occupations, onApply, onReset }: Props) {
    const [suburb, setSuburb] = useState(filters.suburb ?? '');
    const suburbTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => {
        setSuburb(filters.suburb ?? '');
    }, [filters.suburb]);

    const activeFilterCount = countActiveFilters(filters);

    const statusItems = useMemo<ComboItem[]>(
        () => [{ value: '', label: 'All statuses' }, ...Object.entries(statuses).map(([value, label]) => ({ value, label }))],
        [statuses],
    );
    const occupationItems = useMemo<ComboItem[]>(
        () => [
            { value: '', label: 'All occupations' },
            ...occupations.map((occ) => ({ value: occ, label: occ.charAt(0).toUpperCase() + occ.slice(1) })),
        ],
        [occupations],
    );
    const selectedStatus = statusItems.find((i) => i.value === (filters.status ?? '')) ?? statusItems[0];
    const selectedOccupation = occupationItems.find((i) => i.value === (filters.occupation ?? '')) ?? occupationItems[0];

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                    <Filter size={14} />
                    Filters
                    {activeFilterCount > 0 && (
                        <Badge variant="secondary" className="ml-0.5 h-5 min-w-5 rounded-full px-1.5 text-xs">
                            {activeFilterCount}
                        </Badge>
                    )}
                </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md">
                <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
                    {/* Status */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-muted-foreground text-xs font-medium">Status</label>
                        <Combobox<ComboItem>
                            items={statusItems}
                            value={selectedStatus}
                            itemToStringLabel={(item) => item.label}
                            itemToStringValue={(item) => item.value}
                            onValueChange={(item) => item && onApply({ status: item.value })}
                        >
                            <ComboboxTrigger
                                render={<Button variant="outline" className="w-full justify-between" />}
                                aria-label="Filter by status"
                            >
                                <span className="truncate">{selectedStatus.label}</span>
                            </ComboboxTrigger>
                            <ComboboxContent className="w-(--anchor-width) p-0">
                                <ComboboxInput placeholder="Search statuses..." className="h-9" showTrigger={false} />
                                <ComboboxEmpty>No statuses found.</ComboboxEmpty>
                                <ComboboxList>
                                    {(option: ComboItem) => (
                                        <ComboboxItem key={option.value} value={option}>
                                            <span className="truncate">{option.label}</span>
                                        </ComboboxItem>
                                    )}
                                </ComboboxList>
                            </ComboboxContent>
                        </Combobox>
                    </div>

                    {/* Occupation */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-muted-foreground text-xs font-medium">Occupation</label>
                        <Combobox<ComboItem>
                            items={occupationItems}
                            value={selectedOccupation}
                            itemToStringLabel={(item) => item.label}
                            itemToStringValue={(item) => item.value}
                            onValueChange={(item) => item && onApply({ occupation: item.value })}
                        >
                            <ComboboxTrigger
                                render={<Button variant="outline" className="w-full justify-between" />}
                                aria-label="Filter by occupation"
                            >
                                <span className="truncate">{selectedOccupation.label}</span>
                            </ComboboxTrigger>
                            <ComboboxContent className="w-(--anchor-width) p-0">
                                <ComboboxInput placeholder="Search occupations..." className="h-9" showTrigger={false} />
                                <ComboboxEmpty>No occupations found.</ComboboxEmpty>
                                <ComboboxList>
                                    {(option: ComboItem) => (
                                        <ComboboxItem key={option.value} value={option}>
                                            <span className="truncate">{option.label}</span>
                                        </ComboboxItem>
                                    )}
                                </ComboboxList>
                            </ComboboxContent>
                        </Combobox>
                    </div>

                    {/* Apprentices */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-muted-foreground text-xs font-medium">Apprentices</label>
                        <Select
                            value={filters.apprentice ?? ''}
                            onValueChange={(v) =>
                                onApply({
                                    apprentice: v === 'all' ? '' : v,
                                    apprentice_year: v !== 'only' ? '' : filters.apprentice_year,
                                })
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="All candidates" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All candidates</SelectItem>
                                <SelectItem value="only">Apprentices only</SelectItem>
                                <SelectItem value="exclude">Exclude apprentices</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Apprentice year — only when filtering apprentices */}
                    {filters.apprentice === 'only' && (
                        <div className="flex flex-col gap-1.5">
                            <label className="text-muted-foreground text-xs font-medium">Apprentice year</label>
                            <Select
                                value={filters.apprentice_year ?? ''}
                                onValueChange={(v) => onApply({ apprentice_year: v === 'all' ? '' : v })}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Any year" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Any year</SelectItem>
                                    <SelectItem value="1">Year 1</SelectItem>
                                    <SelectItem value="2">Year 2</SelectItem>
                                    <SelectItem value="3">Year 3</SelectItem>
                                    <SelectItem value="4">Year 4</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Suburb */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-muted-foreground text-xs font-medium">Suburb</label>
                        <Input
                            type="text"
                            placeholder="Any suburb"
                            value={suburb}
                            onChange={(e) => {
                                setSuburb(e.target.value);
                                clearTimeout(suburbTimeout.current);
                                suburbTimeout.current = setTimeout(() => onApply({ suburb: e.target.value }), 400);
                            }}
                            className="w-full"
                        />
                    </div>

                    {/* Date range */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-muted-foreground text-xs font-medium">Date range</label>
                        <div className="flex items-center gap-2">
                            <DatePicker
                                value={filters.date_from ?? ''}
                                onChange={(v) => onApply({ date_from: v })}
                                placeholder="From"
                                max={filters.date_to}
                                clearable
                                className="flex-1"
                                aria-label="Date from"
                            />
                            <span className="text-muted-foreground text-xs">to</span>
                            <DatePicker
                                value={filters.date_to ?? ''}
                                onChange={(v) => onApply({ date_to: v })}
                                placeholder="To"
                                min={filters.date_from}
                                clearable
                                className="flex-1"
                                aria-label="Date to"
                            />
                        </div>
                    </div>

                    {/* Duplicates checkbox */}
                    <label htmlFor="duplicates_only" className="flex cursor-pointer items-center gap-2">
                        <Checkbox
                            id="duplicates_only"
                            checked={filters.duplicates_only === '1'}
                            onCheckedChange={(checked) => onApply({ duplicates_only: checked ? '1' : '' })}
                        />
                        <span className="text-sm whitespace-nowrap">Duplicates only</span>
                    </label>
                </div>
                <SheetFooter className="flex-row justify-end gap-2">
                    <Button variant="ghost" onClick={onReset} disabled={activeFilterCount === 0 && !filters.search}>
                        Reset
                    </Button>
                    <Button onClick={() => onOpenChange(false)}>Done</Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
