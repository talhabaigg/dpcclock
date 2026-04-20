import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Menubar,
    MenubarCheckboxItem,
    MenubarContent,
    MenubarItem,
    MenubarMenu,
    MenubarSeparator,
    MenubarSub,
    MenubarSubContent,
    MenubarSubTrigger,
    MenubarTrigger,
} from '@/components/ui/menubar';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { ArrowDownUp, CalendarDays, CalendarRange, CheckSquare, Filter, HardHat, HelpCircle, Link2, Maximize2, Palette, Search, User, X } from 'lucide-react';
import type { ColumnKey, ColumnVisibility, FilterFlag, SortMode, TaskStatus, ZoomLevel } from './types';
import { COLUMN_LABELS, MANUAL_STATUSES, PRESET_COLORS, SORT_MODE_LABELS, STATUS_LABELS } from './types';

interface ScheduleToolbarProps {
    zoom: ZoomLevel;
    onZoomChange: (zoom: ZoomLevel) => void;
    onAddTask: () => void;
    onExpandAll: () => void;
    onCollapseAll: () => void;
    onGoToToday: () => void;
    onAutoFit: () => void;
    linkMode: boolean;
    onToggleLinkMode: () => void;
    showBaseline: boolean;
    onToggleBaseline: () => void;
    activeFilters: Set<FilterFlag>;
    onToggleFilter: (flag: FilterFlag) => void;
    filterTaskName: string | null;
    onClearTaskFilter: () => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onDownloadTemplate: () => void;
    onExportMsProject: () => void;
    onSetBaseline: () => void;
    onRevertToBaseline: () => void;
    onClearAll: () => void;
    onBulkMarkOwned: () => void;
    onBulkUnmarkOwned: () => void;
    onBulkSetResponsible: (value: string | null) => void;
    onBulkSetStatus: (status: TaskStatus | null) => void;
    onBulkSetColor: (color: string | null) => void;
    responsibleOptions: string[];
    filteredTaskCount: number;
    hasFilteredTasks: boolean;
    hasColumnFilter: boolean;
    onImport: () => void;
    sortMode: SortMode;
    onSortModeChange: (mode: SortMode) => void;
    startDateRange: { from: string | null; to: string | null };
    onClearStartDateRange: () => void;
    endDateRange: { from: string | null; to: string | null };
    onClearEndDateRange: () => void;
    importButton?: React.ReactNode;
    calendarHref?: string;
    visibleColumns: ColumnVisibility;
    onToggleColumn: (key: ColumnKey) => void;
}

const VIEW_OPTIONS: { key: ZoomLevel; label: string }[] = [
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'quarter', label: 'Quarter' },
    { key: 'year', label: 'Year' },
];

export default function ScheduleToolbar({
    zoom,
    onZoomChange,
    onAddTask,
    onExpandAll,
    onCollapseAll,
    onGoToToday,
    onAutoFit,
    linkMode,
    onToggleLinkMode,
    showBaseline,
    onToggleBaseline,
    activeFilters,
    onToggleFilter,
    filterTaskName,
    onClearTaskFilter,
    searchQuery,
    onSearchChange,
    onDownloadTemplate,
    onExportMsProject,
    onSetBaseline,
    onRevertToBaseline,
    onClearAll,
    onBulkMarkOwned,
    onBulkUnmarkOwned,
    onBulkSetResponsible,
    onBulkSetStatus,
    onBulkSetColor,
    responsibleOptions,
    filteredTaskCount,
    hasFilteredTasks,
    hasColumnFilter,
    onImport,
    sortMode,
    onSortModeChange,
    startDateRange,
    onClearStartDateRange,
    endDateRange,
    onClearEndDateRange,
    importButton,
    calendarHref,
    visibleColumns,
    onToggleColumn,
}: ScheduleToolbarProps) {
    const columnKeys: ColumnKey[] = ['start', 'finish', 'days', 'responsible', 'status'];
    return (
        <div className="flex flex-col">
            {/* Menu bar row */}
            <div className="flex items-center gap-2 border-b px-3 py-1">
                <Menubar className="h-auto gap-0 border-none bg-transparent p-0 shadow-none">
                    {/* File menu */}
                    <MenubarMenu>
                        <MenubarTrigger className="px-2 py-1 text-xs">File</MenubarTrigger>
                        <MenubarContent>
                            <MenubarItem onClick={onImport}>Import</MenubarItem>
                            <MenubarItem onClick={onDownloadTemplate}>Download Import Template</MenubarItem>
                            <MenubarSeparator />
                            <MenubarItem onClick={onExportMsProject}>Export to Microsoft Project</MenubarItem>
                        </MenubarContent>
                    </MenubarMenu>

                    {/* Tasks menu */}
                    <MenubarMenu>
                        <MenubarTrigger className="px-2 py-1 text-xs">Tasks</MenubarTrigger>
                        <MenubarContent>
                            <MenubarItem onClick={onAddTask}>Add Task</MenubarItem>
                            <MenubarItem onClick={onSetBaseline}>Set Baseline</MenubarItem>
                            <MenubarItem onClick={onRevertToBaseline}>Restore to Baseline</MenubarItem>
                            <MenubarSeparator />
                            <MenubarItem className="text-destructive focus:text-destructive" onClick={onClearAll}>
                                Delete All Tasks
                            </MenubarItem>
                        </MenubarContent>
                    </MenubarMenu>

                    {/* View menu */}
                    <MenubarMenu>
                        <MenubarTrigger className="px-2 py-1 text-xs">View</MenubarTrigger>
                        <MenubarContent>
                            <MenubarCheckboxItem checked={linkMode} onCheckedChange={onToggleLinkMode}>
                                Link Tasks
                            </MenubarCheckboxItem>
                            <MenubarCheckboxItem checked={showBaseline} onCheckedChange={onToggleBaseline}>
                                Show Baseline
                            </MenubarCheckboxItem>
                            <MenubarSub>
                                <MenubarSubTrigger inset>Columns</MenubarSubTrigger>
                                <MenubarSubContent>
                                    {columnKeys.map((key) => (
                                        <MenubarCheckboxItem key={key} checked={visibleColumns[key]} onCheckedChange={() => onToggleColumn(key)}>
                                            {COLUMN_LABELS[key]}
                                        </MenubarCheckboxItem>
                                    ))}
                                </MenubarSubContent>
                            </MenubarSub>
                            <MenubarSeparator />
                            <MenubarItem inset onClick={onExpandAll}>
                                Expand All Tasks
                            </MenubarItem>
                            <MenubarItem inset onClick={onCollapseAll}>
                                Collapse All Tasks
                            </MenubarItem>
                            <MenubarSeparator />
                            <MenubarCheckboxItem checked={activeFilters.has('delayed')} onCheckedChange={() => onToggleFilter('delayed')}>
                                Late Tasks
                            </MenubarCheckboxItem>
                            <MenubarCheckboxItem checked={activeFilters.has('critical')} onCheckedChange={() => onToggleFilter('critical')}>
                                Critical Path
                            </MenubarCheckboxItem>
                            <MenubarCheckboxItem checked={activeFilters.has('ours')} onCheckedChange={() => onToggleFilter('ours')}>
                                Our Team
                            </MenubarCheckboxItem>
                        </MenubarContent>
                    </MenubarMenu>
                </Menubar>

                {/* Import dialog (hidden, triggered via File > Import menu item) */}
                <div className="ml-auto flex items-center gap-2">
                    {calendarHref && (
                        <Button asChild size="sm" variant="outline" className="h-7 gap-1.5 text-xs">
                            <Link href={calendarHref}>
                                <CalendarRange className="h-3.5 w-3.5" />
                                Project Calendar
                            </Link>
                        </Button>
                    )}
                    {importButton}
                </div>
            </div>

            {/* Action toolbar row */}
            <div className="flex flex-wrap items-center gap-2 border-b px-3 py-1.5">
                {/* Zoom presets */}
                <div className="bg-muted inline-flex items-center rounded-md p-0.5">
                    {VIEW_OPTIONS.map((opt) => (
                        <button
                            key={opt.key}
                            onClick={() => onZoomChange(opt.key)}
                            className={cn(
                                'rounded-sm px-2.5 py-0.5 text-xs font-medium transition-colors',
                                zoom === opt.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                <Button size="sm" variant="outline" onClick={onGoToToday} title="Go to today" className="h-7 text-xs">
                    <CalendarDays className="mr-1 h-3.5 w-3.5" />
                    Today
                </Button>
                <Button size="icon" variant="outline" onClick={onAutoFit} title="Auto-fit" className="h-7 w-7">
                    <Maximize2 className="h-3.5 w-3.5" />
                </Button>
                <div className="inline-flex items-center">
                    <Button
                        size="sm"
                        variant={linkMode ? 'default' : 'outline'}
                        onClick={onToggleLinkMode}
                        title="Link tasks together"
                        className="h-7 rounded-r-none border-r-0 text-xs"
                    >
                        <Link2 className="mr-1 h-3.5 w-3.5" />
                        Link Tasks
                    </Button>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                size="icon"
                                variant={linkMode ? 'default' : 'outline'}
                                className="h-7 w-6 rounded-l-none"
                                title="How linking works"
                                aria-label="How linking works"
                            >
                                <HelpCircle className="h-3.5 w-3.5" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-80 text-xs">
                            <div className="space-y-2">
                                <div className="font-semibold text-sm">Linking Tasks</div>
                                <p className="text-muted-foreground">
                                    Each task has two connector dots — one at the <strong>start</strong> and one at the <strong>finish</strong>. Hover over a bar
                                    to reveal them.
                                </p>
                                <p className="text-muted-foreground">Click a dot on one task, then click a dot on another to create a dependency.</p>
                                <div className="border-t pt-2">
                                    <div className="font-medium mb-1">Dependency types</div>
                                    <ul className="text-muted-foreground space-y-0.5">
                                        <li><strong className="text-foreground">FS</strong> — Finish → Start (most common)</li>
                                        <li><strong className="text-foreground">SS</strong> — Start → Start</li>
                                        <li><strong className="text-foreground">FF</strong> — Finish → Finish</li>
                                        <li><strong className="text-foreground">SF</strong> — Start → Finish</li>
                                    </ul>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Sort menu */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            size="sm"
                            variant="outline"
                            className={cn('h-7 text-xs', sortMode !== 'manual' && 'border-primary text-primary')}
                            title={`Sort: ${SORT_MODE_LABELS[sortMode]}`}
                        >
                            <ArrowDownUp className="mr-1 h-3.5 w-3.5" />
                            Sort
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        <DropdownMenuRadioGroup value={sortMode} onValueChange={(v) => onSortModeChange(v as SortMode)}>
                            {(Object.entries(SORT_MODE_LABELS) as [SortMode, string][]).map(([key, label]) => (
                                <DropdownMenuRadioItem key={key} value={key} className="text-xs">
                                    {label}
                                </DropdownMenuRadioItem>
                            ))}
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="bg-border mx-1 h-4 w-px" />

                {/* Search */}
                <div className="relative">
                    <Search className="text-muted-foreground absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2" />
                    <Input
                        id="schedule-search-input"
                        className="h-7 w-[150px] pl-6 text-xs"
                        placeholder="Search tasks… (F)"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                </div>

                {/* Active filters summary — collapsed into a single pill to keep the toolbar calm */}
                <FilterSummary
                    activeFilters={activeFilters}
                    onToggleFilter={onToggleFilter}
                    filterTaskName={filterTaskName}
                    onClearTaskFilter={onClearTaskFilter}
                    searchQuery={searchQuery}
                    onSearchChange={onSearchChange}
                    startDateRange={startDateRange}
                    onClearStartDateRange={onClearStartDateRange}
                    endDateRange={endDateRange}
                    onClearEndDateRange={onClearEndDateRange}
                />

                {/* Mode indicators — stay inline because they change what's rendered, not what's filtered */}
                {showBaseline && (
                    <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
                        Baseline
                        <button onClick={onToggleBaseline} className="hover:text-foreground" aria-label="Hide baseline">
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                )}

                {/* Bulk actions — visible whenever a filter narrows the visible set */}
                <BulkActions
                    activeFilters={activeFilters}
                    searchQuery={searchQuery}
                    filterTaskName={filterTaskName}
                    startDateRange={startDateRange}
                    endDateRange={endDateRange}
                    filteredTaskCount={filteredTaskCount}
                    hasFilteredTasks={hasFilteredTasks}
                    hasColumnFilter={hasColumnFilter}
                    responsibleOptions={responsibleOptions}
                    onBulkMarkOwned={onBulkMarkOwned}
                    onBulkUnmarkOwned={onBulkUnmarkOwned}
                    onBulkSetResponsible={onBulkSetResponsible}
                    onBulkSetStatus={onBulkSetStatus}
                    onBulkSetColor={onBulkSetColor}
                />
            </div>
        </div>
    );
}

interface BulkActionsProps {
    activeFilters: Set<FilterFlag>;
    searchQuery: string;
    filterTaskName: string | null;
    startDateRange: { from: string | null; to: string | null };
    endDateRange: { from: string | null; to: string | null };
    filteredTaskCount: number;
    hasFilteredTasks: boolean;
    hasColumnFilter: boolean;
    responsibleOptions: string[];
    onBulkMarkOwned: () => void;
    onBulkUnmarkOwned: () => void;
    onBulkSetResponsible: (value: string | null) => void;
    onBulkSetStatus: (status: TaskStatus | null) => void;
    onBulkSetColor: (color: string | null) => void;
}

function BulkActions({
    activeFilters,
    searchQuery,
    filterTaskName,
    startDateRange,
    endDateRange,
    filteredTaskCount,
    hasFilteredTasks,
    hasColumnFilter,
    responsibleOptions,
    onBulkMarkOwned,
    onBulkUnmarkOwned,
    onBulkSetResponsible,
    onBulkSetStatus,
    onBulkSetColor,
}: BulkActionsProps) {
    const anyFilter =
        activeFilters.size > 0 ||
        !!searchQuery ||
        !!filterTaskName ||
        !!(startDateRange.from || startDateRange.to) ||
        !!(endDateRange.from || endDateRange.to) ||
        hasColumnFilter;

    if (!anyFilter || !hasFilteredTasks) return null;

    const n = filteredTaskCount;
    const confirmAndRun = (label: string, fn: () => void) => {
        if (window.confirm(`${label} on ${n} visible task${n === 1 ? '' : 's'}?`)) fn();
    };

    return (
        <div className="ml-auto flex items-center gap-1.5 border-l pl-2">
            <span className="text-muted-foreground text-xs">{n} visible:</span>
            <Button
                size="sm"
                variant="default"
                onClick={() => confirmAndRun('Mark as Ours', onBulkMarkOwned)}
                title="Mark all visible tasks as ours"
                className="h-7 text-xs"
            >
                <HardHat className="mr-1 h-3.5 w-3.5" />
                Mark as Ours
            </Button>
            <Button
                size="sm"
                variant="outline"
                onClick={() => confirmAndRun('Unmark', onBulkUnmarkOwned)}
                title="Unmark all visible tasks"
                className="h-7 text-xs"
            >
                Unmark
            </Button>
            <BulkResponsiblePicker options={responsibleOptions} count={n} onPick={onBulkSetResponsible} />
            <BulkStatusPicker count={n} onPick={onBulkSetStatus} />
            <BulkColorPicker count={n} onPick={onBulkSetColor} />
        </div>
    );
}

function BulkColorPicker({ count, onPick }: { count: number; onPick: (color: string | null) => void }) {
    const [open, setOpen] = useState(false);
    const commit = (c: string | null) => {
        const label = c ?? 'default';
        if (!window.confirm(`Set bar color to ${label} on ${count} visible task${count === 1 ? '' : 's'}?`)) return;
        onPick(c);
        setOpen(false);
    };
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 text-xs" title="Bulk set bar color">
                    <Palette className="mr-1 h-3.5 w-3.5" />
                    Color…
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="end">
                <div className="flex flex-wrap items-center gap-1.5">
                    <button
                        type="button"
                        className="bg-primary h-6 w-6 rounded-full border-2 border-transparent transition-transform hover:scale-110"
                        onClick={() => commit(null)}
                        title="Default"
                    />
                    {PRESET_COLORS.map((c) => (
                        <button
                            key={c}
                            type="button"
                            className="h-6 w-6 rounded-full border-2 border-transparent transition-transform hover:scale-110"
                            style={{ backgroundColor: c }}
                            onClick={() => commit(c)}
                            title={c}
                        />
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}

function BulkResponsiblePicker({ options, count, onPick }: { options: string[]; count: number; onPick: (value: string | null) => void }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const trimmed = query.trim();
    const q = trimmed.toLowerCase();
    const filtered = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
    const exists = trimmed && options.some((o) => o.toLowerCase() === q);

    const commit = (next: string | null) => {
        if (!window.confirm(`Set Responsible${next ? ` to "${next}"` : ' (clear)'} on ${count} visible task${count === 1 ? '' : 's'}?`)) return;
        onPick(next);
        setOpen(false);
        setQuery('');
    };

    return (
        <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery(''); }}>
            <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 text-xs" title="Bulk set Responsible">
                    <User className="mr-1 h-3.5 w-3.5" />
                    Responsible…
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[240px] p-0" align="end" side="bottom">
                <Command shouldFilter={false}>
                    <CommandInput placeholder="Search or create…" className="h-8 text-xs" value={query} onValueChange={setQuery} />
                    <CommandList className="max-h-[240px]">
                        <CommandEmpty className="text-muted-foreground py-2 text-center text-xs">
                            {trimmed ? 'No matches — use Create below.' : 'No options yet.'}
                        </CommandEmpty>
                        {filtered.length > 0 && (
                            <CommandGroup heading="Existing">
                                {filtered.map((opt) => (
                                    <CommandItem key={opt} value={opt} onSelect={() => commit(opt)} className="text-xs">
                                        {opt}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                        {trimmed && !exists && (
                            <CommandGroup heading="Create">
                                <CommandItem onSelect={() => commit(trimmed)} className="text-xs">
                                    Create "{trimmed}"
                                </CommandItem>
                            </CommandGroup>
                        )}
                        <CommandGroup>
                            <CommandItem onSelect={() => commit(null)} className="text-muted-foreground text-xs">
                                Clear responsible
                            </CommandItem>
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

function BulkStatusPicker({ count, onPick }: { count: number; onPick: (status: TaskStatus | null) => void }) {
    const commit = (s: TaskStatus | null) => {
        const label = s ? STATUS_LABELS[s] : 'Clear';
        if (!window.confirm(`Set Status to "${label}" on ${count} visible task${count === 1 ? '' : 's'}?`)) return;
        onPick(s);
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 text-xs" title="Bulk set Status">
                    <CheckSquare className="mr-1 h-3.5 w-3.5" />
                    Status…
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {MANUAL_STATUSES.map((s) => (
                    <DropdownMenuItem key={s} onSelect={() => commit(s)} className="text-xs">
                        {STATUS_LABELS[s]}
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => commit(null)} className="text-muted-foreground text-xs">
                    Clear status
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

interface FilterSummaryProps {
    activeFilters: Set<FilterFlag>;
    onToggleFilter: (flag: FilterFlag) => void;
    filterTaskName: string | null;
    onClearTaskFilter: () => void;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    startDateRange: { from: string | null; to: string | null };
    onClearStartDateRange: () => void;
    endDateRange: { from: string | null; to: string | null };
    onClearEndDateRange: () => void;
}

function FilterSummary({
    activeFilters,
    onToggleFilter,
    filterTaskName,
    onClearTaskFilter,
    searchQuery,
    onSearchChange,
    startDateRange,
    onClearStartDateRange,
    endDateRange,
    onClearEndDateRange,
}: FilterSummaryProps) {
    type ChipEntry = { key: string; label: string; onRemove: () => void };
    const chips: ChipEntry[] = [];

    if (activeFilters.has('delayed')) chips.push({ key: 'delayed', label: 'Late Tasks', onRemove: () => onToggleFilter('delayed') });
    if (activeFilters.has('critical')) chips.push({ key: 'critical', label: 'Critical Path', onRemove: () => onToggleFilter('critical') });
    if (activeFilters.has('ours')) chips.push({ key: 'ours', label: 'Our Team', onRemove: () => onToggleFilter('ours') });
    if (filterTaskName) chips.push({ key: 'task', label: `Task: ${filterTaskName}`, onRemove: onClearTaskFilter });
    if (searchQuery) chips.push({ key: 'search', label: `Search: "${searchQuery}"`, onRemove: () => onSearchChange('') });
    if (startDateRange.from || startDateRange.to)
        chips.push({
            key: 'start',
            label: `Start: ${startDateRange.from ?? '…'} – ${startDateRange.to ?? '…'}`,
            onRemove: onClearStartDateRange,
        });
    if (endDateRange.from || endDateRange.to)
        chips.push({
            key: 'finish',
            label: `Finish: ${endDateRange.from ?? '…'} – ${endDateRange.to ?? '…'}`,
            onRemove: onClearEndDateRange,
        });

    if (chips.length === 0) return null;

    const clearAll = () => chips.forEach((c) => c.onRemove());

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 border-primary/40 text-primary text-xs"
                    title={`${chips.length} filter${chips.length === 1 ? '' : 's'} active`}
                >
                    <Filter className="h-3.5 w-3.5" />
                    {chips.length} filter{chips.length === 1 ? '' : 's'}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-0">
                <div className="flex items-center justify-between border-b px-3 py-2">
                    <span className="text-xs font-medium">Active filters</span>
                    <button
                        type="button"
                        onClick={clearAll}
                        className="text-muted-foreground hover:text-foreground text-[11px] underline-offset-2 hover:underline"
                    >
                        Clear all
                    </button>
                </div>
                <ul className="max-h-[260px] overflow-auto p-2">
                    {chips.map((c) => (
                        <li key={c.key} className="hover:bg-muted flex items-center justify-between gap-2 rounded-sm px-2 py-1 text-xs">
                            <span className="truncate">{c.label}</span>
                            <button
                                type="button"
                                onClick={c.onRemove}
                                className="text-muted-foreground hover:text-foreground shrink-0"
                                aria-label={`Remove ${c.label} filter`}
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </li>
                    ))}
                </ul>
            </PopoverContent>
        </Popover>
    );
}
