import 'pannellum/build/pannellum.css';
import 'pannellum/build/pannellum.js';
import { Maximize } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from './ui/button';

type PanoramaViewerProps = {
    imageUrl: string;
    className?: string;
    compact?: boolean;
};

export function PanoramaViewer({ imageUrl, className = '', compact = false }: PanoramaViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<PannellumViewer | null>(null);

    useEffect(() => {
        if (!containerRef.current || !imageUrl) return;

        const viewer = window.pannellum.viewer(containerRef.current, {
            type: 'equirectangular',
            panorama: imageUrl,
            autoLoad: true,
            showControls: !compact,
            showFullscreenCtrl: !compact,
            showZoomCtrl: !compact,
            mouseZoom: true,
            hfov: 100,
            minHfov: 30,
            maxHfov: 120,
            compass: false,
        });

        viewerRef.current = viewer;

        return () => {
            viewer.destroy();
            viewerRef.current = null;
        };
    }, [imageUrl, compact]);

    const handleFullscreen = () => {
        viewerRef.current?.toggleFullscreen();
    };

    return (
        <div className={`relative ${className}`}>
            <div ref={containerRef} className="h-full w-full" />
            {compact && (
                <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-2 bottom-2 h-7 w-7 opacity-80 hover:opacity-100"
                    onClick={handleFullscreen}
                    title="View 360 fullscreen"
                    type="button"
                >
                    <Maximize className="h-3.5 w-3.5" />
                </Button>
            )}
        </div>
    );
}
