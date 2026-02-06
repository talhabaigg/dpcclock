import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import type { ColumnState } from 'ag-grid-community';
import { BookmarkPlus, Check, ChevronDown, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';

const PRESETS_STORAGE_KEY = 'turnover-forecast-column-presets';

export type ColumnPreset = {
    id: string;
    name: string;
    createdAt: string;
    columnState: ColumnState[];
    hiddenColumns: string[];
};

interface ColumnPresetManagerProps {
    currentColumnState: ColumnState[] | null;
    currentHiddenColumns: string[];
    onLoadPreset: (preset: ColumnPreset) => void;
    activePresetId: string | null;
    onActivePresetChange: (id: string | null) => void;
}

export function ColumnPresetManager({
    currentColumnState,
    currentHiddenColumns,
    onLoadPreset,
    activePresetId,
    onActivePresetChange,
}: ColumnPresetManagerProps) {
    const [presets, setPresets] = useState<ColumnPreset[]>(() => {
        try {
            const stored = localStorage.getItem(PRESETS_STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const savePresetsToStorage = useCallback((newPresets: ColumnPreset[]) => {
        localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(newPresets));
        setPresets(newPresets);
    }, []);

    const handleSavePreset = useCallback(() => {
        if (!newPresetName.trim() || !currentColumnState) return;

        const newPreset: ColumnPreset = {
            id: `preset-${Date.now()}`,
            name: newPresetName.trim(),
            createdAt: new Date().toISOString(),
            columnState: currentColumnState,
            hiddenColumns: currentHiddenColumns,
        };

        const updatedPresets = [...presets, newPreset];
        savePresetsToStorage(updatedPresets);
        onActivePresetChange(newPreset.id);
        setNewPresetName('');
        setSaveDialogOpen(false);
    }, [newPresetName, currentColumnState, currentHiddenColumns, presets, savePresetsToStorage, onActivePresetChange]);

    const handleUpdatePreset = useCallback(
        (presetId: string) => {
            if (!currentColumnState) return;

            const updatedPresets = presets.map((preset) => {
                if (preset.id === presetId) {
                    return {
                        ...preset,
                        columnState: currentColumnState,
                        hiddenColumns: currentHiddenColumns,
                    };
                }
                return preset;
            });

            savePresetsToStorage(updatedPresets);
        },
        [currentColumnState, currentHiddenColumns, presets, savePresetsToStorage],
    );

    const handleDeletePreset = useCallback(
        (presetId: string) => {
            const updatedPresets = presets.filter((p) => p.id !== presetId);
            savePresetsToStorage(updatedPresets);
            if (activePresetId === presetId) {
                onActivePresetChange(null);
            }
            setDeleteConfirmId(null);
        },
        [presets, savePresetsToStorage, activePresetId, onActivePresetChange],
    );

    const handleLoadPreset = useCallback(
        (preset: ColumnPreset) => {
            onLoadPreset(preset);
            onActivePresetChange(preset.id);
        },
        [onLoadPreset, onActivePresetChange],
    );

    const activePreset = presets.find((p) => p.id === activePresetId);

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                        <BookmarkPlus className="h-4 w-4" />
                        <span className="hidden max-w-[100px] truncate sm:inline">{activePreset ? activePreset.name : 'Views'}</span>
                        <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel className="text-muted-foreground text-xs">Saved Views</DropdownMenuLabel>

                    {presets.length === 0 ? (
                        <div className="text-muted-foreground px-2 py-3 text-center text-sm">No saved views yet</div>
                    ) : (
                        presets.map((preset) => (
                            <DropdownMenuItem
                                key={preset.id}
                                className="group flex items-center justify-between"
                                onSelect={(e) => {
                                    e.preventDefault();
                                    handleLoadPreset(preset);
                                }}
                            >
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                    {activePresetId === preset.id && <Check className="text-primary h-4 w-4 flex-shrink-0" />}
                                    <span className={`truncate ${activePresetId !== preset.id ? 'ml-6' : ''}`}>{preset.name}</span>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                    {activePresetId === preset.id && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 px-2 text-xs"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleUpdatePreset(preset.id);
                                            }}
                                        >
                                            Update
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:text-destructive h-6 w-6 p-0"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setDeleteConfirmId(preset.id);
                                        }}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            </DropdownMenuItem>
                        ))
                    )}

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                        onSelect={(e) => {
                            e.preventDefault();
                            setSaveDialogOpen(true);
                        }}
                        className="text-primary"
                    >
                        <BookmarkPlus className="mr-2 h-4 w-4" />
                        Save Current View
                    </DropdownMenuItem>

                    {activePresetId && (
                        <DropdownMenuItem onSelect={() => onActivePresetChange(null)} className="text-muted-foreground">
                            Clear Active View
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Save Preset Dialog */}
            <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Save View</DialogTitle>
                        <DialogDescription>Save your current column settings as a reusable view.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            placeholder="View name (e.g., 'Monthly Summary')"
                            value={newPresetName}
                            onChange={(e) => setNewPresetName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleSavePreset();
                                }
                            }}
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSavePreset} disabled={!newPresetName.trim()}>
                            Save View
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Delete View</DialogTitle>
                        <DialogDescription>Are you sure you want to delete this saved view? This action cannot be undone.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={() => deleteConfirmId && handleDeletePreset(deleteConfirmId)}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
