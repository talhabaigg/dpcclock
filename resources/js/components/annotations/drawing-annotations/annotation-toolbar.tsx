import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToolButton, ToolGroup, toolButtonClass } from '@/components/viewer-tool-rail';
import { cn } from '@/lib/utils';
import { Circle, Cloud, Link2, MousePointer2, MoveDiagonal, MoveUpRight, Pencil, Shapes, Signature, Slash, Spline, Square, Type } from 'lucide-react';
import { useState, type ComponentType } from 'react';
import { ANNOTATION_COLORS } from '../photo-annotations';
import type { AnnotationTool } from './types';
import type { AnnotationLayerApi } from './use-annotation-layer';

/**
 * Drop-in toolbar groups for the annotation layer. `layout` controls popover
 * side: 'vertical' for the plan page's left rail, 'horizontal' for takeoff's
 * top bar. Render inside the host toolbar next to its own groups.
 */

type IconType = ComponentType<{ className?: string }>;

const MARKUP_TOOLS: Array<{ tool: AnnotationTool; label: string; icon: IconType }> = [
    { tool: 'freehand', label: 'Free draw', icon: Signature },
    { tool: 'line', label: 'Line', icon: Slash },
    { tool: 'arrow', label: 'Arrow', icon: MoveUpRight },
    { tool: 'double_arrow', label: 'Double arrow', icon: MoveDiagonal },
    { tool: 'polyline', label: 'Multi-point line', icon: Spline },
];

const SHAPE_TOOLS: Array<{ tool: AnnotationTool; label: string; icon: IconType }> = [
    { tool: 'cloud', label: 'Cloud', icon: Cloud },
    { tool: 'rect', label: 'Rectangle', icon: Square },
    { tool: 'ellipse', label: 'Circle', icon: Circle },
];

const ALL_TOOLS = [...MARKUP_TOOLS, ...SHAPE_TOOLS];

export function AnnotationToolGroups({ api, layout }: { api: AnnotationLayerApi; layout: 'vertical' | 'horizontal' }) {
    const side = layout === 'vertical' ? 'right' : 'bottom';
    const [markupOpen, setMarkupOpen] = useState(false);
    const [shapesOpen, setShapesOpen] = useState(false);
    const [colorOpen, setColorOpen] = useState(false);

    const activeMarkup = MARKUP_TOOLS.find((t) => t.tool === api.tool);
    const activeShape = SHAPE_TOOLS.find((t) => t.tool === api.tool);
    const MarkupIcon = activeMarkup?.icon ?? Pencil;
    const ShapesIcon = activeShape?.icon ?? Shapes;

    const pick = (tool: AnnotationTool) => {
        api.setTool(api.tool === tool ? null : tool);
        setMarkupOpen(false);
        setShapesOpen(false);
    };

    return (
        <ToolGroup orientation={layout}>
            {api.canEdit && (
                <>
                    {/* Markup (draw) tools */}
                    <Popover open={markupOpen} onOpenChange={setMarkupOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                type="button"
                                variant={activeMarkup ? 'default' : 'ghost'}
                                size="sm"
                                className={toolButtonClass(!!activeMarkup)}
                                title={activeMarkup ? activeMarkup.label : 'Markup'}
                            >
                                <MarkupIcon className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent side={side} align="start" className="w-auto p-1">
                            <ToolPickerRow tools={MARKUP_TOOLS} activeTool={api.tool} onPick={pick} />
                        </PopoverContent>
                    </Popover>

                    {/* Shapes */}
                    <Popover open={shapesOpen} onOpenChange={setShapesOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                type="button"
                                variant={activeShape ? 'default' : 'ghost'}
                                size="sm"
                                className={toolButtonClass(!!activeShape)}
                                title={activeShape ? activeShape.label : 'Shapes'}
                            >
                                <ShapesIcon className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent side={side} align="start" className="w-auto p-1">
                            <div className="flex flex-col gap-1">
                                <ToolPickerRow tools={SHAPE_TOOLS} activeTool={api.tool} onPick={pick} />
                                <div className="flex items-center gap-1 border-t px-1 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => api.setFilled(false)}
                                        className={cn(
                                            'flex-1 rounded-sm px-2 py-1 text-xs',
                                            !api.filled ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
                                        )}
                                    >
                                        Outline
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => api.setFilled(true)}
                                        className={cn(
                                            'flex-1 rounded-sm px-2 py-1 text-xs',
                                            api.filled ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
                                        )}
                                    >
                                        Filled
                                    </button>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Text box */}
                    <ToolButton title="Text box" active={api.tool === 'text'} onClick={() => pick('text')}>
                        <Type className="h-4 w-4" />
                    </ToolButton>

                    {/* Plan hyperlink */}
                    {api.linkEnabled && (
                        <ToolButton
                            title="Link to plan (click to place, then pick the target)"
                            active={api.tool === 'link'}
                            onClick={() => pick('link')}
                        >
                            <Link2 className="h-4 w-4" />
                        </ToolButton>
                    )}

                    {/* Color */}
                    <Popover open={colorOpen} onOpenChange={setColorOpen}>
                        <PopoverTrigger asChild>
                            <Button type="button" variant="ghost" size="sm" className={toolButtonClass()} title="Annotation color">
                                <span className="h-4 w-4 rounded-full border border-black/20" style={{ backgroundColor: api.color }} />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent side={side} align="start" className="w-auto p-1.5">
                            <div className="grid grid-cols-5 gap-1">
                                {ANNOTATION_COLORS.map((c) => (
                                    <button
                                        key={c.value}
                                        type="button"
                                        title={c.name}
                                        onClick={() => {
                                            api.setColor(c.value);
                                            setColorOpen(false);
                                        }}
                                        className={cn(
                                            'h-6 w-6 rounded-full border border-black/20 transition-transform hover:scale-110',
                                            api.color === c.value && 'ring-primary ring-2 ring-offset-1',
                                        )}
                                        style={{ backgroundColor: c.value }}
                                    />
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>
                </>
            )}

            {/* Select */}
            <ToolButton
                title={
                    ALL_TOOLS.some((t) => t.tool === api.tool) ? 'Select annotations' : 'Select annotations (click one to select, Delete to remove)'
                }
                active={api.tool === 'select'}
                onClick={() => api.setTool(api.tool === 'select' ? null : 'select')}
            >
                <MousePointer2 className="h-4 w-4" />
            </ToolButton>
        </ToolGroup>
    );
}

function ToolPickerRow({
    tools,
    activeTool,
    onPick,
}: {
    tools: Array<{ tool: AnnotationTool; label: string; icon: IconType }>;
    activeTool: AnnotationTool | null;
    onPick: (tool: AnnotationTool) => void;
}) {
    return (
        <div className="flex gap-0.5">
            {tools.map(({ tool, label, icon: Icon }) => (
                <button
                    key={tool}
                    type="button"
                    title={label}
                    onClick={() => onPick(tool)}
                    className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-sm',
                        activeTool === tool ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
                    )}
                >
                    <Icon className="h-4 w-4" />
                </button>
            ))}
        </div>
    );
}
