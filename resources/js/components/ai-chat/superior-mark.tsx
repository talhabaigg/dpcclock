import { cn } from '@/lib/utils';

interface SuperiorMarkProps {
    className?: string;
    title?: string;
}

/**
 * Monochrome rendition of the Superior "S" monogram.
 * Uses currentColor so it inherits text color and adapts to light/dark themes.
 */
export function SuperiorMark({ className, title }: SuperiorMarkProps) {
    return (
        <svg
            viewBox="0 0 98.5 152.36"
            preserveAspectRatio="xMidYMid meet"
            className={cn('shrink-0', className)}
            fill="currentColor"
            role={title ? 'img' : 'presentation'}
            aria-hidden={title ? undefined : true}
            aria-label={title}
        >
            <polygon points="98.5 152.28 61 115.62 61 61.07 98.5 97.73 98.5 152.28" />
            <polygon points="98.49 152.36 39.32 152.36 1.68 115.54 60.86 115.54 98.49 152.36" />
            <polygon points="0 0.08 37.5 36.74 37.5 91.29 0 54.63 0 0.08" />
            <polygon points="0.01 0 59.19 0 96.82 36.82 37.64 36.82 0.01 0" />
        </svg>
    );
}
