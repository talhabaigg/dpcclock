import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConfirm } from '@/hooks/use-confirm';
import { api, ApiError } from '@/lib/api';
import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    Check,
    FolderTree,
    GripVertical,
    Loader2,
    Pencil,
    Plus,
    Trash2,
    Layers,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

export type BidArea = {
    id: number;
    location_id: number;
    parent_id: number | null;
    name: string;
    sort_order: number;
    children?: BidArea[];
    measurements_count?: number;
};

type BidAreaManagerProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    locationId: number;
    bidAreas: BidArea[];
    onBidAreasChange: (bidAreas: BidArea[]) => void;
};

type FlatArea = BidArea & { depth: number };

function flattenTree(areas: BidArea[], depth = 0): FlatArea[] {
    const result: FlatArea[] = [];
    for (const area of areas) {
        result.push({ ...area, depth });
        if (area.children?.length) {
            result.push(...flattenTree(area.children, depth + 1));
        }
    }
    return result;
}

export function BidAreaManager({ open, onOpenChange, locationId, bidAreas, onBidAreasChange }: BidAreaManagerProps) {
    // Add row
    const [addName, setAddName] = useState('');
    const [addParentId, setAddParentId] = useState<string>('none');
    const [adding, setAdding] = useState(false);

    // Inline edit
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [editParentId, setEditParentId] = useState<string>('none');
    const [savingEdit, setSavingEdit] = useState(false);

    // Bulk generate
    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkPrefix, setBulkPrefix] = useState('Level');
    const [bulkStart, setBulkStart] = useState('1');
    const [bulkEnd, setBulkEnd] = useState('10');
    const [bulkPad, setBulkPad] = useState(false);
    const [bulkParentId, setBulkParentId] = useState<string>('none');
    const [bulkGenerating, setBulkGenerating] = useState(false);

    // Multi-select + bulk delete
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [bulkDeleting, setBulkDeleting] = useState(false);

    const [loading, setLoading] = useState(false);
    const editInputRef = useRef<HTMLInputElement>(null);

    const { confirm, dialogProps: confirmProps } = useConfirm();

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const flatAreas = useMemo(() => flattenTree(bidAreas), [bidAreas]);

    const editParentOptions = useMemo(() => {
        if (!editingId) return flatAreas;
        const excludeIds = new Set<number>();
        const collect = (id: number) => {
            excludeIds.add(id);
            for (const a of flatAreas) {
                if (a.parent_id === id) collect(a.id);
            }
        };
        collect(editingId);
        return flatAreas.filter((a) => !excludeIds.has(a.id));
    }, [flatAreas, editingId]);

    const refresh = useCallback(async () => {
        if (!locationId) return;
        setLoading(true);
        try {
            const data = await api.get<{ bidAreas: BidArea[] }>(`/locations/${locationId}/bid-areas`);
            onBidAreasChange(data.bidAreas || []);
        } catch {
            toast.error('Failed to load bid areas.');
        } finally {
            setLoading(false);
        }
    }, [locationId, onBidAreasChange]);

    useEffect(() => {
        if (open) refresh();
    }, [open, refresh]);

    useEffect(() => {
        if (open) return;
        setAddName('');
        setAddParentId('none');
        setEditingId(null);
        setEditName('');
        setEditParentId('none');
        setSelectedIds(new Set());
        setBulkOpen(false);
    }, [open]);

    useEffect(() => {
        if (editingId !== null) editInputRef.current?.focus();
    }, [editingId]);

    const cancelEdit = () => {
        setEditingId(null);
        setEditName('');
        setEditParentId('none');
    };

    const startEdit = (area: FlatArea) => {
        setEditingId(area.id);
        setEditName(area.name);
        setEditParentId(area.parent_id ? String(area.parent_id) : 'none');
    };

    const handleAdd = async () => {
        const trimmed = addName.trim();
        if (!trimmed) return;
        setAdding(true);
        try {
            await api.post(`/locations/${locationId}/bid-areas`, {
                name: trimmed,
                parent_id: addParentId === 'none' ? null : Number(addParentId),
            });
            setAddName('');
            await refresh();
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : 'Failed to add area.');
        } finally {
            setAdding(false);
        }
    };

    const handleSaveEdit = async () => {
        if (editingId === null) return;
        const trimmed = editName.trim();
        if (!trimmed) {
            toast.error('Name cannot be empty.');
            return;
        }
        setSavingEdit(true);
        try {
            await api.put(`/locations/${locationId}/bid-areas/${editingId}`, {
                name: trimmed,
                parent_id: editParentId === 'none' ? null : Number(editParentId),
            });
            cancelEdit();
            await refresh();
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : 'Failed to save area.');
        } finally {
            setSavingEdit(false);
        }
    };

    const handleDelete = async (area: FlatArea) => {
        // Count measurements on this area + all descendants
        const descendantIds = new Set<number>([area.id]);
        const collect = (id: number) => {
            for (const a of flatAreas) {
                if (a.parent_id === id && !descendantIds.has(a.id)) {
                    descendantIds.add(a.id);
                    collect(a.id);
                }
            }
        };
        collect(area.id);
        const measurementCount = flatAreas
            .filter((a) => descendantIds.has(a.id))
            .reduce((sum, a) => sum + (a.measurements_count ?? 0), 0);
        const subAreas = descendantIds.size - 1;

        const parts: string[] = [];
        if (subAreas > 0) parts.push(`${subAreas} sub-area${subAreas === 1 ? '' : 's'}`);
        if (measurementCount > 0)
            parts.push(`${measurementCount} measurement${measurementCount === 1 ? ' will be' : 's will be'} unassigned (not deleted)`);

        const ok = await confirm({
            title: `Delete "${area.name}"`,
            description: parts.length > 0 ? parts.join(' · ') : 'This cannot be undone.',
            confirmLabel: 'Delete',
            variant: 'destructive',
        });
        if (!ok) return;
        try {
            await api.delete(`/locations/${locationId}/bid-areas/${area.id}`);
            if (editingId === area.id) cancelEdit();
            setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(area.id);
                return next;
            });
            await refresh();
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : 'Failed to delete area.');
        }
    };

    const handleBulkGenerate = async () => {
        const prefix = bulkPrefix.trim();
        const start = parseInt(bulkStart, 10);
        const end = parseInt(bulkEnd, 10);
        if (!prefix) {
            toast.error('Prefix is required.');
            return;
        }
        if (Number.isNaN(start) || Number.isNaN(end)) {
            toast.error('Start and end must be numbers.');
            return;
        }
        if (start > end) {
            toast.error('Start must be ≤ end.');
            return;
        }
        if (end - start + 1 > 200) {
            toast.error('Cannot create more than 200 areas at once.');
            return;
        }
        setBulkGenerating(true);
        try {
            const data = await api.post<{ created_count: number; skipped_count: number; skipped: string[] }>(
                `/locations/${locationId}/bid-areas/bulk`,
                {
                    prefix,
                    start,
                    end,
                    parent_id: bulkParentId === 'none' ? null : Number(bulkParentId),
                    pad_zeros: bulkPad,
                },
            );
            const msg = data.skipped_count > 0
                ? `Created ${data.created_count}. Skipped ${data.skipped_count} duplicate${data.skipped_count !== 1 ? 's' : ''}.`
                : `Created ${data.created_count} area${data.created_count !== 1 ? 's' : ''}.`;
            toast.success(msg);
            await refresh();
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : 'Failed to generate areas.');
        } finally {
            setBulkGenerating(false);
        }
    };

    const toggleSelect = (id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;

        // Total measurements that will be unassigned (across selected + their descendants)
        const affectedIds = new Set<number>(selectedIds);
        const collect = (id: number) => {
            for (const a of flatAreas) {
                if (a.parent_id === id && !affectedIds.has(a.id)) {
                    affectedIds.add(a.id);
                    collect(a.id);
                }
            }
        };
        for (const id of selectedIds) collect(id);
        const measurementCount = flatAreas
            .filter((a) => affectedIds.has(a.id))
            .reduce((sum, a) => sum + (a.measurements_count ?? 0), 0);

        const parts: string[] = [];
        const subAreas = affectedIds.size - selectedIds.size;
        if (subAreas > 0) parts.push(`${subAreas} sub-area${subAreas === 1 ? '' : 's'} will also be deleted`);
        if (measurementCount > 0)
            parts.push(`${measurementCount} measurement${measurementCount === 1 ? '' : 's'} will be unassigned (not deleted)`);

        const ok = await confirm({
            title: `Delete ${selectedIds.size} bid area${selectedIds.size === 1 ? '' : 's'}`,
            description: parts.length > 0 ? parts.join(' · ') : 'This cannot be undone.',
            confirmLabel: 'Delete',
            variant: 'destructive',
        });
        if (!ok) return;

        setBulkDeleting(true);
        try {
            await api.post(`/locations/${locationId}/bid-areas/bulk-delete`, {
                ids: Array.from(selectedIds),
            });
            toast.success(`Deleted ${selectedIds.size} area${selectedIds.size === 1 ? '' : 's'}.`);
            setSelectedIds(new Set());
            cancelEdit();
            await refresh();
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : 'Failed to delete areas.');
        } finally {
            setBulkDeleting(false);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const activeArea = flatAreas.find((a) => a.id === Number(active.id));
        const overArea = flatAreas.find((a) => a.id === Number(over.id));
        if (!activeArea || !overArea) return;

        // Only allow reordering within the same parent
        if (activeArea.parent_id !== overArea.parent_id) {
            toast.error('Drag within the same level. Use Edit to move between parents.');
            return;
        }

        const siblings = flatAreas.filter((a) => a.parent_id === activeArea.parent_id);
        const oldIdx = siblings.findIndex((a) => a.id === activeArea.id);
        const newIdx = siblings.findIndex((a) => a.id === overArea.id);
        if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;

        const reordered = arrayMove(siblings, oldIdx, newIdx);
        const ids = reordered.map((a) => a.id);

        // Optimistic local update — rebuild the tree with the new sort_order
        const reorderedMap = new Map<number, number>();
        reordered.forEach((a, i) => reorderedMap.set(a.id, i));
        const updateTree = (nodes: BidArea[]): BidArea[] => {
            const updated = nodes.map((n) => ({
                ...n,
                sort_order: reorderedMap.has(n.id) ? reorderedMap.get(n.id)! : n.sort_order,
                children: n.children ? updateTree(n.children) : n.children,
            }));
            // Re-sort siblings if any of them are in this batch
            if (updated.some((n) => reorderedMap.has(n.id))) {
                updated.sort((a, b) => a.sort_order - b.sort_order);
            }
            return updated;
        };
        onBidAreasChange(updateTree(bidAreas));

        try {
            await api.post(`/locations/${locationId}/bid-areas/reorder`, {
                parent_id: activeArea.parent_id,
                ids,
            });
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : 'Failed to save order.');
            await refresh();
        }
    };

    const allIds = flatAreas.map((a) => a.id);

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="flex max-h-[80vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
                    <DialogHeader className="shrink-0 px-3 pt-2.5 pb-1.5 pr-10">
                        <DialogTitle className="flex items-center gap-1.5 text-xs font-semibold">
                            <FolderTree className="size-3" />
                            Bid Areas
                            {flatAreas.length > 0 && (
                                <span className="ml-1 text-xs font-normal text-muted-foreground tabular-nums">
                                    {flatAreas.length}
                                </span>
                            )}
                        </DialogTitle>
                    </DialogHeader>

                    {/* Add row + bulk popover */}
                    <div className="flex shrink-0 items-center gap-1.5 px-3 pb-2">
                        <Input
                            value={addName}
                            onChange={(e) => setAddName(e.target.value)}
                            placeholder="New area name"
                            className="h-7 flex-1 rounded-sm text-xs"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAdd();
                                }
                            }}
                        />
                        <Select value={addParentId} onValueChange={setAddParentId}>
                            <SelectTrigger className="h-7 w-[120px] rounded-sm text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none" className="text-xs">
                                    <span className="text-muted-foreground">At root</span>
                                </SelectItem>
                                {flatAreas.map((a) => (
                                    <SelectItem key={a.id} value={String(a.id)} className="text-xs">
                                        <span style={{ paddingLeft: a.depth * 10 }}>{a.name}</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            size="sm"
                            className="h-7 gap-1 rounded-sm px-2 text-xs"
                            onClick={handleAdd}
                            disabled={adding || !addName.trim()}
                        >
                            {adding ? (
                                <Loader2 className="size-3 animate-spin" />
                            ) : (
                                <>
                                    <Plus className="size-3" />
                                    Add
                                </>
                            )}
                        </Button>
                        <Popover open={bulkOpen} onOpenChange={setBulkOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 rounded-sm p-0 text-muted-foreground hover:text-foreground"
                                    title="Bulk generate (e.g. Levels 3 → 42)"
                                >
                                    <Layers className="size-3" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-[320px] p-3">
                                <div className="mb-2 text-xs font-semibold">Bulk generate</div>
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <Input
                                            value={bulkPrefix}
                                            onChange={(e) => setBulkPrefix(e.target.value)}
                                            placeholder="Prefix"
                                            className="h-7 flex-1 rounded-sm text-xs"
                                        />
                                        <Input
                                            value={bulkStart}
                                            onChange={(e) => setBulkStart(e.target.value.replace(/[^\d-]/g, ''))}
                                            placeholder="Start"
                                            className="h-7 w-14 rounded-sm text-center text-xs tabular-nums"
                                            inputMode="numeric"
                                        />
                                        <span className="text-xs text-muted-foreground">→</span>
                                        <Input
                                            value={bulkEnd}
                                            onChange={(e) => setBulkEnd(e.target.value.replace(/[^\d-]/g, ''))}
                                            placeholder="End"
                                            className="h-7 w-14 rounded-sm text-center text-xs tabular-nums"
                                            inputMode="numeric"
                                        />
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        <Select value={bulkParentId} onValueChange={setBulkParentId}>
                                            <SelectTrigger className="h-7 flex-1 rounded-sm text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none" className="text-xs">
                                                    <span className="text-muted-foreground">At root</span>
                                                </SelectItem>
                                                {flatAreas.map((a) => (
                                                    <SelectItem key={a.id} value={String(a.id)} className="text-xs">
                                                        <span style={{ paddingLeft: a.depth * 10 }}>{a.name}</span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <label className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <input
                                                type="checkbox"
                                                checked={bulkPad}
                                                onChange={(e) => setBulkPad(e.target.checked)}
                                                className="size-3 rounded-sm border-input"
                                            />
                                            Pad 0s
                                        </label>
                                    </div>

                                    {(() => {
                                        const s = parseInt(bulkStart, 10);
                                        const e = parseInt(bulkEnd, 10);
                                        if (Number.isNaN(s) || Number.isNaN(e) || s > e) return null;
                                        const count = e - s + 1;
                                        const padW = bulkPad
                                            ? Math.max(String(Math.abs(s)).length, String(Math.abs(e)).length)
                                            : 0;
                                        const fmt = (n: number) =>
                                            bulkPad
                                                ? String(Math.abs(n)).padStart(padW, '0') + (n < 0 ? '-' : '')
                                                : String(n);
                                        const first = `${bulkPrefix.trim()} ${fmt(s)}`.trim();
                                        const last = `${bulkPrefix.trim()} ${fmt(e)}`.trim();
                                        return (
                                            <div className="text-xs text-muted-foreground">
                                                <span className="tabular-nums">{count}</span> area
                                                {count !== 1 ? 's' : ''}:{' '}
                                                <span className="font-medium text-foreground">{first}</span>
                                                {count > 1 && (
                                                    <>
                                                        {' '}…{' '}
                                                        <span className="font-medium text-foreground">{last}</span>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    <Button
                                        size="sm"
                                        className="h-7 w-full gap-1 rounded-sm text-xs"
                                        onClick={handleBulkGenerate}
                                        disabled={bulkGenerating || !bulkPrefix.trim()}
                                    >
                                        {bulkGenerating ? (
                                            <Loader2 className="size-3 animate-spin" />
                                        ) : (
                                            <>
                                                <Layers className="size-3" />
                                                Generate
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Tree list */}
                    {loading && flatAreas.length === 0 ? (
                        <div className="flex flex-1 items-center justify-center py-8">
                            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                        </div>
                    ) : flatAreas.length === 0 ? (
                        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-4 py-10 text-center">
                            <FolderTree className="size-5 text-muted-foreground/40" />
                            <p className="text-xs text-muted-foreground">No bid areas yet.</p>
                            <p className="text-xs text-muted-foreground/70">
                                Type a name above and press Enter to create one.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Combined select-all + selection-action bar */}
                            <div className="flex shrink-0 items-center gap-2 border-y border-border/60 px-3 py-1 text-xs">
                                <Checkbox
                                    checked={
                                        selectedIds.size === flatAreas.length
                                            ? true
                                            : selectedIds.size > 0
                                                ? 'indeterminate'
                                                : false
                                    }
                                    onCheckedChange={(checked) => {
                                        if (checked) setSelectedIds(new Set(flatAreas.map((a) => a.id)));
                                        else setSelectedIds(new Set());
                                    }}
                                    className="size-3.5 shrink-0"
                                    aria-label="Select all"
                                />
                                {selectedIds.size === 0 ? (
                                    <span className="text-muted-foreground">Select all</span>
                                ) : (
                                    <>
                                        <span className="font-medium tabular-nums">
                                            {selectedIds.size === flatAreas.length
                                                ? 'All selected'
                                                : `${selectedIds.size} of ${flatAreas.length} selected`}
                                        </span>
                                        <button
                                            type="button"
                                            className="text-muted-foreground hover:text-foreground"
                                            onClick={() => setSelectedIds(new Set())}
                                        >
                                            Clear
                                        </button>
                                        <span className="ml-auto" />
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 gap-1 rounded-sm px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                                            onClick={handleBulkDelete}
                                            disabled={bulkDeleting}
                                        >
                                            {bulkDeleting ? (
                                                <Loader2 className="size-3 animate-spin" />
                                            ) : (
                                                <>
                                                    <Trash2 className="size-3" />
                                                    Delete
                                                </>
                                            )}
                                        </Button>
                                    </>
                                )}
                            </div>

                            {/* Scrollable list */}
                            <div className="min-h-0 flex-1 overflow-y-auto">
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={handleDragEnd}
                                    modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                                >
                                    <SortableContext items={allIds} strategy={verticalListSortingStrategy}>
                                        <div className="py-1">
                                            {flatAreas.map((area) => (
                                                <SortableRow
                                                    key={area.id}
                                                    area={area}
                                                    isEditing={editingId === area.id}
                                                    isSelected={selectedIds.has(area.id)}
                                                    editName={editName}
                                                    setEditName={setEditName}
                                                    editParentId={editParentId}
                                                    setEditParentId={setEditParentId}
                                                    editParentOptions={editParentOptions}
                                                    savingEdit={savingEdit}
                                                    editInputRef={editInputRef}
                                                    onSave={handleSaveEdit}
                                                    onCancel={cancelEdit}
                                                    onStartEdit={startEdit}
                                                    onDelete={handleDelete}
                                                    onToggleSelect={toggleSelect}
                                                />
                                            ))}
                                        </div>
                                    </SortableContext>
                                </DndContext>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
            <ConfirmDialog {...confirmProps} />
        </>
    );
}

// ---------- sortable row ----------

type SortableRowProps = {
    area: FlatArea;
    isEditing: boolean;
    isSelected: boolean;
    editName: string;
    setEditName: (s: string) => void;
    editParentId: string;
    setEditParentId: (s: string) => void;
    editParentOptions: FlatArea[];
    savingEdit: boolean;
    editInputRef: React.RefObject<HTMLInputElement | null>;
    onSave: () => void;
    onCancel: () => void;
    onStartEdit: (area: FlatArea) => void;
    onDelete: (area: FlatArea) => void;
    onToggleSelect: (id: number) => void;
};

function SortableRow({
    area,
    isEditing,
    isSelected,
    editName,
    setEditName,
    editParentId,
    setEditParentId,
    editParentOptions,
    savingEdit,
    editInputRef,
    onSave,
    onCancel,
    onStartEdit,
    onDelete,
    onToggleSelect,
}: SortableRowProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: area.id,
        disabled: isEditing,
    });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
    } as const;

    return (
        <div
            ref={setNodeRef}
            style={{ ...style, paddingLeft: 4 + area.depth * 14 }}
            className={`group flex items-center gap-1 px-3 py-1 text-xs transition-colors ${
                isEditing ? 'bg-muted/40' : isSelected ? 'bg-muted/30' : 'hover:bg-muted/20'
            } ${isDragging ? 'cursor-grabbing' : ''}`}
        >
            {/* Drag handle (hidden during edit) */}
            {!isEditing && (
                <button
                    type="button"
                    {...attributes}
                    {...listeners}
                    className="-ml-1 flex size-5 shrink-0 cursor-grab touch-none items-center justify-center rounded-sm text-muted-foreground/40 opacity-0 hover:bg-muted hover:text-foreground active:cursor-grabbing group-hover:opacity-100"
                    aria-label="Drag to reorder"
                    title="Drag to reorder"
                >
                    <GripVertical className="size-3" />
                </button>
            )}

            {/* Selection checkbox */}
            {!isEditing && (
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelect(area.id)}
                    className="size-3.5 shrink-0"
                    aria-label={`Select ${area.name}`}
                />
            )}

            {area.depth > 0 && (
                <span aria-hidden="true" className="select-none text-muted-foreground/40">
                    └
                </span>
            )}

            {isEditing ? (
                <>
                    <Input
                        ref={editInputRef}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Name"
                        className="h-6 flex-1 rounded-sm text-xs"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                onSave();
                            } else if (e.key === 'Escape') {
                                e.preventDefault();
                                onCancel();
                            }
                        }}
                    />
                    <Select value={editParentId} onValueChange={setEditParentId}>
                        <SelectTrigger className="h-6 w-[100px] rounded-sm text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none" className="text-xs">
                                <span className="text-muted-foreground">Root</span>
                            </SelectItem>
                            {editParentOptions.map((a) => (
                                <SelectItem key={a.id} value={String(a.id)} className="text-xs">
                                    <span style={{ paddingLeft: a.depth * 10 }}>{a.name}</span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="size-6 rounded-sm p-0 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                        onClick={onSave}
                        disabled={savingEdit || !editName.trim()}
                        title="Save"
                    >
                        {savingEdit ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="size-6 rounded-sm p-0"
                        onClick={onCancel}
                        title="Cancel"
                    >
                        <X className="size-3" />
                    </Button>
                </>
            ) : (
                <>
                    <span className="flex-1 truncate">{area.name}</span>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="hidden size-5 rounded-sm p-0 group-hover:flex"
                        onClick={() => onStartEdit(area)}
                        title="Edit"
                    >
                        <Pencil className="size-3" />
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="hidden size-5 rounded-sm p-0 text-destructive hover:bg-destructive/10 hover:text-destructive group-hover:flex"
                        onClick={() => onDelete(area)}
                        title="Delete"
                    >
                        <Trash2 className="size-3" />
                    </Button>
                </>
            )}
        </div>
    );
}
