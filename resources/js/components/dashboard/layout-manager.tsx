import { useState } from 'react';
import { router } from '@inertiajs/react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Check, ChevronDown, Copy, LayoutGrid, Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LayoutOption {
    id: number;
    name: string;
    is_active: boolean;
}

interface LayoutManagerProps {
    allLayouts: LayoutOption[];
    activeLayoutId: number | null;
}

export default function LayoutManager({ allLayouts, activeLayoutId }: LayoutManagerProps) {
    const [layouts, setLayouts] = useState(allLayouts);
    const [createOpen, setCreateOpen] = useState(false);
    const [renameOpen, setRenameOpen] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
    const [newName, setNewName] = useState('');
    const [renameName, setRenameName] = useState('');
    const [renameId, setRenameId] = useState<number | null>(null);
    const [cloneFrom, setCloneFrom] = useState(false);
    const [loading, setLoading] = useState(false);

    const activeLayout = layouts.find((l) => l.is_active);
    const deleteTarget = layouts.find((l) => l.id === deleteConfirmId);

    const handleActivate = async (id: number) => {
        try {
            setLoading(true);
            await api.post(`/dashboard-layouts/${id}/activate`);
            router.reload({ preserveScroll: true });
        } catch {
            toast.error('Failed to activate layout.');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newName.trim()) return;
        try {
            setLoading(true);
            await api.post('/dashboard-layouts', {
                name: newName.trim(),
                clone_from: cloneFrom ? activeLayoutId : undefined,
            });
            setCreateOpen(false);
            setNewName('');
            setCloneFrom(false);
            // Refresh layouts list
            const updated = await api.get<LayoutOption[]>('/dashboard-layouts');
            setLayouts(updated);
            toast.success('Layout created.');
        } catch {
            toast.error('Failed to create layout.');
        } finally {
            setLoading(false);
        }
    };

    const handleRename = async () => {
        if (!renameName.trim() || !renameId) return;
        try {
            setLoading(true);
            await api.put(`/dashboard-layouts/${renameId}`, { name: renameName.trim() });
            setRenameOpen(false);
            setLayouts((prev) => prev.map((l) => l.id === renameId ? { ...l, name: renameName.trim() } : l));
            if (renameId === activeLayoutId) {
                router.reload({ preserveScroll: true });
            }
            toast.success('Layout renamed.');
        } catch {
            toast.error('Failed to rename layout.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            setLoading(true);
            await api.delete(`/dashboard-layouts/${id}`);
            setDeleteConfirmId(null);
            setLayouts((prev) => prev.filter((l) => l.id !== id));
            toast.success('Layout deleted.');
        } catch {
            toast.error('Cannot delete this layout.');
        } finally {
            setLoading(false);
        }
    };

    const openRename = (layout: LayoutOption) => {
        setRenameId(layout.id);
        setRenameName(layout.name);
        setRenameOpen(true);
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs px-2">
                        <LayoutGrid className="h-3 w-3" />
                        {activeLayout?.name ?? 'Layout'}
                        <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[220px]">
                    {layouts.map((layout) => (
                        <DropdownMenuItem
                            key={layout.id}
                            className="flex items-center gap-2 text-xs"
                            onSelect={(e) => {
                                e.preventDefault();
                                if (!layout.is_active) handleActivate(layout.id);
                            }}
                            disabled={loading}
                        >
                            <Check className={cn('h-3 w-3 shrink-0', layout.is_active ? 'opacity-100' : 'opacity-0')} />
                            <span className="flex-1 truncate">{layout.name}</span>
                            <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                    type="button"
                                    className="p-0.5 rounded hover:bg-accent"
                                    onClick={(e) => { e.stopPropagation(); openRename(layout); }}
                                    title="Rename"
                                >
                                    <Pencil className="h-3 w-3 text-muted-foreground" />
                                </button>
                                {!layout.is_active && (
                                    <button
                                        type="button"
                                        className="p-0.5 rounded hover:bg-destructive/10"
                                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(layout.id); }}
                                        title="Delete"
                                    >
                                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                                    </button>
                                )}
                            </div>
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        className="text-xs gap-2"
                        onSelect={(e) => { e.preventDefault(); setCreateOpen(true); }}
                    >
                        <Plus className="h-3 w-3" />
                        New Layout
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Create Dialog */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="sm:max-w-[360px]">
                    <DialogHeader>
                        <DialogTitle className="text-sm">New Dashboard Layout</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <Input
                            placeholder="Layout name"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="text-sm"
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                            autoFocus
                        />
                        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                            <input
                                type="checkbox"
                                checked={cloneFrom}
                                onChange={(e) => setCloneFrom(e.target.checked)}
                                className="rounded"
                            />
                            <Copy className="h-3 w-3" />
                            Copy from current layout
                        </label>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)} className="text-xs">Cancel</Button>
                        <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || loading} className="text-xs">Create</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Rename Dialog */}
            <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
                <DialogContent className="sm:max-w-[360px]">
                    <DialogHeader>
                        <DialogTitle className="text-sm">Rename Layout</DialogTitle>
                    </DialogHeader>
                    <div className="py-2">
                        <Input
                            value={renameName}
                            onChange={(e) => setRenameName(e.target.value)}
                            className="text-sm"
                            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setRenameOpen(false)} className="text-xs">Cancel</Button>
                        <Button size="sm" onClick={handleRename} disabled={!renameName.trim() || loading} className="text-xs">Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-sm">Delete Layout</AlertDialogTitle>
                        <AlertDialogDescription className="text-xs">
                            Are you sure you want to delete "{deleteTarget?.name}"? This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
                            disabled={loading}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
