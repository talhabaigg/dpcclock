import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Expand, Monitor } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface AgentScreenshotViewportProps {
    screenshotUrl: string | null;
    stepLabel: string;
    timestamp: string;
    isWorking: boolean;
}

export default function AgentScreenshotViewport({
    screenshotUrl,
    stepLabel,
    timestamp,
    isWorking,
}: AgentScreenshotViewportProps) {
    const [currentUrl, setCurrentUrl] = useState<string | null>(null);
    const [previousUrl, setPreviousUrl] = useState<string | null>(null);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Cross-fade when screenshot changes
    useEffect(() => {
        if (screenshotUrl === currentUrl) return;

        if (currentUrl) {
            setPreviousUrl(currentUrl);
            setIsTransitioning(true);

            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                setPreviousUrl(null);
                setIsTransitioning(false);
            }, 400);
        }

        setCurrentUrl(screenshotUrl);

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [screenshotUrl]);

    const time = timestamp
        ? new Date(timestamp).toLocaleTimeString('en-AU', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
          })
        : '';

    // Empty state
    if (!currentUrl) {
        return (
            <div className="relative flex aspect-video w-full items-center justify-center bg-slate-950">
                <div className="flex flex-col items-center gap-3 text-slate-500">
                    <Monitor className="h-10 w-10" />
                    <div className="text-center">
                        <p className="text-sm font-medium">Waiting for first screenshot...</p>
                        <p className="mt-1 text-xs text-slate-600">The agent is starting up</p>
                    </div>
                    <Skeleton className="h-2 w-32 bg-slate-800" />
                </div>
            </div>
        );
    }

    return (
        <Dialog>
            <div className="group relative w-full overflow-hidden bg-slate-950">
                {/* Previous screenshot (fading out) */}
                {previousUrl && isTransitioning && (
                    <img
                        src={previousUrl}
                        alt="Previous step"
                        className="absolute inset-0 h-full w-full object-contain transition-opacity duration-400"
                        style={{ opacity: 0 }}
                    />
                )}

                {/* Current screenshot */}
                <img
                    src={currentUrl}
                    alt={stepLabel}
                    className="h-full w-full object-contain transition-opacity duration-400"
                    style={{ opacity: isTransitioning ? 0.3 : 1 }}
                    loading="eager"
                    onLoad={() => {
                        if (isTransitioning) {
                            // Force visible after load
                            setIsTransitioning(false);
                            setPreviousUrl(null);
                        }
                    }}
                />

                {/* Scan-line overlay while working */}
                {isWorking && (
                    <div className="pointer-events-none absolute inset-0 overflow-hidden">
                        <div className="agent-scanline absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />
                    </div>
                )}

                {/* Step label overlay */}
                <div className="absolute bottom-0 inset-x-0 flex items-end justify-between bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 pb-3 pt-8 sm:px-4">
                    <span className="rounded bg-black/50 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm sm:text-sm">
                        {stepLabel}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 sm:text-xs">{time}</span>
                </div>

                {/* Expand hint on hover */}
                <DialogTrigger asChild>
                    <button className="absolute inset-0 flex cursor-zoom-in items-center justify-center bg-black/0 transition-all group-hover:bg-black/10">
                        <div className="rounded-full bg-black/60 p-2.5 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                            <Expand className="h-5 w-5 text-white" />
                        </div>
                    </button>
                </DialogTrigger>
            </div>

            <DialogContent className="max-w-7xl">
                <DialogHeader>
                    <DialogTitle>{stepLabel}</DialogTitle>
                </DialogHeader>
                <img src={currentUrl} alt={stepLabel} className="w-full rounded-lg border" />
            </DialogContent>
        </Dialog>
    );
}
