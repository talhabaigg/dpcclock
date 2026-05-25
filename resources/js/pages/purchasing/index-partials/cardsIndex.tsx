'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { closestCenter, DndContext, DragEndEvent, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import RequisitionCard from './requisitionCard';
import { getStatus } from './statusConfig';
import { Requisition } from './types';

interface CardsIndexProps {
    filteredRequisitions: Requisition[];
    resetSeq?: number;
}

type StatusKey = 'pending' | 'office_review' | 'success' | 'sent';
const allStatuses: StatusKey[] = ['pending', 'office_review', 'success', 'sent'];

const SortableColumn = ({
    id,
    cards,
}: {
    id: StatusKey;
    cards: Requisition[];
}) => {
    const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id });
    const status = getStatus(id);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
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
                'bg-muted/40 flex max-w-full min-w-0 flex-col rounded-xl border transition-shadow duration-200 ease-out md:h-full md:w-full',
                isDragging && 'z-10 shadow-md ring-1 ring-foreground/5',
            )}
        >
            {/* Column Header */}
            <div className="flex shrink-0 items-center gap-2 rounded-t-xl border-b px-3 py-2.5">
                <span className="truncate text-sm font-semibold" title={status.columnLabel}>
                    {status.columnLabel}
                </span>
                <Badge
                    variant="outline"
                    className={cn(
                        'ml-auto h-5 shrink-0 rounded-full px-1.5 text-[11px] font-medium leading-none tabular-nums transition-colors',
                        bump && 'animate-count-pop',
                    )}
                >
                    {cards.length}
                </Badge>
                <Button
                    ref={setActivatorNodeRef}
                    {...attributes}
                    {...listeners}
                    variant="ghost"
                    size="icon"
                    title="Drag to reorder"
                    className="text-muted-foreground hover:text-foreground hidden h-6 w-6 cursor-grab active:cursor-grabbing md:flex"
                >
                    <GripVertical className="h-3.5 w-3.5" />
                </Button>
            </div>

            {/* Cards container */}
            <div className="max-h-[400px] min-h-0 max-w-full min-w-0 flex-1 space-y-2 overflow-x-hidden overflow-y-auto p-2 md:max-h-none">
                {cards.length === 0 ? (
                    <div className="text-muted-foreground flex h-16 items-center justify-center text-xs">
                        Empty
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

const CardsIndex = ({ filteredRequisitions, resetSeq = 0 }: CardsIndexProps) => {
    const [columnOrder, setColumnOrder] = useState<StatusKey[]>(allStatuses);

    const sensors = useSensors(useSensor(PointerSensor), useSensor(TouchSensor));

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed.order)) {
                const savedOrder = parsed.order as StatusKey[];
                const newStatuses = allStatuses.filter((s) => !savedOrder.includes(s));
                const pendingIndex = savedOrder.indexOf('pending');
                if (newStatuses.length > 0) {
                    const mergedOrder = [...savedOrder];
                    mergedOrder.splice(pendingIndex + 1, 0, ...newStatuses);
                    setColumnOrder(mergedOrder.filter((s) => allStatuses.includes(s)));
                } else {
                    setColumnOrder(savedOrder.filter((s) => allStatuses.includes(s)));
                }
            }
        }
    }, []);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ order: columnOrder }));
    }, [columnOrder]);

    // Parent toolbar can request a layout reset by bumping resetSeq.
    useEffect(() => {
        if (resetSeq > 0) {
            setColumnOrder(allStatuses);
            localStorage.removeItem(STORAGE_KEY);
        }
    }, [resetSeq]);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = columnOrder.indexOf(active.id as StatusKey);
        const newIndex = columnOrder.indexOf(over.id as StatusKey);

        setColumnOrder(arrayMove(columnOrder, oldIndex, newIndex));
    };

    return (
        <div className="flex h-auto w-full max-w-full flex-col overflow-hidden md:h-[calc(100dvh-12rem)]">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                    {/* Mobile: vertical stack, Desktop: horizontal columns */}
                    <div className="flex min-h-0 w-full max-w-full flex-1 flex-col gap-3 overflow-x-hidden md:flex-row md:gap-2">
                        {columnOrder.map((statusKey) => {
                            const cards = filteredRequisitions.filter((r) => r.status === statusKey);
                            return <SortableColumn key={statusKey} id={statusKey} cards={cards} />;
                        })}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    );
};

export default CardsIndex;
