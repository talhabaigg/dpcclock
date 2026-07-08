import { FileText, Loader2 } from 'lucide-react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import { useEffect, useRef, useState } from 'react';
import pdfWorkerUrl from '../../pdf-worker-with-polyfill?worker&url';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfThumbnailProps {
    url: string;
    targetWidth?: number;
    className?: string;
    fallbackClassName?: string;
}

export function PdfThumbnail({
    url,
    targetWidth = 360,
    className = 'h-full w-full object-cover object-top',
    fallbackClassName = 'text-muted-foreground h-10 w-10',
}: PdfThumbnailProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

    useEffect(() => {
        let cancelled = false;
        setState('loading');
        const task = getDocument(url);

        task.promise
            .then(async (pdf) => {
                if (cancelled) return;
                const page = await pdf.getPage(1);
                if (cancelled || !canvasRef.current) return;

                const baseViewport = page.getViewport({ scale: 1 });
                const scale = targetWidth / baseViewport.width;
                const viewport = page.getViewport({ scale });

                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');
                if (!context) return;

                canvas.width = viewport.width;
                canvas.height = viewport.height;

                await page.render({ canvas, canvasContext: context, viewport }).promise;
                if (!cancelled) setState('ready');
            })
            .catch(() => {
                if (!cancelled) setState('error');
            });

        return () => {
            cancelled = true;
            task.destroy();
        };
    }, [url, targetWidth]);

    if (state === 'error') {
        return <FileText className={fallbackClassName} />;
    }
    return (
        <>
            {state === 'loading' && <Loader2 className="text-muted-foreground absolute h-4 w-4 animate-spin" />}
            <canvas
                ref={canvasRef}
                className={`${className} ${state === 'ready' ? 'opacity-100' : 'opacity-0'}`}
            />
        </>
    );
}
