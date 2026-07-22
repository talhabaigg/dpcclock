import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toolButtonClass } from '@/components/viewer-tool-rail';
import { cn } from '@/lib/utils';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Registry-driven layers panel: the eye button opens a tree of toggleable
 * layers. Pages compose the defs — Tasks, Annotations (with per-color
 * children), and any future layers (hyperlinks, measurements) are just more
 * entries; the panel never needs to know what a layer is.
 */
export type LayerDef = {
    id: string;
    label: string;
    visible: boolean;
    onToggle: (visible: boolean) => void;
    /** Color dot rendered before the label (per-color annotation rows). */
    swatch?: string;
    children?: LayerDef[];
};

export function LayersPanelButton({ layers, side = 'right' }: { layers: LayerDef[]; side?: 'right' | 'bottom' }) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className={toolButtonClass()} title="Layers">
                    <Eye className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent side={side} align="start" className="w-56 p-1.5">
                <div className="text-muted-foreground px-2 pt-1 pb-1.5 text-[11px] font-medium tracking-wide uppercase">Layers</div>
                <div className="flex flex-col">
                    {layers.map((layer) => (
                        <LayerRow key={layer.id} layer={layer} depth={0} parentVisible />
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}

function LayerRow({ layer, depth, parentVisible }: { layer: LayerDef; depth: number; parentVisible: boolean }) {
    const effectiveDim = !parentVisible || !layer.visible;
    return (
        <>
            <button
                type="button"
                onClick={() => layer.onToggle(!layer.visible)}
                className={cn(
                    'hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
                    effectiveDim && 'text-muted-foreground',
                )}
                style={{ paddingLeft: `${8 + depth * 16}px` }}
            >
                {layer.visible && parentVisible ? <Eye className="h-3.5 w-3.5 shrink-0" /> : <EyeOff className="h-3.5 w-3.5 shrink-0 opacity-60" />}
                {layer.swatch && (
                    <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/10"
                        style={{ backgroundColor: layer.swatch, opacity: effectiveDim ? 0.4 : 1 }}
                    />
                )}
                <span className="truncate">{layer.label}</span>
            </button>
            {layer.children?.map((child) => (
                <LayerRow key={child.id} layer={child} depth={depth + 1} parentVisible={parentVisible && layer.visible} />
            ))}
        </>
    );
}
