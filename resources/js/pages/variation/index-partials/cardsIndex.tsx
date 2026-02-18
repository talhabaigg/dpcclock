import { Button } from '@/components/ui/button';
import { closestCenter, DndContext, DragEndEvent, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, CheckCircle, EyeOff, GripVertical, Hammer, HelpCircle, RefreshCw, Send, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import VariationCard, { type Variation } from './variationCard';

// Canonical lane definitions
const lanes = [
    { key: 'dayworks', label: 'Dayworks', icon: <Hammer className="h-3.5 w-3.5" />, color: 'bg-blue-500' },
    { key: 'variations', label: 'Variations', icon: <RefreshCw className="h-3.5 w-3.5" />, color: 'bg-violet-500' },
    { key: 'na', label: 'N/A', icon: <HelpCircle className="h-3.5 w-3.5" />, color: 'bg-yellow-500' },
    { key: 'approved', label: 'Approved', icon: <CheckCircle className="h-3.5 w-3.5" />, color: 'bg-emerald-500' },
    { key: 'poa', label: 'POA', icon: <AlertTriangle className="h-3.5 w-3.5" />, color: 'bg-orange-500' },
    { key: 'yet2submit', label: 'Yet to Submit', icon: <Send className="h-3.5 w-3.5" />, color: 'bg-slate-400' },
    { key: 'client', label: 'Client', icon: <Users className="h-3.5 w-3.5" />, color: 'bg-slate-400' },
];

const laneByKey = Object.fromEntries(lanes.map((l) => [l.key, l]));
const allLaneKeys = lanes.map((l) => l.key);

/** Normalize any raw type string to a canonical lane key */
function normalizeType(raw: string): string {
    const s = raw.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    // "na", "n/a", "n a" → "na"
    if (s === 'na') return 'na';
    // "yet 2 submit", "yet2submit", "YET2SUBMIT" → "yet2submit"
    if (s.includes('yet') && s.includes('submit')) return 'yet2submit';
    // everything else: "dayworks", "variations", "approved", "poa", "client"
    return s;
}

const SortableColumn = ({
    id,
    label,
    count,
    icon,
    accentColor,
    cards,
    onTogglePin,
    isPinned,
}: {
    id: string;
    label: string;
    icon: React.ReactNode;
    accentColor: string;
    count: number;
    cards: Variation[];
    onTogglePin: (id: string) => void;
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
            className="mx-0 flex max-w-full min-w-0 flex-col rounded-lg border bg-muted/30 md:mx-1 md:h-full md:w-full"
        >
            {/* Column Header */}
            <div className="flex shrink-0 items-center justify-between rounded-t-lg border-b bg-muted/50 px-3 py-2.5 md:py-2">
                <div className="flex items-center gap-2">
                    <div className={`flex h-6 w-6 items-center justify-center rounded ${accentColor} text-white`}>
                        {icon}
                    </div>
                    <span className="text-sm font-semibold">{label}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
                        {count}
                    </span>
                </div>
                <div className="flex items-center">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onTogglePin(id)}
                        title={isPinned ? 'Hide column' : 'Show column'}
                        className="h-8 w-8 rounded text-muted-foreground md:h-7 md:w-7"
                    >
                        <EyeOff className="h-4 w-4" />
                    </Button>
                    <Button
                        ref={setActivatorNodeRef}
                        {...attributes}
                        {...listeners}
                        variant="ghost"
                        size="sm"
                        className="hidden h-7 w-7 cursor-grab rounded text-muted-foreground active:cursor-grabbing md:flex"
                    >
                        <GripVertical className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Cards container */}
            <div className="max-h-[400px] min-h-0 max-w-full min-w-0 flex-1 space-y-2 overflow-x-hidden overflow-y-auto p-2 md:max-h-none">
                {cards.length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed p-4 text-center text-xs text-muted-foreground">
                        No variations
                    </div>
                ) : (
                    cards.map((variation) => <VariationCard key={variation.id} variation={variation} />)
                )}
            </div>
        </div>
    );
};

const STORAGE_KEY = 'variation-type-column-settings';

const VariationCardsIndex = ({ filteredVariations }: { filteredVariations: Variation[] }) => {
    const [columnOrder, setColumnOrder] = useState<string[]>(allLaneKeys);
    const [hidden, setHidden] = useState<string[]>([]);

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
            if (Array.isArray(parsed.hidden)) {
                setHidden(parsed.hidden.filter((k: string) => allLaneKeys.includes(k)));
            }
        } else {
            setColumnOrder(allLaneKeys);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ order: columnOrder, hidden }));
    }, [columnOrder, hidden]);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = columnOrder.indexOf(active.id as string);
        const newIndex = columnOrder.indexOf(over.id as string);

        setColumnOrder(arrayMove(columnOrder, oldIndex, newIndex));
    };

    const togglePin = (key: string) => {
        setHidden((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    };

    const resetSettings = () => {
        setColumnOrder(allLaneKeys);
        setHidden([]);
        localStorage.removeItem(STORAGE_KEY);
    };

    const defaultLane = { label: '', icon: <RefreshCw className="h-3.5 w-3.5" />, color: 'bg-slate-500' };

    return (
        <div className="flex h-auto w-full max-w-full flex-col overflow-hidden md:h-[calc(100vh-280px)]">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                    <div className="flex min-h-0 w-full max-w-full flex-1 flex-col gap-3 overflow-x-hidden md:flex-row md:gap-2">
                        {columnOrder
                            .filter((laneKey) => !hidden.includes(laneKey))
                            .map((laneKey) => {
                                const config = laneByKey[laneKey] ?? { ...defaultLane, label: laneKey };
                                const cards = filteredVariations.filter((v) => normalizeType(v.type) === laneKey);
                                return (
                                    <SortableColumn
                                        key={laneKey}
                                        id={laneKey}
                                        label={config.label}
                                        count={cards.length}
                                        icon={config.icon}
                                        accentColor={config.color}
                                        cards={cards}
                                        onTogglePin={togglePin}
                                        isPinned={!hidden.includes(laneKey)}
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