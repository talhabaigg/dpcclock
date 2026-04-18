import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
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
import { ArrowDownUp, CalendarDays, CalendarRange, HardHat, Link2, Maximize2, Search, X } from 'lucide-react';
import type { ColumnKey, ColumnVisibility, FilterFlag, SortMode, ZoomLevel } from './types';
import { COLUMN_LABELS, SORT_MODE_LABELS } from './types';

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
    hasFilteredTasks: boolean;
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
    hasFilteredTasks,
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
                            <MenubarItem onClick={onSetBaseline}>Save Current Plan</MenubarItem>
                            <MenubarItem onClick={onRevertToBaseline}>Restore Saved Plan</MenubarItem>
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
                                Show Saved Plan
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
                <Button
                    size="sm"
                    variant={linkMode ? 'default' : 'outline'}
                    onClick={onToggleLinkMode}
                    title="Link tasks together"
                    className="h-7 text-xs"
                >
                    <Link2 className="mr-1 h-3.5 w-3.5" />
                    Link Tasks
                </Button>

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
                        className="h-7 w-[150px] pl-6 text-xs"
                        placeholder="Search tasks..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                </div>

                {/* Active filter chips */}
                {activeFilters.has('delayed') && (
                    <span className="bg-destructive/10 text-destructive inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
                        Late Tasks
                        <button onClick={() => onToggleFilter('delayed')} className="hover:text-destructive/70">
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                )}
                {activeFilters.has('critical') && (
                    <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
                        Critical Path
                        <button onClick={() => onToggleFilter('critical')} className="hover:text-primary/70">
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                )}
                {showBaseline && (
                    <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
                        Saved Plan
                        <button onClick={onToggleBaseline} className="hover:text-foreground">
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                )}
                {linkMode && (
                    <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
                        Link Tasks On
                        <button onClick={onToggleLinkMode} className="hover:text-foreground">
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                )}
                {linkMode && <span className="text-muted-foreground text-[10px]">Click the dots on two bars to connect tasks.</span>}
                {activeFilters.has('ours') && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">
                        Our Team
                        <button onClick={() => onToggleFilter('ours')} className="hover:text-green-500/70">
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                )}
                {filterTaskName && (
                    <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
                        <span className="max-w-[100px] truncate">{filterTaskName}</span>
                        <button onClick={onClearTaskFilter} className="hover:text-primary/70">
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                )}
                {searchQuery && (
                    <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
                        &quot;{searchQuery}&quot;
                        <button onClick={() => onSearchChange('')} className="hover:text-primary/70">
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                )}
                {(startDateRange.from || startDateRange.to) && (
                    <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
                        Start: {startDateRange.from ?? '...'} – {startDateRange.to ?? '...'}
                        <button onClick={onClearStartDateRange} className="hover:text-primary/70">
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                )}
                {(endDateRange.from || endDateRange.to) && (
                    <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
                        Finish: {endDateRange.from ?? '...'} – {endDateRange.to ?? '...'}
                        <button onClick={onClearEndDateRange} className="hover:text-primary/70">
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                )}

                {/* Bulk mark — only when search active */}
                {searchQuery && hasFilteredTasks && (
                    <>
                        <Button size="sm" variant="default" onClick={onBulkMarkOwned} title="Mark all matching tasks as ours" className="h-7 text-xs">
                            <HardHat className="mr-1 h-3.5 w-3.5" />
                            Mark as Ours
                        </Button>
                        <Button size="sm" variant="outline" onClick={onBulkUnmarkOwned} title="Unmark all matching tasks" className="h-7 text-xs">
                            Unmark
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}
