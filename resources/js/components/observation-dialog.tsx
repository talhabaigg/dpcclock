import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PanoramaViewer } from '@/components/panorama-viewer';
import type { Observation } from '@/types/takeoff';
import { Camera, Sparkles, Trash2 } from 'lucide-react';

type ObservationDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingObservation: Observation | null;
    observationType: 'defect' | 'observation';
    onObservationTypeChange: (type: 'defect' | 'observation') => void;
    description: string;
    onDescriptionChange: (description: string) => void;
    photoFile: File | null;
    onPhotoFileChange: (file: File | null) => void;
    is360Photo: boolean;
    onIs360PhotoChange: (is360: boolean) => void;
    saving: boolean;
    confirming: boolean;
    deleting: boolean;
    describing: boolean;
    onSave: () => void;
    onUpdate: () => void;
    onDelete: () => void;
    onConfirm: () => void;
    onDescribeWithAI: () => void;
    onDetect360: (file: File) => void;
    onReset: () => void;
};

export function ObservationDialog({
    open,
    onOpenChange,
    editingObservation,
    observationType,
    onObservationTypeChange,
    description,
    onDescriptionChange,
    photoFile,
    onPhotoFileChange,
    is360Photo,
    onIs360PhotoChange,
    saving,
    confirming,
    deleting,
    describing,
    onSave,
    onUpdate,
    onDelete,
    onConfirm,
    onDescribeWithAI,
    onDetect360,
    onReset,
}: ObservationDialogProps) {
    const handleOpenChange = (nextOpen: boolean) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
            onReset();
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className={is360Photo || editingObservation?.is_360_photo ? 'sm:max-w-lg' : 'sm:max-w-md'}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {editingObservation?.source === 'ai_comparison' && <Sparkles className="h-4 w-4 text-violet-500" />}
                        {editingObservation ? 'Edit Observation' : 'Add Observation'}
                    </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4">
                    {/* AI Observation Info Panel */}
                    {editingObservation?.source === 'ai_comparison' && (
                        <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 dark:border-violet-800 dark:bg-violet-950/30">
                            <div className="mb-2 flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-xs font-medium text-violet-700 dark:text-violet-300">
                                    <Sparkles className="h-3 w-3" />
                                    AI-Generated Observation
                                </span>
                                {editingObservation.is_confirmed ? (
                                    <Badge variant="default" className="bg-green-600 text-xs">
                                        Confirmed
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="border-amber-500 text-xs text-amber-600">
                                        Unconfirmed
                                    </Badge>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                {editingObservation.ai_change_type && (
                                    <div>
                                        <span className="text-muted-foreground">Change Type:</span>{' '}
                                        <span className="capitalize">{editingObservation.ai_change_type}</span>
                                    </div>
                                )}
                                {editingObservation.ai_impact && (
                                    <div>
                                        <span className="text-muted-foreground">Impact:</span>{' '}
                                        <Badge
                                            variant={
                                                editingObservation.ai_impact === 'high'
                                                    ? 'destructive'
                                                    : editingObservation.ai_impact === 'medium'
                                                      ? 'default'
                                                      : 'secondary'
                                            }
                                            className="ml-1 text-[10px]"
                                        >
                                            {editingObservation.ai_impact}
                                        </Badge>
                                    </div>
                                )}
                                {editingObservation.ai_location && (
                                    <div className="col-span-2">
                                        <span className="text-muted-foreground">AI Location:</span> <span>{editingObservation.ai_location}</span>
                                    </div>
                                )}
                                {editingObservation.potential_change_order && (
                                    <div className="col-span-2">
                                        <Badge variant="destructive" className="text-[10px]">
                                            Potential Change Order
                                        </Badge>
                                    </div>
                                )}
                            </div>
                            <div className="mt-3 flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 gap-1 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900"
                                    onClick={onDescribeWithAI}
                                    disabled={describing || confirming}
                                >
                                    <Sparkles className="h-3.5 w-3.5" />
                                    {describing ? 'Analyzing...' : 'Describe with AI'}
                                </Button>
                                {!editingObservation.is_confirmed && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 border-violet-300 text-violet-700 hover:bg-violet-100 dark:border-violet-700 dark:text-violet-300 dark:hover:bg-violet-900"
                                        onClick={onConfirm}
                                        disabled={confirming || describing}
                                    >
                                        {confirming ? 'Confirming...' : 'Confirm'}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="grid gap-2">
                        <Label className="text-xs">Type</Label>
                        <Select value={observationType} onValueChange={(value) => onObservationTypeChange(value as 'defect' | 'observation')}>
                            <SelectTrigger className="h-9">
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="defect">Defect</SelectItem>
                                <SelectItem value="observation">Observation</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label className="text-xs">Description</Label>
                        <Textarea
                            value={description}
                            onChange={(event) => onDescriptionChange(event.target.value)}
                            placeholder="Describe the issue or observation"
                            rows={3}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label className="text-xs">Photo</Label>
                        <Input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="h-9 text-xs"
                            onChange={(event) => {
                                const file = event.target.files?.[0] || null;
                                onPhotoFileChange(file);
                                if (file) {
                                    onDetect360(file);
                                } else {
                                    onIs360PhotoChange(false);
                                }
                            }}
                        />
                        <p className="text-muted-foreground text-[10px]">Max 50MB. Supports standard photos and 360 panoramic images.</p>
                        {photoFile && (
                            <div className="text-muted-foreground flex items-center gap-2 text-xs">
                                <Camera className="h-3.5 w-3.5" />
                                {photoFile.name}
                            </div>
                        )}
                        {!photoFile && editingObservation?.photo_url && (
                            <div className="overflow-hidden rounded border">
                                {editingObservation.is_360_photo || is360Photo ? (
                                    <PanoramaViewer imageUrl={`/drawing-observations/${editingObservation.id}/photo`} className="h-48 w-full" compact />
                                ) : (
                                    <img src={editingObservation.photo_url} alt="Current" className="h-24 w-full object-cover" />
                                )}
                            </div>
                        )}
                        {(photoFile || editingObservation?.photo_url) && (
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="is-360-photo"
                                    checked={is360Photo}
                                    onCheckedChange={(checked) => onIs360PhotoChange(checked === true)}
                                />
                                <Label htmlFor="is-360-photo" className="cursor-pointer text-xs">
                                    This is a 360 panoramic photo
                                </Label>
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                    <div>
                        {editingObservation && (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={onDelete}
                                disabled={deleting || saving}
                                className="gap-1"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                {deleting ? 'Deleting...' : 'Delete'}
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={editingObservation ? onUpdate : onSave}
                            disabled={saving || deleting}
                        >
                            {saving ? 'Saving...' : editingObservation ? 'Update' : 'Save'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
