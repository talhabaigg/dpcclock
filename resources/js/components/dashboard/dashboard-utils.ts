import { useEffect, useRef, useState } from 'react';

// ── Currency formatters ──

export const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);

export const formatCompact = (value: number) => {
    if (Math.abs(value) >= 1_000_000) {
        return new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: 'AUD',
            notation: 'compact',
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
        }).format(value);
    }
    return formatCurrency(value);
};

export const formatPercent = (value: number) => `${value.toFixed(2)}%`;

export const formatDelta = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `(${sign}${formatCompact(value)})`;
};

// ── ResizeObserver hook ──

export function useContainerSize<T extends HTMLElement = HTMLDivElement>() {
    const ref = useRef<T>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const node = ref.current;
        if (!node) return;
        const obs = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            setDimensions({ width, height });
        });
        obs.observe(node);
        return () => obs.disconnect();
    }, []);

    return { ref, ...dimensions };
}
