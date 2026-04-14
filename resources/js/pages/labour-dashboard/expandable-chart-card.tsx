import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Maximize2 } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

interface ExpandableChartCardProps {
    title: string;
    description?: string;
    cardHeight?: number;
    dialogHeight?: number;
    children: (args: { height: number; width: number }) => ReactNode;
}

function ChartSlot({ height, children }: { height: number; children: (args: { height: number; width: number }) => ReactNode }) {
    const ref = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        setWidth(el.clientWidth);
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) setWidth(entry.contentRect.width);
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <div ref={ref} className="w-full">
            {children({ height, width })}
        </div>
    );
}

export default function ExpandableChartCard({
    title,
    description,
    cardHeight = 260,
    dialogHeight = 600,
    children,
}: ExpandableChartCardProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Card>
                <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <CardTitle className="text-sm">{title}</CardTitle>
                            {description && <p className="text-xs text-muted-foreground">{description}</p>}
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="-mt-1 h-7 w-7 shrink-0 text-muted-foreground"
                            onClick={() => setOpen(true)}
                            aria-label={`Expand ${title}`}
                        >
                            <Maximize2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <ChartSlot height={cardHeight}>{children}</ChartSlot>
                </CardContent>
            </Card>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="flex max-h-[95vh] w-[95vw] max-w-[95vw] flex-col gap-4 p-6 sm:max-w-[95vw]">
                    <DialogHeader>
                        <DialogTitle className="text-base">{title}</DialogTitle>
                        {description && <p className="text-xs text-muted-foreground">{description}</p>}
                    </DialogHeader>
                    <div className="min-h-0 flex-1 overflow-auto">
                        <ChartSlot height={dialogHeight}>{children}</ChartSlot>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

/**
 * Given a container width and number of data points, return a recharts-compatible
 * `interval` that avoids x-axis label overlap.
 */
export function computeTickInterval(width: number, dataLength: number, labelWidthPx = 60): number {
    if (dataLength === 0 || width === 0) return 0;
    const maxLabels = Math.max(2, Math.floor(width / labelWidthPx));
    if (dataLength <= maxLabels) return 0;
    return Math.ceil(dataLength / maxLabels) - 1;
}
