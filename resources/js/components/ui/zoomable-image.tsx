import { Button } from '@/components/ui/button';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';

export interface ZoomControls {
    zoomIn: () => void;
    zoomOut: () => void;
    resetTransform: () => void;
}

interface ZoomableImageProps {
    src: string;
    alt?: string;
    className?: string;
    /**
     * Rendered on top of the image inside the zoom/pan transform, so it scales
     * and moves with the photo. When set, the image fills the pane with
     * object-contain so an SVG overlay using "xMidYMid meet" and the image's
     * natural viewBox lines up with the photo pixels exactly.
     */
    overlay?: React.ReactNode;
    /** Replaces the default bottom zoom pill with caller-provided controls. */
    renderControls?: (controls: ZoomControls) => React.ReactNode;
}

export function ZoomableImage({ src, alt, className, overlay, renderControls }: ZoomableImageProps) {
    return (
        <TransformWrapper
            initialScale={1}
            minScale={0.5}
            maxScale={8}
            centerOnInit
            wheel={{ step: 0.15 }}
            doubleClick={{ mode: 'reset' }}
        >
            {({ zoomIn, zoomOut, resetTransform }) => (
                <div className="relative h-full w-full">
                    <TransformComponent
                        wrapperStyle={{ width: '100%', height: '100%' }}
                        contentStyle={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                        }}
                    >
                        <img
                            src={src}
                            alt={alt ?? ''}
                            className={className ?? (overlay !== undefined ? 'h-full w-full object-contain' : 'max-h-full max-w-full object-contain')}
                            draggable={false}
                        />
                        {overlay !== undefined && <div className="pointer-events-none absolute inset-0">{overlay}</div>}
                    </TransformComponent>
                    {renderControls ? (
                        renderControls({ zoomIn: () => zoomIn(), zoomOut: () => zoomOut(), resetTransform: () => resetTransform() })
                    ) : (
                        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-background/90 p-1 shadow-md backdrop-blur">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => zoomOut()} aria-label="Zoom out">
                                <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => resetTransform()} aria-label="Reset zoom">
                                <Maximize2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => zoomIn()} aria-label="Zoom in">
                                <Plus className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </TransformWrapper>
    );
}
