import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { formatCurrency } from './dashboard-utils';

const MAX_FONT = 9;
const MIN_FONT = 7;

function useFitToContainer(deps: unknown[]) {
    const containerRef = useRef<HTMLDivElement>(null);
    const tableRef = useRef<HTMLTableElement>(null);
    const [fontSize, setFontSize] = useState(MAX_FONT);

    useLayoutEffect(() => {
        const container = containerRef.current;
        const table = tableRef.current;
        if (!container || !table) return;

        const fit = () => {
            // Subtract a small buffer to absorb sub-pixel rounding (scrollHeight is integer,
            // but actual layout can be fractional — without this, a 100.5px table reports
            // scrollHeight=100, "fits" a 100px container, then the last row clips by 0.5px).
            const available = container.clientHeight - 2;
            for (let size = MAX_FONT; size >= MIN_FONT; size--) {
                table.style.fontSize = `${size}px`;
                if (table.scrollHeight <= available) {
                    setFontSize(size);
                    return;
                }
            }
            setFontSize(MIN_FONT);
        };

        fit();
        const ro = new ResizeObserver(fit);
        ro.observe(container);
        return () => ro.disconnect();
         
    }, deps);

    useEffect(() => {
        if (tableRef.current) tableRef.current.style.fontSize = `${fontSize}px`;
    }, [fontSize]);

    return { containerRef, tableRef, fontSize };
}

interface VariationRow {
    status: string;
    type: string;
    qty: number;
    value: number;
    percent_of_total: number;
    aging_over_30: number | null;
    aging_over_30_value: number | null;
}

interface TypeGroup {
    type: string;
    qty: number;
    value: number;
    aging: number;
}

interface VariationsCardProps {
    data: VariationRow[];
    locationId?: number;
    isEditing?: boolean;
}

const VISIBLE_STATUSES = ['pending', 'approved'];

const TYPE_LABEL: Record<string, string> = {
    yet2submit: 'Yet to Submit',
    pending: 'Pending',
    approved: 'Approved',
    'n/a': 'Type Missing',
};

function typeLabel(type: string) {
    const key = type?.toLowerCase();
    if (TYPE_LABEL[key]) return TYPE_LABEL[key];
    if (!type) return type;
    if (type.length <= 3) return type.toUpperCase();
    return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

export default function VariationsCard({ data, locationId, isEditing }: VariationsCardProps) {
    const filtered = useMemo(() => data.filter(r => VISIBLE_STATUSES.includes(r.status?.toLowerCase())), [data]);

    const drillDown = (params: { status?: string; type?: string }) => {
        if (!locationId) return;
        const url = `/locations/${locationId}/variations`;
        const query: Record<string, string> = {};
        if (params.status) query.status = params.status;
        if (params.type) query.type = params.type;
        router.get(url, query);
    };

    const typeGroups = useMemo<TypeGroup[]>(() => {
        const map = new Map<string, TypeGroup>();
        for (const row of filtered) {
            const typeKey = row.type?.toLowerCase() ?? 'unknown';
            if (!map.has(typeKey)) {
                map.set(typeKey, { type: row.type, qty: 0, value: 0, aging: 0 });
            }
            const group = map.get(typeKey)!;
            group.qty += row.qty;
            group.value += row.value;
            group.aging += row.aging_over_30 ?? 0;
        }
        return [...map.values()].sort((a, b) => b.value - a.value);
    }, [filtered]);

    const totalQty = filtered.reduce((sum, row) => sum + row.qty, 0);
    const totalValue = filtered.reduce((sum, row) => sum + row.value, 0);
    const totalAging = filtered.reduce((sum, row) => sum + (row.aging_over_30 ?? 0), 0);

    const { containerRef, tableRef } = useFitToContainer([typeGroups.length, filtered.length]);

    return (
        <div className="h-full overflow-hidden flex flex-col">
            {filtered.length === 0 ? (
                <>
                    <div
                        className={cn(
                            'flex items-center w-full px-2 py-1 min-h-7 shrink-0',
                            isEditing && 'drag-handle cursor-grab active:cursor-grabbing',
                        )}
                    >
                        <span className="font-extrabold leading-none">Variations</span>
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                        <span className="text-[11px] text-muted-foreground">No variations found.</span>
                    </div>
                </>
            ) : (
                <div ref={containerRef} className="h-full flex-1 min-h-0 overflow-hidden rounded-md border border-border">
                    <table ref={tableRef} className="w-full h-full border-collapse leading-tight">
                        <thead>
                            <tr>
                                <th
                                    colSpan={5}
                                    className={cn(
                                        'text-left py-1 px-2 font-extrabold leading-none',
                                        isEditing && 'drag-handle cursor-grab active:cursor-grabbing',
                                    )}
                                >
                                    Variations
                                </th>
                            </tr>
                            <tr>
                                <th className="text-left py-1 px-2 font-medium text-muted-foreground">Type</th>
                                <th className="text-right py-1 px-2 font-medium text-muted-foreground">Qty</th>
                                <th className="text-right py-1 px-2 font-medium text-muted-foreground">Value</th>
                                <th className="text-right py-1 px-2 font-medium text-muted-foreground">%</th>
                                <th className="text-right py-1 px-2 font-medium text-muted-foreground">&gt;30d</th>
                            </tr>
                        </thead>
                            <tbody>
                                {typeGroups.map((group) => (
                                    <tr key={group.type}>
                                        <td className="py-1 px-2">
                                            <button
                                                type="button"
                                                onClick={() => drillDown({ type: group.type })}
                                                className={cn(
                                                    'font-medium text-left',
                                                    locationId && 'cursor-pointer text-primary hover:underline',
                                                )}
                                            >
                                                {typeLabel(group.type)}
                                            </button>
                                        </td>
                                        <td className="text-right py-1 px-2 tabular-nums font-light">{group.qty}</td>
                                        <td className="text-right py-1 px-2 tabular-nums font-light">{formatCurrency(group.value)}</td>
                                        <td className="text-right py-1 px-2 tabular-nums font-light">{totalValue > 0 ? ((group.value / totalValue) * 100).toFixed(1) : '0.0'}%</td>
                                        <td className={cn('text-right py-1 px-2 tabular-nums font-light', group.aging > 0 && 'text-red-600 dark:text-red-400')}>{group.aging || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t">
                                    <td className="py-1 px-2 font-medium">Total</td>
                                    <td className="text-right py-1 px-2 tabular-nums font-light">{totalQty}</td>
                                    <td className="text-right py-1 px-2 tabular-nums font-light">{formatCurrency(totalValue)}</td>
                                    <td className="text-right py-1 px-2 tabular-nums font-light">100%</td>
                                    <td className={cn('text-right py-1 px-2 tabular-nums font-light', totalAging > 0 && 'text-red-600 dark:text-red-400')}>{totalAging || '-'}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
        </div>
    );
}
