'use client';

import { Button } from '@/components/ui/button';
import { closestCenter, DndContext, DragEndEvent, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Building, EyeOff, GripVertical, Hourglass, Loader, Truck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import RequisitionCard from './requisitionCard';
import { Requisition } from './types';

interface CardsIndexProps {
    filteredRequisitions: Requisition[];
}

const statusMap = {
    pending: { label: 'Pending', icon: <Loader className="h-4 w-4" /> },
    office_review: { label: 'Waiting for Review', icon: <Building className="h-4 w-4" /> },
    success: { label: 'Awaiting', icon: <Hourglass className="h-4 w-4" /> },
    sent: { label: 'Sent', icon: <Truck className="h-4 w-4" /> },
};

type StatusKey = keyof typeof statusMap;
const allStatuses: StatusKey[] = ['pending', 'office_review', 'success', 'sent'];

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
        <div
            ref={setNodeRef}
            style={style}
            className="dark:bg-card/80 mx-0 flex max-w-full min-w-0 flex-col rounded-lg bg-slate-100/50 md:mx-1 md:h-full md:w-full"
        >
            {/* Column Header */}
            <div className="dark:bg-muted/30 flex shrink-0 items-center justify-between rounded-t-lg bg-slate-100 px-3 py-2.5 md:py-2">
                <div className="flex items-center gap-2">
                    <span className="text-slate-500 dark:text-slate-400">{icon}</span>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</span>
                    <span className="dark:bg-muted rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                        {count}
                    </span>
                </div>
                <div className="flex items-center">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onTogglePin(id as StatusKey)}
                        title={isPinned ? 'Hide column' : 'Show column'}
                        className="h-8 w-8 rounded text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 md:h-7 md:w-7 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    >
                        <EyeOff className="h-4 w-4" />
                    </Button>
                    <Button
                        ref={setActivatorNodeRef}
                        {...attributes}
                        {...listeners}
                        variant="ghost"
                        size="sm"
                        className="hidden h-7 w-7 cursor-grab rounded text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 active:cursor-grabbing md:flex dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    >
                        <GripVertical className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Cards container - scrollable on desktop, max-height on mobile */}
            <div className="max-h-[400px] min-h-0 max-w-full min-w-0 flex-1 space-y-2 overflow-x-hidden overflow-y-auto p-2 md:max-h-none">
                {cards.length === 0 ? (
                    <div className="dark:border-border rounded-lg border-2 border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                        No requisitions
                    </div>
                ) : (
                    cards.map((requisition) => <RequisitionCard key={requisition.id} requisition={requisition} />)
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
                    {/* Mobile: vertical stack with collapsible sections, Desktop: horizontal columns */}
                    <div className="flex min-h-0 w-full max-w-full flex-1 flex-col gap-3 overflow-x-hidden md:flex-row md:gap-2">
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
            <div className="dark:border-border mt-3 flex shrink-0 justify-end border-t border-slate-200 pt-3">
                <Button
                    onClick={resetSettings}
                    variant="ghost"
                    size="sm"
                    title="Reset column order and visibility"
                    className="h-7 gap-1.5 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                    <X className="h-3.5 w-3.5" />
                    Reset Layout
                </Button>
            </div>
        </div>
    );
};

export default CardsIndex;
