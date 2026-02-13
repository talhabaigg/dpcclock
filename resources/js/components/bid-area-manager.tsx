import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronRight, FolderTree, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

export type BidArea = {
    id: number;
    location_id: number;
    parent_id: number | null;
    name: string;
    sort_order: number;
    children?: BidArea[];
};

type BidAreaManagerProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    locationId: number;
    bidAreas: BidArea[];
    onBidAreasChange: (bidAreas: BidArea[]) => void;
};

function getCsrfToken() {
    return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '';
}
function getXsrfToken() {
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
}

function flattenTree(areas: BidArea[], depth = 0): Array<BidArea & { depth: number }> {
    const result: Array<BidArea & { depth: number }> = [];
    for (const area of areas) {
        result.push({ ...area, depth });
        if (area.children?.length) {
            result.push(...flattenTree(area.children, depth + 1));
        }
    }
    return result;
}

export function BidAreaManager({ open, onOpenChange, locationId, bidAreas, onBidAreasChange }: BidAreaManagerProps) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form state
    const [formName, setFormName] = useState('');
    const [formParentId, setFormParentId] = useState<string>('none');
    const [editingId, setEditingId] = useState<number | null>(null);

    const flatAreas = useMemo(() => flattenTree(bidAreas), [bidAreas]);

    // Get all possible parents (for the dropdown). When editing, exclude self and descendants.
    const parentOptions = useMemo(() => {
        if (!editingId) return flatAreas;
        // Exclude the area being edited and its descendants
        const excludeIds = new Set<number>();
        const collectDescendants = (id: number) => {
            excludeIds.add(id);
            for (const a of flatAreas) {
                if (a.parent_id === id) collectDescendants(a.id);
            }
        };
        collectDescendants(editingId);
        return flatAreas.filter((a) => !excludeIds.has(a.id));
    }, [flatAreas, editingId]);

    // Fetch bid areas when dialog opens
    useEffect(() => {
        if (!open || !locationId) return;
        setLoading(true);
        fetch(`/locations/${locationId}/bid-areas`, {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
        })
            .then((res) => res.json())
            .then((data) => onBidAreasChange(data.bidAreas || []))
            .catch(() => toast.error('Failed to load bid areas'))
            .finally(() => setLoading(false));
    }, [open, locationId]);

    const resetForm = () => {
        setFormName('');
        setFormParentId('none');
        setEditingId(null);
    };

    const handleEdit = (area: BidArea & { depth: number }) => {
        setEditingId(area.id);
        setFormName(area.name);
        setFormParentId(area.parent_id ? String(area.parent_id) : 'none');
    };

    const handleSave = async () => {
        if (!formName.trim()) {
            toast.error('Name is required');
            return;
        }

        setSaving(true);
        const parentId = formParentId === 'none' ? null : Number(formParentId);

        try {
            const isEdit = editingId !== null;
            const url = isEdit
                ? `/locations/${locationId}/bid-areas/${editingId}`
                : `/locations/${locationId}/bid-areas`;

            const response = await fetch(url, {
                method: isEdit ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'X-XSRF-TOKEN': getXsrfToken(),
                    Accept: 'application/json',
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    name: formName.trim(),
                    parent_id: parentId,
                }),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => null);
                throw new Error(err?.message || 'Failed to save');
            }

            toast.success(isEdit ? 'Bid area updated' : 'Bid area created');

            // Refetch the tree
            const listRes = await fetch(`/locations/${locationId}/bid-areas`, {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
            });
            const listData = await listRes.json();
            onBidAreasChange(listData.bidAreas || []);
            resetForm();
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to save bid area');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this bid area and all its children?')) return;

        try {
            const response = await fetch(`/locations/${locationId}/bid-areas/${id}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'X-XSRF-TOKEN': getXsrfToken(),
                    Accept: 'application/json',
                },
                credentials: 'same-origin',
            });

            if (!response.ok) throw new Error('Failed to delete');

            toast.success('Bid area deleted');

            // Refetch
            const listRes = await fetch(`/locations/${locationId}/bid-areas`, {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
            });
            const listData = await listRes.json();
            onBidAreasChange(listData.bidAreas || []);

            if (editingId === id) resetForm();
        } catch {
            toast.error('Failed to delete bid area');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[70vh] flex-col gap-0 p-0 sm:max-w-md">
                <DialogHeader className="shrink-0 border-b px-4 py-3">
                    <DialogTitle className="flex items-center gap-2 text-sm">
                        <FolderTree className="h-4 w-4" />
                        Bid Areas
                    </DialogTitle>
                </DialogHeader>

                <div className="flex min-h-0 flex-1 flex-col">
                    {/* Add/Edit form */}
                    <div className="shrink-0 border-b bg-muted/30 px-4 py-3">
                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                    {editingId ? 'Edit Name' : 'New Area'}
                                </label>
                                <Input
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="e.g. Tower 1"
                                    className="h-7 text-[12px]"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSave();
                                    }}
                                />
                            </div>
                            <div className="w-28">
                                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                    Parent
                                </label>
                                <Select value={formParentId} onValueChange={setFormParentId}>
                                    <SelectTrigger className="h-7 text-[12px]">
                                        <SelectValue placeholder="None" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">
                                            <span className="text-muted-foreground">None (root)</span>
                                        </SelectItem>
                                        {parentOptions.map((a) => (
                                            <SelectItem key={a.id} value={String(a.id)}>
                                                <span style={{ paddingLeft: a.depth * 12 }}>{a.name}</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button size="sm" className="h-7 px-2 text-[11px]" onClick={handleSave} disabled={saving}>
                                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : editingId ? 'Save' : <Plus className="h-3 w-3" />}
                            </Button>
                            {editingId && (
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={resetForm}>
                                    <X className="h-3 w-3" />
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Tree list */}
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                        ) : flatAreas.length === 0 ? (
                            <div className="px-4 py-8 text-center text-[12px] text-muted-foreground">
                                No bid areas yet. Create one above.
                            </div>
                        ) : (
                            <div className="py-1">
                                {flatAreas.map((area) => (
                                    <div
                                        key={area.id}
                                        className={`group flex items-center gap-1.5 px-4 py-1.5 hover:bg-accent/50 ${
                                            editingId === area.id ? 'bg-accent' : ''
                                        }`}
                                        style={{ paddingLeft: 16 + area.depth * 16 }}
                                    >
                                        {area.depth > 0 && (
                                            <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/50" />
                                        )}
                                        <span className="flex-1 truncate text-[12px]">{area.name}</span>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="hidden h-5 w-5 p-0 group-hover:flex"
                                            onClick={() => handleEdit(area)}
                                        >
                                            <Pencil className="h-2.5 w-2.5" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="hidden h-5 w-5 p-0 text-destructive hover:text-destructive group-hover:flex"
                                            onClick={() => handleDelete(area.id)}
                                        >
                                            <Trash2 className="h-2.5 w-2.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="shrink-0 border-t px-4 py-2">
                    <Button size="sm" variant="outline" onClick={() => onOpenChange(false)} className="h-7 text-[11px]">
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
