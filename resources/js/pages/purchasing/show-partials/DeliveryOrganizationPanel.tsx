import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { router } from '@inertiajs/react';
import { ChevronDown, ChevronRight, ChevronUp, GripVertical, Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
    DndContext,
    DragOverlay,
    closestCorners,
    type DragEndEvent,
    type DragStartEvent,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type LineItem = {
    id: number;
    code: string;
    description: string;
    qty: number;
    unit_cost: number;
    total_cost: number;
    serial_number: number;
    deliver_to?: string | null;
};

type DeliveryGroup = {
    name: string;
    items: LineItem[];
    isExpanded: boolean;
};

export function DeliveryOrganizationPanel({
    requisitionId,
    lineItems,
}: {
    requisitionId: number;
    lineItems: LineItem[];
}) {
    // Initialize groups from existing deliver_to values, ordered by min serial_number
    const [groups, setGroups] = useState<DeliveryGroup[]>(() => {
        const grouped = new Map<string, LineItem[]>();

        for (const item of lineItems) {
            const groupName = item.deliver_to || 'Ungrouped';
            if (!grouped.has(groupName)) {
                grouped.set(groupName, []);
            }
            grouped.get(groupName)!.push(item);
        }

        // Sort groups by minimum serial_number of items
        return Array.from(grouped.entries())
            .map(([name, items]) => ({
                name,
                items: items.sort((a, b) => a.serial_number - b.serial_number),
                isExpanded: true,
            }))
            .sort((a, b) => {
                const minA = Math.min(...a.items.map((i) => i.serial_number));
                const minB = Math.min(...b.items.map((i) => i.serial_number));
                return minA - minB;
            });
    });

    const [newGroupName, setNewGroupName] = useState('');
    const [activeId, setActiveId] = useState<number | string | null>(null);
    const [activeType, setActiveType] = useState<'group' | 'item' | null>(null);
    const [saving, setSaving] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
    const [lastSelectedId, setLastSelectedId] = useState<number | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const handleAddGroup = () => {
        if (!newGroupName.trim()) {
            toast.error('Please enter a group name');
            return;
        }

        if (groups.some((g) => g.name === newGroupName)) {
            toast.error('Group already exists');
            return;
        }

        setGroups([...groups, { name: newGroupName, items: [], isExpanded: true }]);
        setNewGroupName('');
    };

    const handleDeleteGroup = (groupName: string) => {
        if (groupName === 'Ungrouped') {
            toast.error('Cannot delete Ungrouped group');
            return;
        }

        const group = groups.find((g) => g.name === groupName);
        if (group && group.items.length > 0) {
            const ungrouped = groups.find((g) => g.name === 'Ungrouped');
            if (ungrouped) {
                ungrouped.items.push(...group.items);
            } else {
                setGroups([...groups.filter((g) => g.name !== groupName), { name: 'Ungrouped', items: group.items, isExpanded: true }]);
                return;
            }
        }

        setGroups(groups.filter((g) => g.name !== groupName));
        toast.success(`Group "${groupName}" deleted${group?.items.length ? ', items moved to Ungrouped' : ''}`);
    };

    const toggleGroupExpand = (groupName: string) => {
        setGroups((prevGroups) => prevGroups.map((g) => (g.name === groupName ? { ...g, isExpanded: !g.isExpanded } : g)));
    };

    const handleItemClick = (itemId: number, groupName: string, event: React.MouseEvent) => {
        if (event.ctrlKey || event.metaKey) {
            // Ctrl/Cmd+Click: Toggle selection
            setSelectedItems((prev) => {
                const newSet = new Set(prev);
                if (newSet.has(itemId)) {
                    newSet.delete(itemId);
                } else {
                    newSet.add(itemId);
                }
                return newSet;
            });
            setLastSelectedId(itemId);
        } else if (event.shiftKey && lastSelectedId !== null) {
            // Shift+Click: Range selection within same group
            const group = groups.find((g) => g.name === groupName);
            if (group) {
                const startIndex = group.items.findIndex((i) => i.id === lastSelectedId);
                const endIndex = group.items.findIndex((i) => i.id === itemId);

                if (startIndex !== -1 && endIndex !== -1) {
                    const [min, max] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
                    const rangeIds = group.items.slice(min, max + 1).map((i) => i.id);

                    setSelectedItems((prev) => {
                        const newSet = new Set(prev);
                        rangeIds.forEach((id) => newSet.add(id));
                        return newSet;
                    });
                }
            }
        } else {
            // Regular click: Select only this item
            setSelectedItems(new Set([itemId]));
            setLastSelectedId(itemId);
        }
    };

    const clearSelection = () => {
        setSelectedItems(new Set());
        setLastSelectedId(null);
    };

    const moveItemInGroup = (groupName: string, itemId: number, direction: 'up' | 'down') => {
        setGroups((prevGroups) =>
            prevGroups.map((group) => {
                if (group.name !== groupName) return group;

                const itemIndex = group.items.findIndex((i) => i.id === itemId);
                if (itemIndex === -1) return group;

                const newIndex = direction === 'up' ? itemIndex - 1 : itemIndex + 1;
                if (newIndex < 0 || newIndex >= group.items.length) return group;

                const newItems = arrayMove(group.items, itemIndex, newIndex);
                return { ...group, items: newItems };
            })
        );
    };

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id);
        setActiveType(active.data.current?.type || 'item');
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over) {
            setActiveId(null);
            setActiveType(null);
            return;
        }

        if (activeType === 'group') {
            // Reordering delivery location groups
            setGroups((prevGroups) => {
                const oldIndex = prevGroups.findIndex((g) => g.name === active.id);
                const newIndex = prevGroups.findIndex((g) => g.name === over.id);

                if (oldIndex !== newIndex) {
                    return arrayMove(prevGroups, oldIndex, newIndex);
                }
                return prevGroups;
            });
        } else {
            // Dragging items
            const activeItemId = active.id as number;
            const overItemId = typeof over.id === 'number' ? over.id : null;
            const overIsGroup = over.data.current?.type === 'group';
            const overGroupName = overIsGroup ? (over.id as string) : over.data.current?.groupName;

            // Determine which items to move (selected items or just the dragged item)
            const itemsToMove = selectedItems.has(activeItemId) ? Array.from(selectedItems) : [activeItemId];

            setGroups((prevGroups) => {
                // Find source group and items
                const itemsMap = new Map<number, { item: LineItem; groupName: string }>();

                for (const group of prevGroups) {
                    for (const itemId of itemsToMove) {
                        const found = group.items.find((i) => i.id === itemId);
                        if (found) {
                            itemsMap.set(itemId, { item: found, groupName: group.name });
                        }
                    }
                }

                if (itemsMap.size === 0) {
                    return prevGroups;
                }

                // Get the primary item (the one being dragged)
                const primaryItem = itemsMap.get(activeItemId);
                if (!primaryItem) {
                    return prevGroups;
                }

                const sourceGroupName = primaryItem.groupName;

                // Check if all selected items are from the same group
                const allSameGroup = Array.from(itemsMap.values()).every((item) => item.groupName === sourceGroupName);

                // Check if dragging over another item (reordering within same group)
                if (overItemId !== null && !overIsGroup && allSameGroup) {
                    // Find which group the over item belongs to
                    let targetGroupName = '';
                    for (const group of prevGroups) {
                        if (group.items.find((i) => i.id === overItemId)) {
                            targetGroupName = group.name;
                            break;
                        }
                    }

                    // Only reorder if within the same group (single item drag)
                    if (targetGroupName === sourceGroupName && itemsToMove.length === 1) {
                        return prevGroups.map((group) => {
                            if (group.name !== sourceGroupName) return group;

                            const oldIndex = group.items.findIndex((i) => i.id === activeItemId);
                            const newIndex = group.items.findIndex((i) => i.id === overItemId);

                            if (oldIndex !== newIndex) {
                                return {
                                    ...group,
                                    items: arrayMove(group.items, oldIndex, newIndex),
                                };
                            }
                            return group;
                        });
                    }
                }

                // Moving items between groups (dropped on group area)
                if (overGroupName && overGroupName !== sourceGroupName && allSameGroup) {
                    const result = prevGroups.map((group) => {
                        if (group.name === sourceGroupName) {
                            return {
                                ...group,
                                items: group.items.filter((i) => !itemsToMove.includes(i.id)),
                            };
                        }
                        if (group.name === overGroupName) {
                            const itemsToAdd = itemsToMove.map((id) => itemsMap.get(id)!.item);
                            return {
                                ...group,
                                items: [...group.items, ...itemsToAdd],
                            };
                        }
                        return group;
                    });

                    // Clear selection after successful move
                    clearSelection();

                    return result;
                }

                return prevGroups;
            });
        }

        setActiveId(null);
        setActiveType(null);
    };

    const handleSave = async () => {
        setSaving(true);

        // Recalculate serial_numbers based on group order and item order within groups
        let serialNumber = 1;
        const items: { id: number; deliver_to: string | null; serial_number: number }[] = [];

        for (const group of groups) {
            for (const item of group.items) {
                items.push({
                    id: item.id,
                    deliver_to: group.name === 'Ungrouped' ? null : group.name,
                    serial_number: serialNumber++,
                });
            }
        }

        try {
            router.post(
                `/requisition/${requisitionId}/delivery-organization`,
                { items },
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        toast.success('Delivery organization saved');
                        setSaving(false);
                    },
                    onError: () => {
                        toast.error('Failed to save delivery organization');
                        setSaving(false);
                    },
                }
            );
        } catch {
            toast.error('An error occurred while saving');
            setSaving(false);
        }
    };

    const activeItem =
        activeType === 'item' && typeof activeId === 'number'
            ? groups.flatMap((g) => g.items).find((i) => i.id === activeId)
            : null;

    const activeGroup = activeType === 'group' && typeof activeId === 'string' ? groups.find((g) => g.name === activeId) : null;

    return (
        <Card className="p-6">
            <CardHeader className="pb-6 px-0">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <CardTitle>Delivery Organization</CardTitle>
                        {selectedItems.size > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">
                                    {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''} selected
                                </span>
                                <Button onClick={clearSelection} variant="ghost" size="sm">
                                    Clear
                                </Button>
                            </div>
                        )}
                    </div>
                    <Button onClick={handleSave} disabled={saving} className="ml-auto my-2">
                        <Save className="mr-2 h-4 w-4" />
                        {saving ? 'Saving...' : 'Save Organization'}
                    </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                    Organize items by delivery location. Ctrl+Click to select multiple, Shift+Click to select range.
                </p>
            </CardHeader>
            <CardContent className="space-y-4 px-0">
                {/* Add Group */}
                <div className="flex gap-2">
                    <Input
                        placeholder="Enter delivery location (e.g., Level 1, Level 11)..."
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()}
                    />
                    <Button onClick={handleAddGroup} variant="outline">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Location
                    </Button>
                </div>

                {/* Sortable List of Delivery Locations */}
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <div className="space-y-4">
                        <SortableContext items={groups.map((g) => g.name)} strategy={verticalListSortingStrategy}>
                            {groups.map((group) => (
                                <DeliveryGroupRow
                                    key={group.name}
                                    group={group}
                                    onDelete={handleDeleteGroup}
                                    onToggle={toggleGroupExpand}
                                    onMoveItem={moveItemInGroup}
                                    selectedItems={selectedItems}
                                    onItemClick={handleItemClick}
                                />
                            ))}
                        </SortableContext>
                    </div>

                    <DragOverlay>
                        {activeItem ? (
                            <DeliveryItemRow item={activeItem} isDragging />
                        ) : activeGroup ? (
                            <DeliveryGroupRow group={activeGroup} onDelete={() => { }} onToggle={() => { }} onMoveItem={() => { }} isDragging />
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </CardContent>
        </Card>
    );
}

function DeliveryGroupRow({
    group,
    onDelete,
    onToggle,
    onMoveItem,
    selectedItems,
    onItemClick,
    isDragging = false,
}: {
    group: DeliveryGroup;
    onDelete: (groupName: string) => void;
    onToggle: (groupName: string) => void;
    onMoveItem: (groupName: string, itemId: number, direction: 'up' | 'down') => void;
    selectedItems?: Set<number>;
    onItemClick?: (itemId: number, groupName: string, event: React.MouseEvent) => void;
    isDragging?: boolean;
}) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
        id: group.name,
        data: { type: 'group' },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className={isDragging ? 'opacity-50' : ''}>
            <Card className="border-2 my-2">
                <CardHeader className="py-3 px-4 mx-2">
                    <div className="flex items-center gap-2">
                        <div className="cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
                            <GripVertical className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => onToggle(group.name)} className="h-6 w-6 p-0">
                            {group.isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                            ) : (
                                <ChevronRight className="h-4 w-4" />
                            )}
                        </Button>
                        <CardTitle className="text-sm font-semibold">
                            {group.name !== 'Ungrouped'
                                ? `Pack these items for delivery to ${group.name}`
                                : `${group.name} (${group.items.length} items)`
                            }
                        </CardTitle>
                        <div className="ml-auto">
                            {group.name !== 'Ungrouped' && (
                                <Button variant="ghost" size="sm" onClick={() => onDelete(group.name)} className="h-8">
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                {group.isExpanded && (
                    <CardContent className="space-y-2 pb-4 pt-0 px-4 mx-2">
                        <SortableContext items={group.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                            {group.items.map((item, index) => (
                                <DeliveryItemRow
                                    key={item.id}
                                    item={item}
                                    groupName={group.name}
                                    isFirst={index === 0}
                                    isLast={index === group.items.length - 1}
                                    onMoveUp={() => onMoveItem(group.name, item.id, 'up')}
                                    onMoveDown={() => onMoveItem(group.name, item.id, 'down')}
                                    isSelected={selectedItems?.has(item.id) ?? false}
                                    onItemClick={onItemClick}
                                />
                            ))}
                        </SortableContext>
                        {group.items.length === 0 && (
                            <p className="py-6 text-center text-xs text-muted-foreground">Drag items here</p>
                        )}
                    </CardContent>
                )}
            </Card>
        </div>
    );
}

function DeliveryItemRow({
    item,
    groupName,
    isFirst = false,
    isLast = false,
    onMoveUp,
    onMoveDown,
    isSelected = false,
    onItemClick,
    isDragging = false,
}: {
    item: LineItem;
    groupName?: string;
    isFirst?: boolean;
    isLast?: boolean;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    isSelected?: boolean;
    onItemClick?: (itemId: number, groupName: string, event: React.MouseEvent) => void;
    isDragging?: boolean;
}) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
        id: item.id,
        data: { type: 'item', groupName },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const handleClick = (event: React.MouseEvent) => {
        if (onItemClick && groupName) {
            onItemClick(item.id, groupName, event);
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={handleClick}
            className={`
                flex items-center gap-2 rounded-md border p-3 text-sm cursor-pointer
                ${isDragging ? 'opacity-50' : ''}
                ${isSelected ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200' : 'bg-card'}
                hover:bg-accent transition-colors
            `}
        >
            <div
                className="cursor-grab active:cursor-grabbing"
                {...attributes}
                {...listeners}
                onClick={(e) => e.stopPropagation()}
            >
                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                    <span className="truncate font-mono text-xs font-medium">{item.code}</span>
                    <span className="truncate text-xs text-muted-foreground">{item.description}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Qty: {Number(item.qty).toFixed(2)}</span>
                    <span>Amount: ${Number(item.total_cost).toFixed(2)}</span>
                </div>
            </div>
            {onMoveUp && onMoveDown && (
                <div className="flex flex-col gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onMoveUp}
                        disabled={isFirst}
                        className="h-6 px-2 py-1 gap-1 flex items-center justify-start"
                        title="Move up"
                    >
                        <ChevronUp className="h-3 w-3 shrink-0" />
                        <span className="text-[10px] text-muted-foreground leading-none">Move up</span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onMoveDown}
                        disabled={isLast}
                        className="h-6 px-2 py-1 gap-1 flex items-center justify-start"
                        title="Move down"
                    >
                        <ChevronDown className="h-3 w-3 shrink-0" />
                        <span className="text-[10px] text-muted-foreground leading-none">Move down</span>
                    </Button>
                </div>
            )}
        </div>
    );
}
