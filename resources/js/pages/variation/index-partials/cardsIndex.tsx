import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { closestCenter, DndContext, DragEndEvent, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import VariationCard, { type Variation } from './variationCard';

// Canonical lane definitions
const lanes = [
    { key: 'yet2submit', label: 'Yet to Submit' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
];

const laneByKey = Object.fromEntries(lanes.map((l) => [l.key, l]));
const allLaneKeys = lanes.map((l) => l.key);

/** Normalize any raw type string to a canonical lane key */
function normalizeType(raw: string): string {
    const s = raw.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (s === 'na') return 'na';
    if (s.includes('yet') && s.includes('submit')) return 'yet2submit';
    return s;
}

const SortableColumn = ({
    id,
    label,
    count,
    cards,
    hideLocation = false,
    locationId,
}: {
    id: string;
    label: string;
    count: number;
    cards: Variation[];
    hideLocation?: boolean;
    locationId?: number | null;
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
            className="bg-muted/40 mx-0 flex max-w-full min-w-0 flex-col rounded-xl border md:h-full md:w-full"
        >
            {/* Column header */}
            <div className="flex shrink-0 items-center gap-2 rounded-t-xl border-b px-3 py-2.5">
                <span className="truncate text-sm font-semibold">{label}</span>
                <Badge variant="outline" className="ml-auto h-5 rounded-full px-1.5 text-[11px] font-medium tabular-nums">
                    {count}
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
                    cards.map((variation) => <VariationCard key={variation.id} variation={variation} hideLocation={hideLocation} locationId={locationId} />)
                )}
            </div>
        </div>
    );
};

const STORAGE_KEY = 'variation-type-column-settings-v3';

const VariationCardsIndex = ({ filteredVariations, hideLocation = false, locationId }: { filteredVariations: Variation[]; hideLocation?: boolean; locationId?: number | null }) => {
    const [columnOrder, setColumnOrder] = useState<string[]>(allLaneKeys);

    const sensors = useSensors(useSensor(PointerSensor), useSensor(TouchSensor));

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed.order)) {
                const savedOrder = parsed.order as string[];
                const newLanes = allLaneKeys.filter((k) => !savedOrder.includes(k));
                const mergedOrder = [...savedOrder, ...newLanes].filter((k) => allLaneKeys.includes(k));
                setColumnOrder(mergedOrder);
            }
        } else {
            setColumnOrder(allLaneKeys);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ order: columnOrder }));
    }, [columnOrder]);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = columnOrder.indexOf(active.id as string);
        const newIndex = columnOrder.indexOf(over.id as string);

        setColumnOrder(arrayMove(columnOrder, oldIndex, newIndex));
    };

    const resetSettings = () => {
        setColumnOrder(allLaneKeys);
        localStorage.removeItem(STORAGE_KEY);
    };

    const defaultLane = { label: '' };

    return (
        <div className="flex h-auto w-full max-w-full flex-col overflow-hidden md:h-[calc(100vh-280px)]">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                    <div className="flex min-h-0 w-full max-w-full flex-1 flex-col gap-3 overflow-x-hidden md:flex-row md:gap-2">
                        {columnOrder.map((laneKey) => {
                            const config = laneByKey[laneKey] ?? { ...defaultLane, label: laneKey };
                            const cards = filteredVariations.filter((v) => normalizeType(v.type) === laneKey);
                            return (
                                <SortableColumn
                                    key={laneKey}
                                    id={laneKey}
                                    label={config.label}
                                    count={cards.length}
                                    cards={cards}
                                    hideLocation={hideLocation}
                                    locationId={locationId}
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
                    title="Reset column order"
                    className="h-7 gap-1.5 text-xs text-muted-foreground"
                >
                    <X className="h-3.5 w-3.5" />
                    Reset Layout
                </Button>
            </div>
        </div>
    );
};

export default VariationCardsIndex;
