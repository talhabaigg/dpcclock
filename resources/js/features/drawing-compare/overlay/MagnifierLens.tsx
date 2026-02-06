import { useCallback, useEffect, useRef, useState } from 'react';

type MagnifierLensProps = {
    /** Whether the magnifier is active/visible */
    active: boolean;
    /** The canvas or image element to magnify */
    sourceElement: HTMLCanvasElement | HTMLImageElement | null;
    /** Container element for bounds checking */
    containerElement: HTMLElement | null;
    /** Magnification level (2 = 2x zoom) */
    magnification?: number;
    /** Size of the magnifier lens in pixels */
    size?: number;
    /** Border color */
    borderColor?: 'blue' | 'green';
};

type MousePosition = {
    clientX: number;
    clientY: number;
    relativeX: number;
    relativeY: number;
};

/**
 * A magnifying lens that shows a zoomed preview of the area under the cursor.
 * Useful for precise point placement during alignment.
 */
export function MagnifierLens({ active, sourceElement, containerElement, magnification = 3, size = 120, borderColor = 'blue' }: MagnifierLensProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [mousePos, setMousePos] = useState<MousePosition | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // Track mouse position within the container
    useEffect(() => {
        if (!active || !containerElement) {
            setMousePos(null);
            return;
        }

        const handleMouseMove = (e: MouseEvent) => {
            const rect = containerElement.getBoundingClientRect();
            const relativeX = e.clientX - rect.left;
            const relativeY = e.clientY - rect.top;

            // Only track if inside container bounds
            if (relativeX >= 0 && relativeX <= rect.width && relativeY >= 0 && relativeY <= rect.height) {
                setMousePos({
                    clientX: e.clientX,
                    clientY: e.clientY,
                    relativeX,
                    relativeY,
                });
            } else {
                setMousePos(null);
            }
        };

        const handleMouseLeave = () => {
            setMousePos(null);
        };

        containerElement.addEventListener('mousemove', handleMouseMove);
        containerElement.addEventListener('mouseleave', handleMouseLeave);

        return () => {
            containerElement.removeEventListener('mousemove', handleMouseMove);
            containerElement.removeEventListener('mouseleave', handleMouseLeave);
        };
    }, [active, containerElement]);

    // Render magnified content to the lens canvas
    const renderMagnifiedContent = useCallback(() => {
        if (!canvasRef.current || !sourceElement || !mousePos || !containerElement) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Get source element bounds
        const sourceRect = sourceElement.getBoundingClientRect();
        void containerElement.getBoundingClientRect(); // Keep reference for future use

        // Calculate mouse position relative to the source element
        const sourceRelativeX = mousePos.clientX - sourceRect.left;
        const sourceRelativeY = mousePos.clientY - sourceRect.top;

        // Check if mouse is over the source element
        if (sourceRelativeX < 0 || sourceRelativeX > sourceRect.width || sourceRelativeY < 0 || sourceRelativeY > sourceRect.height) {
            // Clear canvas if not over source
            ctx.clearRect(0, 0, size, size);
            ctx.fillStyle = '#1f2937';
            ctx.fillRect(0, 0, size, size);
            ctx.fillStyle = '#9ca3af';
            ctx.font = '12px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText('Move over', size / 2, size / 2 - 8);
            ctx.fillText('drawing', size / 2, size / 2 + 8);
            return;
        }

        // Set canvas size
        canvas.width = size;
        canvas.height = size;

        // Calculate source coordinates for sampling
        let sourceX: number;
        let sourceY: number;
        let sourceWidth: number;
        let sourceHeight: number;

        if (sourceElement instanceof HTMLCanvasElement) {
            // For canvas, use actual canvas dimensions
            const scaleX = sourceElement.width / sourceRect.width;
            const scaleY = sourceElement.height / sourceRect.height;
            sourceX = sourceRelativeX * scaleX;
            sourceY = sourceRelativeY * scaleY;
            sourceWidth = sourceElement.width;
            sourceHeight = sourceElement.height;
        } else {
            // For images, use natural dimensions
            const scaleX = sourceElement.naturalWidth / sourceRect.width;
            const scaleY = sourceElement.naturalHeight / sourceRect.height;
            sourceX = sourceRelativeX * scaleX;
            sourceY = sourceRelativeY * scaleY;
            sourceWidth = sourceElement.naturalWidth;
            sourceHeight = sourceElement.naturalHeight;
        }

        // Calculate the area to sample (centered on cursor)
        const sampleSize = size / magnification;
        const halfSample = sampleSize / 2;

        // Scale factor from source to sample
        const sampleScaleX =
            sourceElement instanceof HTMLCanvasElement ? sourceElement.width / sourceRect.width : sourceElement.naturalWidth / sourceRect.width;
        const sampleScaleY =
            sourceElement instanceof HTMLCanvasElement ? sourceElement.height / sourceRect.height : sourceElement.naturalHeight / sourceRect.height;

        const srcX = Math.max(0, sourceX - halfSample * sampleScaleX);
        const srcY = Math.max(0, sourceY - halfSample * sampleScaleY);
        const srcW = Math.min(sampleSize * sampleScaleX, sourceWidth - srcX);
        const srcH = Math.min(sampleSize * sampleScaleY, sourceHeight - srcY);

        // Clear and fill background
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(0, 0, size, size);

        // Draw magnified portion
        try {
            ctx.drawImage(sourceElement, srcX, srcY, srcW, srcH, 0, 0, size, size);
        } catch {
            // Handle cross-origin or other errors silently
            ctx.fillStyle = '#374151';
            ctx.fillRect(0, 0, size, size);
        }

        // Draw crosshair in center
        const centerX = size / 2;
        const centerY = size / 2;
        const crosshairSize = 16;
        const lineWidth = 1;

        ctx.strokeStyle = borderColor === 'blue' ? '#3b82f6' : '#22c55e';
        ctx.lineWidth = lineWidth;
        ctx.setLineDash([]);

        // Vertical line
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - crosshairSize / 2);
        ctx.lineTo(centerX, centerY + crosshairSize / 2);
        ctx.stroke();

        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(centerX - crosshairSize / 2, centerY);
        ctx.lineTo(centerX + crosshairSize / 2, centerY);
        ctx.stroke();

        // Center dot
        ctx.fillStyle = borderColor === 'blue' ? '#3b82f6' : '#22c55e';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 2, 0, Math.PI * 2);
        ctx.fill();
    }, [sourceElement, mousePos, containerElement, magnification, size, borderColor]);

    // Render on animation frame for smooth updates
    useEffect(() => {
        if (!active || !mousePos) {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            return;
        }

        const animate = () => {
            renderMagnifiedContent();
            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [active, mousePos, renderMagnifiedContent]);

    if (!active || !mousePos) return null;

    // Calculate lens position (offset to bottom-right of cursor, keeping within bounds)
    const offset = 20;
    let lensX = mousePos.relativeX + offset;
    let lensY = mousePos.relativeY + offset;

    // Keep lens within container bounds
    if (containerElement) {
        const containerRect = containerElement.getBoundingClientRect();
        if (lensX + size > containerRect.width) {
            lensX = mousePos.relativeX - size - offset;
        }
        if (lensY + size > containerRect.height) {
            lensY = mousePos.relativeY - size - offset;
        }
        // Also check top/left bounds
        if (lensX < 0) lensX = offset;
        if (lensY < 0) lensY = offset;
    }

    const borderColorClass = borderColor === 'blue' ? 'border-blue-500' : 'border-green-500';

    return (
        <div
            className={`pointer-events-none absolute z-50 overflow-hidden rounded-lg border-2 shadow-xl ${borderColorClass}`}
            style={{
                left: lensX,
                top: lensY,
                width: size,
                height: size,
            }}
        >
            <canvas ref={canvasRef} width={size} height={size} className="block" />
            {/* Magnification label */}
            <div className="absolute right-1 bottom-1 rounded bg-black/70 px-1 text-xs text-white">{magnification}x</div>
        </div>
    );
}
