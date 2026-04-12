import { Badge } from '@/components/ui/badge';
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

/**
 * Generic Kanban board — any entity with a string `status` and stable `id` can be
 * displayed as draggable cards across lanes. The caller owns rendering (`renderCard`)
 * and status persistence (`onStatusChange`) — this component only handles layout,
 * drag-and-drop wiring, and lane grouping.
 *
 * Design intentionally matches the neutral shadcn style used elsewhere
 * (see employment-applications/index.tsx for the original reference layout).
 */
export interface KanbanItem {
    id: number | string;
    status: string;
}

interface KanbanBoardProps<T extends KanbanItem> {
    items: T[];
    /** Ordered list of status keys — determines lane order left-to-right */
    statuses: string[];
    /** Human-readable label for a status key (falls back to the raw key) */
    getStatusLabel?: (status: string) => string;
    /** Cell body — called for both lane cards and the drag overlay ghost */
    renderCard: (item: T) => ReactNode;
    /** Called when a card is dropped on a different lane */
    onStatusChange: (item: T, newStatus: string) => void;
    /** Optional empty-lane message */
    emptyLaneText?: string;
}

function KanbanCard<T extends KanbanItem>({ item, renderCard }: { item: T; renderCard: (item: T) => ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: item.id,
        data: { item },
    });

    const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`bg-background rounded-md border transition-opacity ${isDragging ? 'opacity-30' : ''}`}
        >
            <div className="flex items-start gap-1 p-1.5">
                <button
                    className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0 cursor-grab touch-none active:cursor-grabbing"
                    {...attributes}
                    {...listeners}
                    tabIndex={-1}
                >
                    <GripVertical size={11} />
                </button>
                <div className="min-w-0 flex-1">{renderCard(item)}</div>
            </div>
        </div>
    );
}

function KanbanLane<T extends KanbanItem>({
    status,
    label,
    items,
    renderCard,
    emptyLaneText,
}: {
    status: string;
    label: string;
    items: T[];
    renderCard: (item: T) => ReactNode;
    emptyLaneText: string;
}) {
    const { setNodeRef, isOver } = useDroppable({ id: status });

    return (
        <div
            className={`flex min-w-0 flex-col overflow-hidden rounded-lg border transition-colors ${
                isOver ? 'bg-primary/5' : 'bg-muted/20'
            }`}
        >
            <div className="flex shrink-0 items-center justify-between border-b px-2 py-1.5">
                <span className="truncate text-xs font-semibold" title={label}>
                    {label}
                </span>
                <Badge variant="secondary" className="ml-1 h-4 shrink-0 overflow-hidden rounded-full px-1.5 text-xs leading-none">
                    {items.length}
                </Badge>
            </div>
            <div ref={setNodeRef} className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-1.5">
                {items.length === 0 ? (
                    <div className="text-muted-foreground flex h-12 items-center justify-center text-xs">{emptyLaneText}</div>
                ) : (
                    items.map((item) => <KanbanCard key={item.id} item={item} renderCard={renderCard} />)
                )}
            </div>
        </div>
    );
}

export function KanbanBoard<T extends KanbanItem>({
    items,
    statuses,
    getStatusLabel,
    renderCard,
    onStatusChange,
    emptyLaneText = 'Empty',
}: KanbanBoardProps<T>) {
    const [activeItem, setActiveItem] = useState<T | null>(null);

    const grouped = useMemo(() => {
        const map: Record<string, T[]> = {};
        statuses.forEach((s) => (map[s] = []));
        items.forEach((item) => {
            if (map[item.status] !== undefined) map[item.status].push(item);
        });
        return map;
    }, [items, statuses]);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

    const handleDragStart = (event: DragStartEvent) => {
        const item = event.active.data.current?.item as T | undefined;
        if (item) setActiveItem(item);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveItem(null);
        const { active, over } = event;
        if (!over) return;
        const newStatus = over.id as string;
        const item = active.data.current?.item as T | undefined;
        if (!item || item.status === newStatus) return;
        onStatusChange(item, newStatus);
    };

    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div
                className="grid h-full min-h-0 gap-1.5 overflow-hidden"
                style={{ gridTemplateColumns: `repeat(${statuses.length}, minmax(0, 1fr))` }}
            >
                {statuses.map((status) => (
                    <KanbanLane
                        key={status}
                        status={status}
                        label={getStatusLabel?.(status) ?? status}
                        items={grouped[status]}
                        renderCard={renderCard}
                        emptyLaneText={emptyLaneText}
                    />
                ))}
            </div>

            <DragOverlay>
                {activeItem && (
                    <div className="bg-background w-48 rotate-1 rounded-md border p-1.5 shadow-xl">{renderCard(activeItem)}</div>
                )}
            </DragOverlay>
        </DndContext>
    );
}
