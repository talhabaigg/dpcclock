import PaginationComponent, { type PaginationData } from '@/components/index-pagination';
import { Head, router } from '@inertiajs/react';
import { FileText, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface MediaFile {
    id: number;
    file_name: string;
    size: number;
    collection_name: string;
}

interface SdsRecord {
    id: number;
    product_name: string;
    manufacturer: string;
    description: string | null;
    hazard_classifications: string[];
    expires_at: string;
    media: MediaFile[];
}

interface Filters {
    search?: string;
    manufacturer?: string;
}

interface Props {
    sds: { data: SdsRecord[] } & Partial<PaginationData>;
    filters: Filters;
    manufacturers: string[];
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isExpired(dateStr: string): boolean {
    return new Date(dateStr) < new Date();
}

function getOtherFiles(media: MediaFile[]): MediaFile[] {
    return media.filter((m) => m.collection_name === 'other_files');
}

export default function PublicSdsIndex({ sds, filters, manufacturers }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => {
        document.documentElement.classList.remove('dark');
        return () => {
            const saved = localStorage.getItem('appearance') as string | null;
            if (saved === 'dark' || ((!saved || saved === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
            }
        };
    }, []);

    useEffect(() => {
        clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
            if (search !== (filters.search ?? '')) {
                applyFilter('search', search);
            }
        }, 400);
        return () => clearTimeout(searchTimeout.current);
    }, [search]);

    const applyFilter = (key: string, value: string) => {
        const newFilters = { ...filters, [key]: value || undefined };
        Object.keys(newFilters).forEach((k) => {
            if (!newFilters[k as keyof Filters]) delete newFilters[k as keyof Filters];
        });
        router.get('/public/sds', newFilters, { preserveState: true, preserveScroll: true });
    };

    const clearFilters = () => {
        setSearch('');
        router.get('/public/sds', {}, { preserveState: true, preserveScroll: true });
    };

    const hasFilters = !!(filters.search || filters.manufacturer);
    const totalCount = sds.total ?? sds.data.length;

    return (
        <div className="min-h-svh bg-white font-[system-ui,_-apple-system,_sans-serif] text-gray-900">
            <Head title="SDS Register" />

            {/* Header */}
            <header className="border-b border-gray-200">
                <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-4 sm:px-6">
                    <img src="/logo.png" alt="DPC" className="h-9 w-auto" />
                    <div className="h-6 w-px bg-gray-200" />
                    <h1 className="text-base font-semibold text-gray-900">SDS Register</h1>
                </div>
            </header>

            <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
                {/* Filters */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search products or manufacturers"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="h-10 w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-0"
                        />
                    </div>
                    <select
                        value={filters.manufacturer ?? ''}
                        onChange={(e) => applyFilter('manufacturer', e.target.value)}
                        className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-gray-900 focus:outline-none sm:w-52"
                    >
                        <option value="">All manufacturers</option>
                        {manufacturers.map((m) => (
                            <option key={m} value={m}>
                                {m}
                            </option>
                        ))}
                    </select>
                    {hasFilters && (
                        <button
                            onClick={clearFilters}
                            className="inline-flex h-10 items-center justify-center gap-1 px-3 text-sm text-gray-600 hover:text-gray-900"
                        >
                            <X size={14} />
                            Clear
                        </button>
                    )}
                </div>

                {/* Count */}
                <p className="mt-4 text-xs text-gray-500">
                    {totalCount} {totalCount === 1 ? 'record' : 'records'}
                </p>

                {/* List */}
                <div className="mt-2 divide-y divide-gray-200 border-y border-gray-200">
                    {sds.data.length === 0 && (
                        <div className="py-12 text-center text-sm text-gray-500">No SDS records found.</div>
                    )}
                    {sds.data.map((record) => {
                        const otherFiles = getOtherFiles(record.media);
                        const expired = isExpired(record.expires_at);
                        return (
                            <div key={record.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-baseline gap-2">
                                        <h3 className="truncate text-sm font-medium text-gray-900">{record.product_name}</h3>
                                        {expired && <span className="shrink-0 text-xs text-red-600">Expired</span>}
                                    </div>
                                    <p className="mt-0.5 truncate text-xs text-gray-500">
                                        {record.manufacturer}
                                        <span className="mx-1.5 text-gray-300">·</span>
                                        Expires {formatDate(record.expires_at)}
                                    </p>
                                    {record.hazard_classifications && record.hazard_classifications.length > 0 && (
                                        <div className="mt-1.5 flex flex-wrap gap-1">
                                            {record.hazard_classifications.map((h) => (
                                                <span
                                                    key={h}
                                                    className="inline-flex items-center rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-600"
                                                >
                                                    {h}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {otherFiles.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                                            {otherFiles.map((f) => (
                                                <a
                                                    key={f.id}
                                                    href={`/public/sds/${record.id}/files/${f.id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 hover:underline"
                                                >
                                                    <FileText size={11} />
                                                    {f.file_name}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <a
                                    href={`/public/sds/${record.id}/download`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-900 hover:bg-gray-50 sm:w-auto"
                                >
                                    View SDS
                                </a>
                            </div>
                        );
                    })}
                </div>

                {sds.data.length > 0 && (
                    <div className="mt-6">
                        <PaginationComponent pagination={sds as PaginationData} />
                    </div>
                )}
            </main>

            <footer className="border-t border-gray-200">
                <div className="mx-auto max-w-4xl px-4 py-4 text-center text-xs text-gray-500 sm:px-6">
                    For safety enquiries, contact your site supervisor.
                </div>
            </footer>
        </div>
    );
}
