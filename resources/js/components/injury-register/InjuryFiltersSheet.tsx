import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import type { InjuryFilters, InjuryLocation } from '@/types/injury';
import { Check, ChevronsUpDown, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';

interface InjuryFiltersSheetProps {
    filters: InjuryFilters;
    locations: InjuryLocation[];
    incidentOptions: Record<string, string>;
    reportTypeOptions: Record<string, string>;
    activeCount: number;
    onFilterChange: (key: keyof InjuryFilters, value: string | undefined) => void;
    onReset: () => void;
    onClearDateRange: () => void;
}

export default function InjuryFiltersSheet({
    filters,
    locations,
    incidentOptions,
    reportTypeOptions,
    activeCount,
    onFilterChange,
    onReset,
    onClearDateRange,
}: InjuryFiltersSheetProps) {
    const [locationOpen, setLocationOpen] = useState(false);

    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <SlidersHorizontal className="h-4 w-4" />
                    Filters
                    {activeCount > 0 && (
                        <Badge className="ml-0.5 h-5 min-w-5 rounded-full px-1.5 text-[10px]">
                            {activeCount}
                        </Badge>
                    )}
                </Button>
            </SheetTrigger>
            <SheetContent className="w-full overflow-y-auto sm:max-w-sm">
                <SheetHeader>
                    <div className="flex items-center justify-between">
                        <SheetTitle>Filters</SheetTitle>
                        {activeCount > 0 && (
                            <Button variant="ghost" size="sm" onClick={onReset} className="text-muted-foreground h-auto px-2 py-1 text-xs">
                                Clear all
                            </Button>
                        )}
                    </div>
                </SheetHeader>

                <div className="flex flex-col gap-5 px-4 pb-6">
                    {/* Location */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Location</Label>
                            {filters.location_id && (
                                <button onClick={() => onFilterChange('location_id', 'all')} className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline">Clear</button>
                            )}
                        </div>
                        <Popover open={locationOpen} onOpenChange={setLocationOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" aria-expanded={locationOpen} className="w-full justify-between font-normal">
                                    <span className="truncate">
                                        {filters.location_id
                                            ? locations.find((l) => String(l.id) === filters.location_id)?.name ?? 'All'
                                            : 'All'}
                                    </span>
                                    <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--anchor-width)] p-0" align="start">
                                <Command>
                                    <CommandInput placeholder="Search locations..." />
                                    <CommandList>
                                        <CommandEmpty>No location found.</CommandEmpty>
                                        <CommandGroup>
                                            <CommandItem onSelect={() => { onFilterChange('location_id', 'all'); setLocationOpen(false); }}>
                                                <Check className={`mr-2 h-3.5 w-3.5 ${!filters.location_id ? 'opacity-100' : 'opacity-0'}`} />
                                                All
                                            </CommandItem>
                                            {locations.map((loc) => (
                                                <CommandItem key={loc.id} onSelect={() => { onFilterChange('location_id', String(loc.id)); setLocationOpen(false); }}>
                                                    <Check className={`mr-2 h-3.5 w-3.5 ${filters.location_id === String(loc.id) ? 'opacity-100' : 'opacity-0'}`} />
                                                    {loc.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Incident */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Incident</Label>
                            {filters.incident && (
                                <button onClick={() => onFilterChange('incident', 'all')} className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline">Clear</button>
                            )}
                        </div>
                        <Select value={filters.incident ?? 'all'} onValueChange={(v) => onFilterChange('incident', v)}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="All" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                {Object.entries(incidentOptions).map(([key, label]) => (
                                    <SelectItem key={key} value={key}>{label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Report Type */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Report Type</Label>
                            {filters.report_type && (
                                <button onClick={() => onFilterChange('report_type', 'all')} className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline">Clear</button>
                            )}
                        </div>
                        <Select value={filters.report_type ?? 'all'} onValueChange={(v) => onFilterChange('report_type', v)}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="All" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                {Object.entries(reportTypeOptions).map(([key, label]) => (
                                    <SelectItem key={key} value={key}>{label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* WorkCover */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">WorkCover</Label>
                            {filters.work_cover_claim && (
                                <button onClick={() => onFilterChange('work_cover_claim', 'all')} className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline">Clear</button>
                            )}
                        </div>
                        <Select
                            value={filters.work_cover_claim === '1' ? 'yes' : filters.work_cover_claim === '0' ? 'no' : 'all'}
                            onValueChange={(v) => onFilterChange('work_cover_claim', v === 'yes' ? '1' : v === 'no' ? '0' : 'all')}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="All" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="yes">Yes</SelectItem>
                                <SelectItem value="no">No</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Status */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Status</Label>
                            {filters.status && (
                                <button onClick={() => onFilterChange('status', 'all')} className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline">Clear</button>
                            )}
                        </div>
                        <Select value={filters.status ?? 'all'} onValueChange={(v) => onFilterChange('status', v)}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="All" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="locked">Locked</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Occurred Date Range */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Occurred Date</Label>
                            {(filters.date_from || filters.date_to) && (
                                <button
                                    onClick={onClearDateRange}
                                    className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label className="text-muted-foreground text-xs">From</Label>
                                <DatePicker
                                    value={filters.date_from ?? ''}
                                    onChange={(v) => onFilterChange('date_from', v || undefined)}
                                    max={filters.date_to || undefined}
                                    clearable
                                    placeholder="From"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-muted-foreground text-xs">To</Label>
                                <DatePicker
                                    value={filters.date_to ?? ''}
                                    onChange={(v) => onFilterChange('date_to', v || undefined)}
                                    min={filters.date_from || undefined}
                                    clearable
                                    placeholder="To"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
