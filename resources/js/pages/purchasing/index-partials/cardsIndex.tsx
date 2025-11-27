'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { closestCenter, DndContext, DragEndEvent, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { EyeOff, GripVertical, Hourglass, Loader, Truck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import RequisitionCard from './requisitionCard';
import { Requisition } from './types';

interface CardsIndexProps {
    filteredRequisitions: Requisition[];
}

const statusMap = {
    pending: { label: 'Pending', icon: <Loader /> },
    success: { label: 'Waiting in Premier', icon: <Hourglass /> },
    sent: { label: 'Sent to Supplier', icon: <Truck /> },
};

type StatusKey = keyof typeof statusMap;
const allStatuses: StatusKey[] = ['pending', 'success', 'sent'];

const SortableColumn = ({
    id,
    label,
    count,
    icon,
    cards,
    onTogglePin,
    isPinned,
}: {
    id: string;
    label: string;
    icon: React.ReactNode;
    count: number;
    cards: Requisition[];
    onTogglePin: (id: StatusKey) => void;
    isPinned: boolean;
}) => {
    const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className="mx-1 w-full rounded-md border p-1">
            <div className="mb-2 flex items-center justify-between">
                <Badge className="flex items-center gap-1">
                    {icon} {label}
                </Badge>

                <div className="flex items-center gap-1">
                    <Badge>{count}</Badge>
                    <Button variant="ghost" size="icon" onClick={() => onTogglePin(id as StatusKey)} title={isPinned ? 'Hide' : 'Pin'}>
                        <EyeOff className={`h-4 w-4 ${isPinned ? 'text-primary' : 'text-muted-foreground'}`} />
                    </Button>
                    <Button ref={setActivatorNodeRef} {...attributes} {...listeners} variant="ghost" size="icon" className="cursor-grab">
                        <GripVertical className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="space-y-2">
                {cards.map((requisition) => (
                    <RequisitionCard key={requisition.id} requisition={requisition} />
                ))}
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
            if (Array.isArray(parsed.order)) setColumnOrder(parsed.order);
            if (Array.isArray(parsed.hidden)) setHidden(parsed.hidden);
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
        <>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                    <div className="flex w-full flex-row">
                        {columnOrder
                            .filter((statusKey) => !hidden.includes(statusKey))
                            .map((statusKey) => {
                                const { label, icon } = statusMap[statusKey];
                                const cards = filteredRequisitions.filter((r) => r.status === statusKey);
                                const count = filteredRequisitions.filter((r) => r.status === statusKey).length;
                                return (
                                    <SortableColumn
                                        key={statusKey}
                                        id={statusKey}
                                        label={label}
                                        count={count}
                                        icon={icon}
                                        cards={cards}
                                        onTogglePin={togglePin}
                                        isPinned={!hidden.includes(statusKey)} // visible means pinned
                                    />
                                );
                            })}
                    </div>
                </SortableContext>
            </DndContext>
            <div className="mt-4 flex justify-end">
                <Button onClick={resetSettings} variant="ghost" title="Reset layout">
                    <X />
                </Button>
            </div>
        </>
    );
};

export default CardsIndex;
