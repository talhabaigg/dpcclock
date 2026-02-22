import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Scale } from 'lucide-react';
import { PAPER_SIZES, SCALE_OPTIONS, UNIT_OPTIONS } from '@/lib/constants';
import type { Point } from '@/components/measurement-layer';

type CalibrationDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    method: 'manual' | 'preset';
    onMethodChange: (method: 'manual' | 'preset') => void;
    pendingPoints: { a: Point; b: Point } | null;
    distance: string;
    onDistanceChange: (distance: string) => void;
    unit: string;
    onUnitChange: (unit: string) => void;
    paperSize: string;
    onPaperSizeChange: (paperSize: string) => void;
    scale: string;
    onScaleChange: (scale: string) => void;
    customScale: string;
    onCustomScaleChange: (customScale: string) => void;
    saving: boolean;
    onSave: () => void;
};

export default function CalibrationDialog({
    open,
    onOpenChange,
    method,
    onMethodChange,
    pendingPoints,
    distance,
    onDistanceChange,
    unit,
    onUnitChange,
    paperSize,
    onPaperSizeChange,
    scale,
    onScaleChange,
    customScale,
    onCustomScaleChange,
    saving,
    onSave,
}: CalibrationDialogProps) {
    const saveDisabled =
        saving ||
        (method === 'manual' && (!pendingPoints || !distance)) ||
        (method === 'preset' && scale === 'Custom' && !customScale);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Scale className="h-4 w-4" />
                        Set Scale
                    </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4">
                    {/* Method tabs */}
                    <div className="bg-muted flex rounded-lg p-1">
                        <button
                            type="button"
                            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                                method === 'preset' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                            }`}
                            onClick={() => onMethodChange('preset')}
                        >
                            Paper Scale
                        </button>
                        <button
                            type="button"
                            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                                method === 'manual' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                            }`}
                            onClick={() => onMethodChange('manual')}
                        >
                            Draw Line
                        </button>
                    </div>

                    {method === 'preset' ? (
                        <>
                            <div className="grid gap-2">
                                <Label className="text-xs">Paper Size</Label>
                                <Select value={paperSize} onValueChange={onPaperSizeChange}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PAPER_SIZES.map((size) => (
                                            <SelectItem key={size} value={size}>
                                                {size}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-xs">Drawing Scale</Label>
                                <Select value={scale} onValueChange={onScaleChange}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SCALE_OPTIONS.map((s) => (
                                            <SelectItem key={s} value={s}>
                                                {s}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {scale === 'Custom' && (
                                    <Input
                                        value={customScale}
                                        onChange={(e) => onCustomScaleChange(e.target.value)}
                                        placeholder="e.g. 1:75"
                                        className="h-9 text-xs"
                                    />
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            {pendingPoints ? (
                                <div className="rounded bg-green-50 px-3 py-2 text-xs text-green-700 dark:bg-green-950/30 dark:text-green-300">
                                    Reference line drawn. Enter the real-world distance.
                                </div>
                            ) : (
                                <div className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                                    Click two points on the drawing to draw a reference line, then come back to enter the distance.
                                </div>
                            )}
                            <div className="grid gap-2">
                                <Label className="text-xs">Real Distance</Label>
                                <Input
                                    type="number"
                                    min="0.001"
                                    step="any"
                                    value={distance}
                                    onChange={(e) => onDistanceChange(e.target.value)}
                                    placeholder="e.g. 10"
                                    className="h-9"
                                    disabled={!pendingPoints}
                                />
                            </div>
                        </>
                    )}

                    <div className="grid gap-2">
                        <Label className="text-xs">Unit</Label>
                        <Select value={unit} onValueChange={onUnitChange}>
                            <SelectTrigger className="h-9">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {UNIT_OPTIONS.map((u) => (
                                    <SelectItem key={u.value} value={u.value}>
                                        {u.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button size="sm" onClick={onSave} disabled={saveDisabled}>
                        {saving ? 'Saving...' : 'Save Scale'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
