import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { AlertTriangle, CalendarDays, ChevronsDownUp, ChevronsUpDown, GitCompareArrows, Link2, Maximize2, Plus, Route } from 'lucide-react';
import type { FilterMode, TaskNode, ZoomLevel } from './types';

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
    filterMode: FilterMode;
    onFilterModeChange: (mode: FilterMode) => void;
    filterTaskId: number | null;
    onFilterTaskChange: (taskId: number | null) => void;
    rootTasks: TaskNode[];
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
    filterMode,
    onFilterModeChange,
    filterTaskId,
    onFilterTaskChange,
    rootTasks,
}: ScheduleToolbarProps) {
    // Flatten all tasks for the task filter dropdown
    const allFilterOptions: { id: number; name: string; depth: number }[] = [];
    function collectTasks(nodes: TaskNode[], depth: number) {
        for (const n of nodes) {
            allFilterOptions.push({ id: n.id, name: n.name, depth });
            collectTasks(n.childNodes, depth + 1);
        }
    }
    collectTasks(rootTasks, 0);

    return (
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
            <Button size="sm" onClick={onAddTask}>
                <Plus className="mr-1 h-4 w-4" />
                Add Task
            </Button>

            <Button
                size="icon"
                variant={linkMode ? 'default' : 'outline'}
                onClick={onToggleLinkMode}
                title={linkMode ? 'Exit link mode' : 'Link tasks'}
                className="h-8 w-8"
            >
                <Link2 className="h-4 w-4" />
            </Button>

            <Button
                size="icon"
                variant={showBaseline ? 'default' : 'outline'}
                onClick={onToggleBaseline}
                title={showBaseline ? 'Hide baseline' : 'Show baseline'}
                className="h-8 w-8"
            >
                <GitCompareArrows className="h-4 w-4" />
            </Button>

            <div className="mx-1 h-5 w-px bg-border" />

            <Button size="sm" variant="outline" onClick={onExpandAll} title="Expand all" className="h-8 w-8 p-0">
                <ChevronsUpDown className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={onCollapseAll} title="Collapse all" className="h-8 w-8 p-0">
                <ChevronsDownUp className="h-4 w-4" />
            </Button>

            <div className="mx-1 h-5 w-px bg-border" />

            {/* View presets */}
            <div className="bg-muted inline-flex items-center rounded-md p-0.5">
                {VIEW_OPTIONS.map((opt) => (
                    <button
                        key={opt.key}
                        onClick={() => onZoomChange(opt.key)}
                        className={cn(
                            'rounded-sm px-3 py-1 text-xs font-medium transition-colors',
                            zoom === opt.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            <div className="mx-1 h-5 w-px bg-border" />

            <Button size="sm" variant="outline" onClick={onGoToToday} title="Go to today">
                <CalendarDays className="mr-1 h-4 w-4" />
                Today
            </Button>
            <Button size="sm" variant="outline" onClick={onAutoFit} title="Auto-fit">
                <Maximize2 className="h-4 w-4" />
            </Button>

            <div className="mx-1 h-5 w-px bg-border" />

            {/* Filters */}
            <Button
                size="sm"
                variant={filterMode === 'delayed' ? 'destructive' : 'outline'}
                onClick={() => onFilterModeChange(filterMode === 'delayed' ? 'all' : 'delayed')}
                title="Show delayed tasks"
            >
                <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                Delayed
            </Button>

            <Button
                size="sm"
                variant={filterMode === 'critical' ? 'default' : 'outline'}
                onClick={() => onFilterModeChange(filterMode === 'critical' ? 'all' : 'critical')}
                title="Show critical path"
            >
                <Route className="mr-1 h-3.5 w-3.5" />
                Critical
            </Button>

            {/* Task filter */}
            <Select
                value={filterTaskId?.toString() ?? '__all__'}
                onValueChange={(v) => onFilterTaskChange(v === '__all__' ? null : Number(v))}
            >
                <SelectTrigger className="h-8 w-[180px] text-xs">
                    <SelectValue placeholder="Filter by task..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="__all__" className="text-xs">All Tasks</SelectItem>
                    {allFilterOptions.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id.toString()} className="text-xs">
                            {'─'.repeat(opt.depth)} {opt.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
