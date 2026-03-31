import { forwardRef } from 'react';
import type { TaskNode } from './types';
import { ROW_HEIGHT } from './types';
import TaskTreeRow from './task-tree-row';

interface TaskTreePanelProps {
    visibleTasks: TaskNode[];
    expanded: Set<number>;
    onToggle: (id: number) => void;
    onAddChild: (parentId: number, parentName: string) => void;
    onDelete: (id: number) => void;
    onRename: (id: number, name: string) => void;
    showBaseline: boolean;
}

const TaskTreePanel = forwardRef<HTMLDivElement, TaskTreePanelProps>(
    ({ visibleTasks, expanded, onToggle, onAddChild, onDelete, onRename, showBaseline }, ref) => {
        return (
            <div className="flex shrink-0 flex-col" style={{ width: 400 }}>
                {/* Header — fixed */}
                <div className="bg-muted/50 flex items-center border-b px-3 font-medium" style={{ height: ROW_HEIGHT }}>
                    <span className="text-sm">Task Name</span>
                </div>
                <div className="bg-muted/30 border-b" style={{ height: 24 }} />

                {/* Scrollable rows — synced with gantt */}
                <div ref={ref} className="flex-1 overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: 'none' }}>
                    {visibleTasks.length === 0 && (
                        <div className="text-muted-foreground flex items-center justify-center py-12 text-sm">
                            No tasks yet. Click &quot;Add Task&quot; to begin.
                        </div>
                    )}
                    {visibleTasks.map((node) => (
                        <TaskTreeRow
                            key={node.id}
                            node={node}
                            isExpanded={expanded.has(node.id)}
                            onToggle={onToggle}
                            onAddChild={onAddChild}
                            onDelete={onDelete}
                            onRename={onRename}
                            showBaseline={showBaseline}
                        />
                    ))}
                </div>
            </div>
        );
    },
);

TaskTreePanel.displayName = 'TaskTreePanel';

export default TaskTreePanel;
