import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { CalibrationData } from '@/components/measurement-layer';
import { ChevronDown, PenLine, Ruler, Scale, Trash2 } from 'lucide-react';

type ScaleChipProps = {
    calibration: CalibrationData | null;
    canEdit: boolean;
    onOpenPreset: () => void;
    onOpenManual: () => void;
    onDelete: () => void;
};

export function ScaleChip({ calibration, canEdit, onOpenPreset, onOpenManual, onDelete }: ScaleChipProps) {
    const label = calibration
        ? calibration.method === 'preset'
            ? `${calibration.paper_size} · ${calibration.drawing_scale}`
            : `${calibration.real_distance?.toFixed(2)} ${calibration.unit}`
        : null;

    if (!canEdit && !calibration) {
        return (
            <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <Ruler className="size-3" />
                Not calibrated
            </span>
        );
    }

    if (!canEdit && calibration) {
        return (
            <span className="flex items-center gap-1 rounded-sm bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-700 dark:text-emerald-400">
                <Ruler className="size-3" />
                <span className="tabular-nums">{label}</span>
            </span>
        );
    }

    if (!calibration) {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 gap-1 rounded-sm border-amber-500/40 bg-amber-500/5 px-2 text-xs text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
                    >
                        <Ruler className="size-3" />
                        Set scale
                        <ChevronDown className="size-3 opacity-60" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-44">
                    <DropdownMenuItem onClick={onOpenPreset} className="gap-2 text-xs">
                        <Scale className="size-3" />
                        Paper size & scale
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onOpenManual} className="gap-2 text-xs">
                        <PenLine className="size-3" />
                        Draw a known distance
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 rounded-sm px-2 text-xs"
                    title="Drawing scale"
                >
                    <Ruler className="size-3 text-emerald-600 dark:text-emerald-400" />
                    <span className="tabular-nums">{label}</span>
                    <ChevronDown className="size-3 opacity-60" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-44">
                <DropdownMenuItem onClick={onOpenPreset} className="gap-2 text-xs">
                    <Scale className="size-3" />
                    Edit paper & scale
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenManual} className="gap-2 text-xs">
                    <PenLine className="size-3" />
                    Re-draw distance
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onClick={onDelete}
                    className="gap-2 text-xs text-red-600 focus:text-red-600 dark:text-red-400"
                >
                    <Trash2 className="size-3" />
                    Clear scale
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
