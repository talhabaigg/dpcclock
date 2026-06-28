import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Check, ChevronsUpDown, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { type DeliverableLocation } from './shared';

interface Props {
    location: DeliverableLocation;
    siblings: DeliverableLocation[];
    filters: { expiry: string | null; notify: 'yes' | 'no' | null };
    expiryOptions: Record<string, string>;
    activeCount: number;
    onChange: (key: 'expiry' | 'notify', value: string | null) => void;
    onReset: () => void;
    onSwitchLocation: (id: number) => void;
}

export default function WhsDeliverableFiltersSheet({
    location,
    siblings,
    filters,
    expiryOptions,
    activeCount,
    onChange,
    onReset,
    onSwitchLocation,
}: Props) {
    const [locationOpen, setLocationOpen] = useState(false);
    const canSwitchLocation = siblings.length > 1;

    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2">
                    <SlidersHorizontal className="h-4 w-4" />
                    <span className="hidden sm:inline">Filters</span>
                    {activeCount > 0 && <Badge className="ml-0.5 h-5 min-w-5 rounded-full px-1.5 text-[10px]">{activeCount}</Badge>}
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
                    {/* Project */}
                    {canSwitchLocation && (
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium">Project</Label>
                            <Popover open={locationOpen} onOpenChange={setLocationOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={locationOpen}
                                        className="w-full justify-between font-normal"
                                        title={location.name}
                                    >
                                        <span className="truncate">{location.name}</span>
                                        <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[var(--anchor-width)] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Search projects..." />
                                        <CommandList>
                                            <CommandEmpty>No projects found.</CommandEmpty>
                                            <CommandGroup>
                                                {siblings.map((loc) => (
                                                    <CommandItem
                                                        key={loc.id}
                                                        onSelect={() => {
                                                            onSwitchLocation(loc.id);
                                                            setLocationOpen(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={`mr-2 h-3.5 w-3.5 ${loc.id === location.id ? 'opacity-100' : 'opacity-0'}`}
                                                        />
                                                        {loc.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                    )}

                    {/* Expiry */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Expiry</Label>
                            {filters.expiry && (
                                <button
                                    onClick={() => onChange('expiry', null)}
                                    className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                        <Select value={filters.expiry ?? 'all'} onValueChange={(v) => onChange('expiry', v === 'all' ? null : v)}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Any expiry" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Any expiry</SelectItem>
                                {Object.entries(expiryOptions).map(([k, v]) => (
                                    <SelectItem key={k} value={k}>
                                        {v}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Notifications */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-medium">Notifications</Label>
                        <div className="grid grid-cols-3 gap-1.5">
                            {(
                                [
                                    ['all', 'Any'],
                                    ['yes', 'On'],
                                    ['no', 'Off'],
                                ] as const
                            ).map(([val, label]) => {
                                const active = (filters.notify ?? 'all') === val;
                                return (
                                    <button
                                        key={val}
                                        type="button"
                                        onClick={() => onChange('notify', val === 'all' ? null : val)}
                                        className={`rounded-md border px-2.5 py-2 text-xs font-medium transition-colors ${
                                            active
                                                ? 'border-primary bg-primary text-primary-foreground'
                                                : 'border-border bg-background hover:bg-muted'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
