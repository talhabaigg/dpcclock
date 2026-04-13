import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Menubar,
    MenubarCheckboxItem,
    MenubarContent,
    MenubarItem,
    MenubarMenu,
    MenubarSeparator,
    MenubarTrigger,
} from '@/components/ui/menubar';
import { cn } from '@/lib/utils';
import { CalendarDays, HardHat, Maximize2, Search, X } from 'lucide-react';
import type { FilterFlag, ZoomLevel } from './types';

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
    startDateRange: { from: string | null; to: string | null };
    onClearStartDateRange: () => void;
    endDateRange: { from: string | null; to: string | null };
    onClearEndDateRange: () => void;
    importButton?: React.ReactNode;
}

const VIEW_OPTIONS: { key: ZoomLevel; label: string }[] = [
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'quarter', label: 'Quarter' },
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
    startDateRange,
    onClearStartDateRange,
    endDateRange,
    onClearEndDateRange,
    importButton,
}: ScheduleToolbarProps) {
    return (
        <div className="flex flex-col">
            {/* Menu bar row */}
            <div className="flex items-center gap-2 border-b px-3 py-1">
                <Menubar className="border-none shadow-none bg-transparent h-auto p-0 gap-0">
                    {/* File menu */}
                    <MenubarMenu>
                        <MenubarTrigger className="text-xs px-2 py-1">File</MenubarTrigger>
                        <MenubarContent>
                            <MenubarItem onClick={onImport}>
                                Import
                            </MenubarItem>
                            <MenubarItem onClick={onDownloadTemplate}>
                                Download Template
                            </MenubarItem>
                            <MenubarSeparator />
                            <MenubarItem onClick={onExportMsProject}>
                                Export to MS Project
                            </MenubarItem>
                        </MenubarContent>
                    </MenubarMenu>

                    {/* Tasks menu */}
                    <MenubarMenu>
                        <MenubarTrigger className="text-xs px-2 py-1">Tasks</MenubarTrigger>
                        <MenubarContent>
                            <MenubarItem onClick={onAddTask}>
                                Add Task
                            </MenubarItem>
                            <MenubarItem onClick={onSetBaseline}>
                                Set Baseline
                            </MenubarItem>
                            <MenubarItem onClick={onRevertToBaseline}>
                                Revert to Baseline
                            </MenubarItem>
                            <MenubarSeparator />
                            <MenubarItem
                                className="text-destructive focus:text-destructive"
                                onClick={onClearAll}
                            >
                                Delete All Tasks
                            </MenubarItem>
                        </MenubarContent>
                    </MenubarMenu>

                    {/* View menu */}
                    <MenubarMenu>
                        <MenubarTrigger className="text-xs px-2 py-1">View</MenubarTrigger>
                        <MenubarContent>
                            <MenubarCheckboxItem
                                checked={linkMode}
                                onCheckedChange={onToggleLinkMode}
                            >
                                Link Mode
                            </MenubarCheckboxItem>
                            <MenubarCheckboxItem
                                checked={showBaseline}
                                onCheckedChange={onToggleBaseline}
                            >
                                Show Baseline
                            </MenubarCheckboxItem>
                            <MenubarSeparator />
                            <MenubarItem inset onClick={onExpandAll}>
                                Expand All Tasks
                            </MenubarItem>
                            <MenubarItem inset onClick={onCollapseAll}>
                                Collapse All Tasks
                            </MenubarItem>
                            <MenubarSeparator />
                            <MenubarCheckboxItem
                                checked={activeFilters.has('delayed')}
                                onCheckedChange={() => onToggleFilter('delayed')}
                            >
                                Show Delayed
                            </MenubarCheckboxItem>
                            <MenubarCheckboxItem
                                checked={activeFilters.has('critical')}
                                onCheckedChange={() => onToggleFilter('critical')}
                            >
                                Show Critical
                            </MenubarCheckboxItem>
                            <MenubarCheckboxItem
                                checked={activeFilters.has('ours')}
                                onCheckedChange={() => onToggleFilter('ours')}
                            >
                                Show Our Tasks
                            </MenubarCheckboxItem>
                        </MenubarContent>
                    </MenubarMenu>
                </Menubar>

                {/* Import dialog (hidden, triggered via File > Import menu item) */}
                <div className="ml-auto">
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

                <div className="mx-1 h-4 w-px bg-border" />

                {/* Search */}
                <div className="relative">
                    <Search className="text-muted-foreground absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2" />
                    <Input
                        className="h-7 w-[150px] pl-6 text-xs"
                        placeholder="Search tasks..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                </div>

                {/* Active filter chips */}
                {activeFilters.has('delayed') && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                        Delayed
                        <button onClick={() => onToggleFilter('delayed')} className="hover:text-destructive/70">
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                )}
                {activeFilters.has('critical') && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        Critical
                        <button onClick={() => onToggleFilter('critical')} className="hover:text-primary/70">
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                )}
                {showBaseline && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Baseline
                        <button onClick={onToggleBaseline} className="hover:text-foreground">
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                )}
                {linkMode && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Link Mode
                        <button onClick={onToggleLinkMode} className="hover:text-foreground">
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                )}
                {activeFilters.has('ours') && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">
                        Ours
                        <button onClick={() => onToggleFilter('ours')} className="hover:text-green-500/70">
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                )}
                {filterTaskName && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        <span className="max-w-[100px] truncate">{filterTaskName}</span>
                        <button onClick={onClearTaskFilter} className="hover:text-primary/70">
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                )}
                {searchQuery && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        &quot;{searchQuery}&quot;
                        <button onClick={() => onSearchChange('')} className="hover:text-primary/70">
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                )}
                {(startDateRange.from || startDateRange.to) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        Start: {startDateRange.from ?? '...'} – {startDateRange.to ?? '...'}
                        <button onClick={onClearStartDateRange} className="hover:text-primary/70">
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                )}
                {(endDateRange.from || endDateRange.to) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        Finish: {endDateRange.from ?? '...'} – {endDateRange.to ?? '...'}
                        <button onClick={onClearEndDateRange} className="hover:text-primary/70">
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                )}

                {/* Bulk mark — only when search active */}
                {searchQuery && hasFilteredTasks && (
                    <>
                        <Button
                            size="sm"
                            variant="default"
                            onClick={onBulkMarkOwned}
                            title="Mark all matching tasks as ours"
                            className="h-7 text-xs"
                        >
                            <HardHat className="mr-1 h-3.5 w-3.5" />
                            Mark as Ours
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={onBulkUnmarkOwned}
                            title="Unmark all matching tasks"
                            className="h-7 text-xs"
                        >
                            Unmark
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}
