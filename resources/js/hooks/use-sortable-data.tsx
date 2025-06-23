import { useMemo, useState } from 'react';

type SortState<T> = {
    field: keyof T;
    order: 'asc' | 'desc';
} | null;

export function useSortableData<T>(items: T[], initialSort: SortState<T> = null) {
    const [sort, setSort] = useState<SortState<T>>(initialSort);

    const sortedItems = useMemo(() => {
        if (!sort) return items;

        const { field, order } = sort;

        return [...items].sort((a, b) => {
            const aVal = a[field];
            const bVal = b[field];

            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return order === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }

            if (aVal < bVal) return order === 'asc' ? -1 : 1;
            if (aVal > bVal) return order === 'asc' ? 1 : -1;
            return 0;
        });
    }, [items, sort]);

    const handleSort = (field: keyof T) => {
        setSort((prev) => (prev && prev.field === field ? { field, order: prev.order === 'asc' ? 'desc' : 'asc' } : { field, order: 'asc' }));
    };

    return {
        sortedItems,
        sort,
        handleSort,
    };
}
