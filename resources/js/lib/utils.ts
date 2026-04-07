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

export function isNavItemActive(href: string, currentUrl: string): boolean {
    const url = currentUrl.split('?')[0];
    if (href === '/dashboard') return url === '/dashboard';
    return url === href || url.startsWith(href + '/');
}
