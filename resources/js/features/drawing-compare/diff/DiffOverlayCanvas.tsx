/**
 * DiffOverlayCanvas Component
 *
 * Renders the difference mask as a canvas overlay on the drawing.
 */

import { useEffect, useRef } from 'react';

type DiffOverlayCanvasProps = {
    /** The pre-computed diff canvas with the mask */
    diffCanvas: HTMLCanvasElement | null;
    /** Whether to show the overlay */
    visible: boolean;
    /** Opacity of the overlay (0-1) */
    opacity?: number;
    /** Additional CSS class names */
    className?: string;
    /** Explicit display width (overrides auto-calculation) */
    displayWidth?: number;
    /** Explicit display height (overrides auto-calculation) */
    displayHeight?: number;
};

/**
 * Renders the diff mask overlay on top of the drawing.
 * The mask canvas is rendered into a visible canvas element.
 */
export function DiffOverlayCanvas({
    diffCanvas,
    visible,
    opacity = 0.7,
    className = '',
    displayWidth,
    displayHeight,
}: DiffOverlayCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Copy the diff canvas content to our visible canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !diffCanvas || !visible) {
            return;
        }

        // Match dimensions
        if (canvas.width !== diffCanvas.width || canvas.height !== diffCanvas.height) {
            canvas.width = diffCanvas.width;
            canvas.height = diffCanvas.height;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear and draw the diff mask
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(diffCanvas, 0, 0);
    }, [diffCanvas, visible]);

    if (!visible || !diffCanvas) {
        return null;
    }

    // Calculate display size - use explicit props if provided, otherwise use devicePixelRatio
    const width = displayWidth ?? diffCanvas.width / (window.devicePixelRatio || 1);
    const height = displayHeight ?? diffCanvas.height / (window.devicePixelRatio || 1);

    return (
        <canvas
            ref={canvasRef}
            className={`absolute left-0 top-0 pointer-events-none ${className}`}
            style={{
                opacity,
                width,
                height,
            }}
        />
    );
}
