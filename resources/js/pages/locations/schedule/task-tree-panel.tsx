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

export default function TaskTreePanel({ visibleTasks, expanded, onToggle, onAddChild, onDelete, onRename, showBaseline }: TaskTreePanelProps) {
    return (
        <div className="shrink-0 overflow-hidden" style={{ width: 400 }}>
            {/* Header */}
            <div className="bg-muted/50 flex items-center border-b px-3 font-medium" style={{ height: ROW_HEIGHT }}>
                <span className="text-sm">Task Name</span>
            </div>
            {/* Secondary header row to match Gantt month row */}
            <div className="bg-muted/30 border-b" style={{ height: 24 }} />

            {/* Rows */}
            <div>
                {visibleTasks.length === 0 && (
                    <div className="text-muted-foreground flex items-center justify-center py-12 text-sm">
                        No tasks yet. Click "Add Task" to begin.
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
}
