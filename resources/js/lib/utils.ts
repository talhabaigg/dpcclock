import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const audFormatter = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });

export function fmtCurrency(v: number): string {
    return audFormatter.format(v);
}

export function fmtPercent(v: number): string {
    return `${v.toFixed(1)}%`;
}

export function round2(n: number): number {
    return Math.round(n * 100) / 100;
}
