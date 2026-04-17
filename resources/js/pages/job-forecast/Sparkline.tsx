/**
 * Sparkline component for displaying mini trend charts
 */

import { useEffect, useRef, useState } from 'react';

interface SparklineProps {
    values: Array<number | null>;
    width?: number;
    height?: number;
}

export function Sparkline({ values, width = 72, height = 22 }: SparklineProps) {
    // Replace nulls with 0 but keep array length
    const filled = values.map((v) => (v == null ? 0 : Number(v)));

    const polylineRef = useRef<SVGPolylineElement | null>(null);
    const [drawn, setDrawn] = useState(false);

    useEffect(() => {
        if (drawn) return;
        if (typeof window === 'undefined') return;
        const prefersReduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        if (prefersReduce) {
            setDrawn(true);
            return;
        }
        const el = polylineRef.current;
        if (!el) return;
        const len = el.getTotalLength?.();
        if (!len) {
            setDrawn(true);
            return;
        }
        el.style.strokeDasharray = `${len}`;
        el.style.strokeDashoffset = `${len}`;
        el.style.transition = 'stroke-dashoffset 450ms cubic-bezier(0.22, 1, 0.36, 1)';
        requestAnimationFrame(() => {
            el.style.strokeDashoffset = '0';
        });
        const t = setTimeout(() => setDrawn(true), 500);
        return () => clearTimeout(t);
    }, [drawn]);

    // Need at least 2 points to draw
    if (filled.length < 2) {
        return <div className="bg-muted/40 h-[22px] w-[72px] rounded" />;
    }

    const min = Math.min(...filled);
    const max = Math.max(...filled);
    const range = max - min || 1;

    const xStep = (width - 2) / Math.max(filled.length - 1, 1);

    const points = filled.map((v, i) => {
        const x = 1 + i * xStep;
        const y = 1 + (height - 2) * (1 - (v - min) / range);
        return `${x.toFixed(2)},${y.toFixed(2)}`;
    });

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
            <polyline
                ref={polylineRef}
                points={points.join(' ')}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity="0.9"
            />
        </svg>
    );
}
