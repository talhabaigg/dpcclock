'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { closestCenter, DndContext, DragEndEvent, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { EyeOff, GripVertical, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import RequisitionCard from './requisitionCard';
import { getStatus } from './statusConfig';
import { Requisition } from './types';

interface CardsIndexProps {
    filteredRequisitions: Requisition[];
}

type StatusKey = 'pending' | 'office_review' | 'success' | 'sent';
const allStatuses: StatusKey[] = ['pending', 'office_review', 'success', 'sent'];

const SortableColumn = ({
    id,
    cards,
    onTogglePin,
    isPinned,
    columnIndex,
}: {
    id: StatusKey;
    cards: Requisition[];
    onTogglePin: (id: StatusKey) => void;
    isPinned: boolean;
    columnIndex: number;
}) => {
    const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id });
    const status = getStatus(id);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        ['--card-index' as string]: columnIndex,
    };

    // Pulse the count badge when the card count changes
    const [bump, setBump] = useState(false);
    const prevCount = useRef(cards.length);
    useEffect(() => {
        if (prevCount.current !== cards.length) {
            setBump(true);
            prevCount.current = cards.length;
            const t = setTimeout(() => setBump(false), 320);
            return () => clearTimeout(t);
        }
    }, [cards.length]);

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                'card-enter bg-muted/20 flex max-w-full min-w-0 flex-col overflow-hidden rounded-lg border transition-shadow duration-200 ease-out md:h-full md:w-full',
                isDragging && 'z-10 shadow-md ring-1 ring-foreground/5',
            )}
        >
            {/* Column Header */}
            <div className="flex shrink-0 items-center justify-between border-b px-2 py-1.5">
                <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-xs font-semibold" title={status.columnLabel}>
                        {status.columnLabel}
                    </span>
                    <Badge
                        variant="secondary"
                        className={cn(
                            'ml-1 h-4 shrink-0 overflow-hidden rounded-full px-1.5 text-xs leading-none tabular-nums transition-colors',
                            bump && 'animate-count-pop',
                        )}
                    >
                        {cards.length}
                    </Badge>
                </div>
                <div className="flex items-center gap-0.5">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onTogglePin(id)}
                        title={isPinned ? 'Hide column' : 'Show column'}
                        className="text-muted-foreground hover:text-foreground h-6 w-6"
                    >
                        <EyeOff className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        ref={setActivatorNodeRef}
                        {...attributes}
                        {...listeners}
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground hidden h-6 w-6 cursor-grab active:cursor-grabbing md:flex"
                    >
                        <GripVertical className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* Cards container */}
            <div className="flex max-h-[400px] flex-1 flex-col gap-1.5 overflow-x-hidden overflow-y-auto p-1.5 md:max-h-none">
                {cards.length === 0 ? (
                    <div className="text-muted-foreground/70 flex h-12 items-center justify-center text-xs">
                        No requisitions
                    </div>
                ) : (
                    cards.map((requisition, i) => (
                        <RequisitionCard key={requisition.id} requisition={requisition} index={i} />
                    ))
                )}
            </div>
        </div>
    );
};

const STORAGE_KEY = 'requisition-column-settings';

const CardsIndex = ({ filteredRequisitions }: CardsIndexProps) => {
    const [columnOrder, setColumnOrder] = useState<StatusKey[]>(allStatuses);
    const [hidden, setHidden] = useState<StatusKey[]>([]); // none hidden initially

    const sensors = useSensors(useSensor(PointerSensor), useSensor(TouchSensor));

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed.order)) {
                // Merge saved order with any new statuses that weren't in saved settings
                const savedOrder = parsed.order as StatusKey[];
                const newStatuses = allStatuses.filter((s) => !savedOrder.includes(s));
                // Insert new statuses after 'pending' if it exists, otherwise at the start
                const pendingIndex = savedOrder.indexOf('pending');
                if (newStatuses.length > 0) {
                    const mergedOrder = [...savedOrder];
                    mergedOrder.splice(pendingIndex + 1, 0, ...newStatuses);
                    setColumnOrder(mergedOrder.filter((s) => allStatuses.includes(s)));
                } else {
                    setColumnOrder(savedOrder.filter((s) => allStatuses.includes(s)));
                }
            }
            if (Array.isArray(parsed.hidden)) {
                // Only keep hidden statuses that still exist
                setHidden((parsed.hidden as StatusKey[]).filter((s) => allStatuses.includes(s)));
            }
        }
    }, []);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ order: columnOrder, hidden }));
    }, [columnOrder, hidden]);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = columnOrder.indexOf(active.id as StatusKey);
        const newIndex = columnOrder.indexOf(over.id as StatusKey);

        setColumnOrder(arrayMove(columnOrder, oldIndex, newIndex));
    };

    const togglePin = (key: StatusKey) => {
        setHidden((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    };

    const resetSettings = () => {
        setColumnOrder(allStatuses);
        setHidden([]); // show all on reset
        localStorage.removeItem(STORAGE_KEY);
    };

    return (
        <div className="flex h-auto w-full max-w-full flex-col overflow-hidden md:h-[calc(100vh-280px)]">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                    {/* Mobile: vertical stack, Desktop: horizontal columns */}
                    <div className="flex min-h-0 w-full max-w-full flex-1 flex-col gap-1.5 overflow-x-hidden md:flex-row">
                        {columnOrder
                            .filter((statusKey) => !hidden.includes(statusKey))
                            .map((statusKey, i) => {
                                const cards = filteredRequisitions.filter((r) => r.status === statusKey);
                                return (
                                    <SortableColumn
                                        key={statusKey}
                                        id={statusKey}
                                        cards={cards}
                                        onTogglePin={togglePin}
                                        isPinned={!hidden.includes(statusKey)}
                                        columnIndex={i}
                                    />
                                );
                            })}
                    </div>
                </SortableContext>
            </DndContext>
            <div className="mt-3 flex shrink-0 justify-end border-t pt-3">
                <Button
                    onClick={resetSettings}
                    variant="ghost"
                    size="sm"
                    title="Reset column order and visibility"
                    className="text-muted-foreground hover:text-foreground h-7 gap-1.5 text-xs"
                >
                    <X className="h-3.5 w-3.5" />
                    Reset Layout
                </Button>
            </div>
        </div>
    );
};

export default CardsIndex;
