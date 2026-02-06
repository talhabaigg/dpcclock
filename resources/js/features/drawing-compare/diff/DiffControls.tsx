/**
 * DiffControls Component
 *
 * UI controls for the diff overlay feature.
 */

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Diff, Loader2 } from 'lucide-react';
import { DiffOverlayState } from './useDiffOverlay';

type DiffControlsProps = {
    /** Current diff state */
    state: DiffOverlayState;
    /** Whether alignment is complete (diff only works after alignment) */
    isAligned: boolean;
    /** Toggle diff visibility */
    onToggle: () => void;
    /** Set sensitivity threshold */
    onSensitivityChange: (value: number) => void;
    /** Trigger manual recompute */
    onRecompute: () => void;
};

/**
 * Renders the diff overlay controls.
 * Only enabled when alignment is complete.
 */
export function DiffControls({ state, isAligned, onToggle, onSensitivityChange, onRecompute }: DiffControlsProps) {
    const { showDiff, sensitivity, isComputing, diffResult } = state;

    return (
        <div className="bg-muted/30 flex items-center gap-3 rounded-md border px-3 py-2">
            {/* Toggle */}
            <div className="flex items-center gap-2">
                <Diff className="text-muted-foreground h-4 w-4" />
                <Label htmlFor="diff-toggle" className="cursor-pointer text-sm">
                    Diff
                </Label>
                <Switch id="diff-toggle" checked={showDiff} onCheckedChange={onToggle} disabled={!isAligned} />
            </div>

            {/* Controls shown when diff is enabled */}
            {showDiff && isAligned && (
                <>
                    {/* Sensitivity slider */}
                    <div className="flex items-center gap-2">
                        <Label className="text-muted-foreground text-xs whitespace-nowrap">Sensitivity</Label>
                        <Slider
                            value={[255 - sensitivity]}
                            onValueChange={(values) => onSensitivityChange(255 - values[0])}
                            min={0}
                            max={200}
                            step={5}
                            className="w-20"
                        />
                        <span className="text-muted-foreground w-6 text-xs">{Math.round(((255 - sensitivity) / 255) * 100)}%</span>
                    </div>

                    {/* Recompute button */}
                    <Button type="button" size="sm" variant="ghost" onClick={onRecompute} disabled={isComputing} title="Recompute diff">
                        {isComputing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Diff className="h-4 w-4" />}
                    </Button>

                    {/* Stats */}
                    {diffResult && !isComputing && (
                        <span className="text-muted-foreground text-xs">{diffResult.diffPercentage.toFixed(1)}% changed</span>
                    )}
                </>
            )}

            {/* Hint when not aligned */}
            {!isAligned && <span className="text-muted-foreground text-xs">Complete alignment first</span>}
        </div>
    );
}
