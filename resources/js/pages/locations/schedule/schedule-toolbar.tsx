import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
import { CalendarDays, CalendarRange, FileText, Filter, ListChecks, Maximize2, Search, X } from 'lucide-react';
import type { ColumnKey, ColumnVisibility, FilterFlag, TaskStatus, ZoomLevel } from './types';
import { COLUMN_LABELS, MANUAL_STATUSES, PRESET_COLORS, STATUS_LABELS } from './types';

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
    onImport: () => void;
    onBulkMarkOwned: () => void;
    onBulkUnmarkOwned: () => void;
    onBulkSetResponsible: (value: string | null) => void;
    onBulkSetStatus: (status: TaskStatus | null) => void;
    onBulkSetColor: (color: string | null) => void;
    responsibleOptions: string[];
    filteredTaskCount: number;
    hasActiveFilter: boolean;
    startDateRange: { from: string | null; to: string | null };
    onClearStartDateRange: () => void;
    endDateRange: { from: string | null; to: string | null };
    onClearEndDateRange: () => void;
    importButton?: React.ReactNode;
    calendarHref?: string;
    reportHref?: string;
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
    onImport,
    onBulkMarkOwned,
    onBulkUnmarkOwned,
    onBulkSetResponsible,
    onBulkSetStatus,
    onBulkSetColor,
    responsibleOptions,
    filteredTaskCount,
    hasActiveFilter,
    startDateRange,
    onClearStartDateRange,
    endDateRange,
    onClearEndDateRange,
    importButton,
    calendarHref,
    reportHref,
    visibleColumns,
    onToggleColumn,
}: ScheduleToolbarProps) {
    const columnKeys: ColumnKey[] = ['start', 'finish', 'days', 'responsible', 'status'];

    // Local input state keeps typing responsive — only the debounced value is lifted to the parent.
    const [searchInput, setSearchInput] = useState(searchQuery);
    useEffect(() => {
        // Sync down: if the parent clears search (e.g. chip removed), reflect it here.
        if (searchQuery !== searchInput) setSearchInput(searchQuery);
         
    }, [searchQuery]);
    useEffect(() => {
        if (searchInput === searchQuery) return;
        const handle = setTimeout(() => onSearchChange(searchInput), 250);
        return () => clearTimeout(handle);
    }, [searchInput, searchQuery, onSearchChange]);
    const searchPending = searchInput !== searchQuery;
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

                <div className="ml-auto flex items-center gap-1">
                    {calendarHref && (
                        <Button asChild size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground h-7 gap-1.5 text-xs">
                            <Link href={calendarHref}>
                                <CalendarRange className="h-3.5 w-3.5" />
                                Project Calendar
                            </Link>
                        </Button>
                    )}
                    {reportHref && (
                        <Button asChild size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground h-7 gap-1.5 text-xs">
                            <Link href={reportHref}>
                                <FileText className="h-3.5 w-3.5" />
                                Variance Report
                            </Link>
                        </Button>
                    )}
                    {importButton}
                </div>
            </div>

            {/* Action toolbar row */}
            <div className="flex flex-wrap items-center gap-2 border-b px-3 py-1.5">
                {/* Zoom presets */}
                <div className="inline-flex h-7 items-center overflow-hidden rounded-md border">
                    {VIEW_OPTIONS.map((opt, i) => (
                        <button
                            key={opt.key}
                            onClick={() => onZoomChange(opt.key)}
                            className={cn(
                                'px-2.5 text-xs font-medium transition-colors h-full',
                                i > 0 && 'border-l',
                                zoom === opt.key ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
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

                <div className="bg-border mx-1 h-4 w-px" />

                {/* Search */}
                <div className="relative">
                    <Search
                        className={cn(
                            'text-muted-foreground absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2 transition-opacity duration-150',
                            searchPending && 'opacity-0',
                        )}
                        aria-hidden
                    />
                    <span
                        className={cn(
                            'border-muted-foreground/30 border-t-foreground absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2 animate-spin rounded-full border transition-opacity duration-150',
                            searchPending ? 'opacity-100' : 'opacity-0',
                        )}
                        aria-hidden
                    />
                    <Input
                        id="schedule-search-input"
                        className="h-7 w-[150px] pl-6 text-xs"
                        placeholder="Search tasks… (F)"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
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
                    <span className="text-muted-foreground border-muted-foreground/30 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]">
                        Baseline overlay
                        <button onClick={onToggleBaseline} className="hover:text-foreground -mr-1" aria-label="Hide baseline">
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                )}

                {hasActiveFilter && filteredTaskCount > 0 && (
                    <BulkMenu
                        count={filteredTaskCount}
                        responsibleOptions={responsibleOptions}
                        onMarkOwned={onBulkMarkOwned}
                        onUnmark={onBulkUnmarkOwned}
                        onSetResponsible={onBulkSetResponsible}
                        onSetStatus={onBulkSetStatus}
                        onSetColor={onBulkSetColor}
                    />
                )}

            </div>
        </div>
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

interface BulkMenuProps {
    count: number;
    responsibleOptions: string[];
    onMarkOwned: () => void;
    onUnmark: () => void;
    onSetResponsible: (value: string | null) => void;
    onSetStatus: (status: TaskStatus | null) => void;
    onSetColor: (color: string | null) => void;
}

function BulkMenu({ count, responsibleOptions, onMarkOwned, onUnmark, onSetResponsible, onSetStatus, onSetColor }: BulkMenuProps) {
    const noun = `${count} task${count === 1 ? '' : 's'}`;
    const confirmAndRun = (label: string, fn: () => void) => {
        if (window.confirm(`${label} on ${noun}?`)) fn();
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-px hover:shadow-sm active:translate-y-0"
                    title="Bulk edit visible tasks"
                >
                    <ListChecks className="mr-1 h-3.5 w-3.5" />
                    Bulk edit
                    <span key={count} className="text-muted-foreground ml-1 inline-block tabular-nums duration-200 animate-in fade-in-50 slide-in-from-top-0.5 motion-reduce:animate-none">
                        · {count}
                    </span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <div className="text-muted-foreground px-2 py-1 text-[10px]">Acting on {noun}</div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => confirmAndRun('Mark as Ours', onMarkOwned)}>Mark as Ours</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => confirmAndRun('Unmark', onUnmark)}>Unmark</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Set Responsible…</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-[280px] overflow-y-auto">
                        {responsibleOptions.length === 0 && (
                            <div className="text-muted-foreground px-2 py-1 text-[10px]">No existing responsibles</div>
                        )}
                        {responsibleOptions.map((opt) => (
                            <DropdownMenuItem key={opt} onSelect={() => confirmAndRun(`Set Responsible to "${opt}"`, () => onSetResponsible(opt))}>
                                {opt}
                            </DropdownMenuItem>
                        ))}
                        {responsibleOptions.length > 0 && <DropdownMenuSeparator />}
                        <DropdownMenuItem
                            className="text-muted-foreground"
                            onSelect={() => confirmAndRun('Clear Responsible', () => onSetResponsible(null))}
                        >
                            Clear
                        </DropdownMenuItem>
                    </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Set Status…</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                        {MANUAL_STATUSES.map((s) => (
                            <DropdownMenuItem key={s} onSelect={() => confirmAndRun(`Set Status to "${STATUS_LABELS[s]}"`, () => onSetStatus(s))}>
                                {STATUS_LABELS[s]}
                            </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-muted-foreground" onSelect={() => confirmAndRun('Clear Status', () => onSetStatus(null))}>
                            Clear
                        </DropdownMenuItem>
                    </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Set Colour…</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="p-2">
                        <div className="flex flex-wrap gap-1.5">
                            <button
                                type="button"
                                className="bg-primary h-6 w-6 rounded-full border-2 border-transparent transition-transform hover:scale-110"
                                onClick={() => confirmAndRun('Set bar colour to default', () => onSetColor(null))}
                                title="Default"
                            />
                            {PRESET_COLORS.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    className="h-6 w-6 rounded-full border-2 border-transparent transition-transform hover:scale-110"
                                    style={{ backgroundColor: c }}
                                    onClick={() => confirmAndRun(`Set bar colour to ${c}`, () => onSetColor(c))}
                                    title={c}
                                />
                            ))}
                        </div>
                    </DropdownMenuSubContent>
                </DropdownMenuSub>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
