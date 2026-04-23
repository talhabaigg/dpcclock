import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { format } from 'date-fns';
import Echo from 'laravel-echo';
import {
    AlertCircle,
    ArrowUp,
    CalendarIcon,
    CloudDownload,
    Download,
    FileText,
    Filter,
    Loader2,
    Printer,
    RefreshCw,
    Square,
} from 'lucide-react';
import Papa from 'papaparse';
import Pusher from 'pusher-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DateRange } from 'react-day-picker';
import ReactMarkdown from 'react-markdown';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Reports', href: '/reports' },
    { title: 'PO Comparison Report', href: '/reports/po-comparison' },
];

type FilterOptions = {
    locations: { id: number; name: string; external_id: string }[];
    suppliers: { id: number; name: string; code: string }[];
    statuses: string[];
};

type Totals = {
    original: number;
    premier: number;
    invoiced: number;
    variance: number;
    variance_percent: number;
    remaining: number;
};

type Summary = {
    unchanged_count: number;
    modified_count: number;
    added_count: number;
    removed_count: number;
    total_items: number;
    total_variance: number;
    has_discrepancies: boolean;
};

type ReportItem = {
    requisition: {
        id: number;
        po_number: string;
        created_at: string;
        date_required: string;
        status: string;
        requested_by: string;
        order_reference: string;
    };
    location: { id: number; name: string; external_id: string };
    supplier: { id: number; name: string; code: string };
    totals: Totals;
    summary: Summary;
    comparison: any[];
    invoices: any;
};

type AggregateStats = {
    total_pos: number;
    pos_with_variances: number;
    total_original_value: number;
    total_premier_value: number;
    total_invoiced_value: number;
    total_variance: number;
    items_added: number;
    items_removed: number;
    items_modified: number;
    items_unchanged: number;
    unit_cost_increases: number;
    unit_cost_decreases: number;
    quantity_increases: number;
    quantity_decreases: number;
    variance_percent: number;
    price_list_violations: number;
    price_list_violation_value: number;
};

type PriceListViolation = {
    description: string;
    price_list: string;
    original_unit_cost: number;
    current_unit_cost: number;
    difference: number;
    total_impact: number;
};

type POViolation = {
    po_number: string;
    supplier: string;
    location: string;
    violations: PriceListViolation[];
};

type ChatMessage = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    status: 'sending' | 'streaming' | 'complete' | 'error';
};

type SyncStatus = {
    total: number;
    cached: number;
    stale: number;
    missing: number;
    needs_sync: number;
    ready_percent: number;
};

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 2,
    }).format(value);
};

const formatPercent = (value: number) => {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
};

export default function POComparisonReport() {
    const { filterOptions, initialFilters } = usePage<{
        filterOptions: FilterOptions;
        initialFilters: Record<string, any>;
    }>().props;

    // Filter state
    const [locationId, setLocationId] = useState<string>(initialFilters?.location_id?.toString() || 'all');
    const [supplierId, setSupplierId] = useState<string>(initialFilters?.supplier_id?.toString() || 'all');
    const [status, setStatus] = useState<string>(initialFilters?.status || 'all');
    const [poNumber, setPoNumber] = useState<string>(initialFilters?.po_number || '');
    const [minVariance, setMinVariance] = useState<string>(initialFilters?.min_variance?.toString() || '');
    const [onlyDiscrepancies, setOnlyDiscrepancies] = useState<boolean>(initialFilters?.only_discrepancies || false);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(
        initialFilters?.date_from && initialFilters?.date_to
            ? {
                  from: new Date(initialFilters.date_from),
                  to: new Date(initialFilters.date_to),
              }
            : undefined,
    );

    // Data state
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState<ReportItem[]>([]);
    const [aggregate, setAggregate] = useState<AggregateStats | null>(null);
    const [priceListViolations, setPriceListViolations] = useState<POViolation[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);

    // AI insights chat state
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [insightsLoading, setInsightsLoading] = useState(false);
    const [insightsError, setInsightsError] = useState<string | null>(null);
    const [followUpQuestion, setFollowUpQuestion] = useState('');
    const [followUpLoading, setFollowUpLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // AI summary data (prepared by backend to avoid re-fetching)
    const [aiSummaryData, setAiSummaryData] = useState<Record<string, any> | null>(null);

    // Sync status state
    const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
    const [syncStatusLoading, setSyncStatusLoading] = useState(false);
    const [syncQueueLoading, setSyncQueueLoading] = useState(false);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncedPo, setLastSyncedPo] = useState<string | null>(null);
    const [isWsConnected, setIsWsConnected] = useState(false);
    const echoRef = useRef<any>(null);

    const buildFilters = useCallback(() => {
        const filters: Record<string, any> = {};
        if (locationId && locationId !== 'all') filters.location_id = parseInt(locationId);
        if (supplierId && supplierId !== 'all') filters.supplier_id = parseInt(supplierId);
        if (status && status !== 'all') filters.status = status;
        if (poNumber) filters.po_number = poNumber;
        if (minVariance) filters.min_variance = parseFloat(minVariance);
        if (onlyDiscrepancies) filters.only_discrepancies = true;
        if (dateRange?.from) filters.date_from = format(dateRange.from, 'yyyy-MM-dd');
        if (dateRange?.to) filters.date_to = format(dateRange.to, 'yyyy-MM-dd');
        return filters;
    }, [locationId, supplierId, status, poNumber, minVariance, onlyDiscrepancies, dateRange]);

    // Subscribe to real-time sync progress updates
    useEffect(() => {
        // Initialize Pusher and Laravel Echo
        window.Pusher = Pusher;

        const echo = new Echo({
            broadcaster: 'reverb',
            key: import.meta.env.VITE_REVERB_APP_KEY,
            wsHost: import.meta.env.VITE_REVERB_HOST,
            wsPort: import.meta.env.VITE_REVERB_PORT,
            forceTLS: false,
            enabledTransports: ['ws'],
            disableStats: true,
        });
        echoRef.current = echo;

        // Add connection state listeners
        echo.connector.pusher.connection.bind('connected', () => {
            setIsWsConnected(true);
        });

        echo.connector.pusher.connection.bind('error', () => {
            setIsWsConnected(false);
        });

        echo.connector.pusher.connection.bind('disconnected', () => {
            setIsWsConnected(false);
        });

        // Listen to premier-sync channel
        const channel = echo.channel('premier-sync');

        channel.subscribed(() => {
            setIsWsConnected(true);
        });

        channel.error(() => {
            setIsWsConnected(false);
        });

        channel.listen(
            '.sync.progress',
            (event: {
                cached: number;
                total: number;
                missing: number;
                stale: number;
                needs_sync: number;
                ready_percent: number;
                last_synced_po: string | null;
                status: string;
            }) => {
                setSyncStatus({
                    cached: event.cached,
                    total: event.total,
                    missing: event.missing,
                    stale: event.stale,
                    needs_sync: event.needs_sync,
                    ready_percent: event.ready_percent,
                });
                setLastSyncedPo(event.last_synced_po);

                // Stop syncing when completed OR when 100% and no more POs to sync
                const isDone = event.status === 'completed' || (event.ready_percent >= 100 && event.needs_sync === 0);
                setIsSyncing(!isDone);

                if (isDone) {
                    setSyncMessage('Sync completed');
                    setTimeout(() => setSyncMessage(null), 3000);
                }
            },
        );

        return () => {
            channel.stopListening('.sync.progress');
            echo.leave('premier-sync');
            echo.disconnect();
        };
    }, []);

    const fetchReportData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const filters = buildFilters();
            const queryParams = new URLSearchParams(filters as Record<string, string>).toString();
            const response = await fetch(`/reports/po-comparison/data?${queryParams}`, {
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
            });

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch report data');
            }

            setReportData(data.items || []);
            setAggregate(data.aggregate || null);
            setPriceListViolations(data.price_list_violations || []);
            setAiSummaryData(data.ai_summary_data || null);
        } catch (err: any) {
            setError(err.message || 'An error occurred');
            setReportData([]);
            setAggregate(null);
            setPriceListViolations([]);
            setAiSummaryData(null);
        } finally {
            setLoading(false);
        }
    }, [buildFilters]);

    // Helper to generate unique message IDs
    const generateMessageId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Abort controller ref for cancelling streams
    const abortControllerRef = useRef<AbortController | null>(null);

    // Helper to parse SSE events
    const parseSSEEvent = (raw: string): { type: string; data: any } | null => {
        if (!raw.trim()) return null;

        const lines = raw.split('\n');
        let eventName: string | null = null;
        let dataLine: string | null = null;

        for (const line of lines) {
            if (line.startsWith('event:')) {
                eventName = line.slice('event:'.length).trim();
            } else if (line.startsWith('data:')) {
                dataLine = line.slice('data:'.length).trim();
            }
        }

        if (!dataLine) return null;

        try {
            const payload = JSON.parse(dataLine);

            if (eventName === 'done') {
                return { type: 'done', data: payload };
            }

            if (payload.delta !== undefined) {
                return { type: 'delta', data: payload };
            }

            if (payload.error) {
                return { type: 'error', data: payload };
            }
        } catch {
            // Invalid JSON, skip
        }

        return null;
    };

    // Stream insights from the API
    const fetchInsights = useCallback(async () => {
        if (!aiSummaryData) {
            setInsightsError('No report data available. Please generate the report first.');
            return;
        }

        // Cancel any existing stream
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        setInsightsLoading(true);
        setInsightsError(null);

        // Create streaming assistant message
        const assistantId = generateMessageId();
        const assistantMessage: ChatMessage = {
            id: assistantId,
            role: 'assistant',
            content: '',
            status: 'streaming',
        };
        setChatMessages([assistantMessage]);

        try {
            const response = await fetch('/reports/po-comparison/insights/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'text/event-stream',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                credentials: 'same-origin',
                body: JSON.stringify({ summary_data: aiSummaryData }),
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            if (!response.body) {
                throw new Error('No response body received');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                // SSE blocks are separated by \n\n
                const parts = buffer.split('\n\n');
                buffer = parts.pop() || '';

                for (const part of parts) {
                    const event = parseSSEEvent(part);
                    if (!event) continue;

                    if (event.type === 'delta' && event.data.delta) {
                        setChatMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + event.data.delta } : m)));
                    } else if (event.type === 'done') {
                        setConversationId(event.data.conversation_id);
                        setChatMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, status: 'complete' as const } : m)));
                    } else if (event.type === 'error') {
                        throw new Error(event.data.error);
                    }
                }
            }

            // Process any remaining buffer
            if (buffer.trim()) {
                const event = parseSSEEvent(buffer);
                if (event?.type === 'done') {
                    setConversationId(event.data.conversation_id);
                    setChatMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, status: 'complete' as const } : m)));
                }
            }

            // Mark complete if not already
            setChatMessages((prev) =>
                prev.map((m) => (m.id === assistantId && m.status === 'streaming' ? { ...m, status: 'complete' as const } : m)),
            );
        } catch (err: any) {
            if (err.name === 'AbortError') return;
            setInsightsError(err.message || 'Failed to generate AI insights');
            setChatMessages((prev) =>
                prev.map((m) =>
                    m.id === assistantId ? { ...m, content: m.content || 'Failed to generate insights.', status: 'error' as const } : m,
                ),
            );
        } finally {
            setInsightsLoading(false);
            abortControllerRef.current = null;
        }
    }, [aiSummaryData]);

    const refreshInsights = async () => {
        // Clear messages and start fresh
        setChatMessages([]);
        setConversationId(null);
        setFollowUpQuestion('');
        // Then fetch new insights
        await fetchInsights();
    };

    const askFollowUp = async () => {
        if (!conversationId || !followUpQuestion.trim()) return;

        const question = followUpQuestion.trim();
        setFollowUpQuestion('');
        setFollowUpLoading(true);

        // Cancel any existing stream
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        // Add user message immediately
        const userMessage: ChatMessage = {
            id: generateMessageId(),
            role: 'user',
            content: question,
            status: 'complete',
        };

        // Create streaming assistant message
        const assistantId = generateMessageId();
        const assistantMessage: ChatMessage = {
            id: assistantId,
            role: 'assistant',
            content: '',
            status: 'streaming',
        };

        setChatMessages((prev) => [...prev, userMessage, assistantMessage]);

        try {
            const response = await fetch('/reports/po-comparison/insights/follow-up/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'text/event-stream',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                credentials: 'same-origin',
                body: JSON.stringify({ conversation_id: conversationId, question }),
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            if (!response.body) {
                throw new Error('No response body received');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                const parts = buffer.split('\n\n');
                buffer = parts.pop() || '';

                for (const part of parts) {
                    const event = parseSSEEvent(part);
                    if (!event) continue;

                    if (event.type === 'delta' && event.data.delta) {
                        setChatMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + event.data.delta } : m)));
                    } else if (event.type === 'done') {
                        setChatMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, status: 'complete' as const } : m)));
                    } else if (event.type === 'error') {
                        throw new Error(event.data.error);
                    }
                }
            }

            // Process any remaining buffer
            if (buffer.trim()) {
                const event = parseSSEEvent(buffer);
                if (event?.type === 'done') {
                    setChatMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, status: 'complete' as const } : m)));
                }
            }

            // Mark complete if not already
            setChatMessages((prev) =>
                prev.map((m) => (m.id === assistantId && m.status === 'streaming' ? { ...m, status: 'complete' as const } : m)),
            );
        } catch (err: any) {
            if (err.name === 'AbortError') return;
            setChatMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: `Error: ${err.message}`, status: 'error' as const } : m)),
            );
        } finally {
            setFollowUpLoading(false);
            abortControllerRef.current = null;
        }
    };

    // Auto-scroll chat to bottom when messages change
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const fetchSyncStatus = useCallback(async () => {
        setSyncStatusLoading(true);
        try {
            const filters = buildFilters();
            const queryParams = new URLSearchParams(filters as Record<string, string>).toString();
            const response = await fetch(`/reports/po-comparison/sync-status?${queryParams}`, {
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setSyncStatus(data);
                }
            }
        } catch { /* ignored */ } finally {
            setSyncStatusLoading(false);
        }
    }, [buildFilters]);

    const queueSyncJobs = async () => {
        setSyncQueueLoading(true);
        setSyncMessage(null);
        try {
            const filters = buildFilters();
            const response = await fetch('/reports/po-comparison/queue-sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                credentials: 'same-origin',
                body: JSON.stringify(filters),
            });

            const data = await response.json();
            if (data.success) {
                setSyncMessage(`Syncing ${data.queued} POs...`);
                setIsSyncing(true);
                // Real-time updates will come through Echo
            } else {
                setSyncMessage(`Error: ${data.error}`);
            }
        } catch (err: any) {
            setSyncMessage(`Error: ${err.message}`);
        } finally {
            setSyncQueueLoading(false);
        }
    };

    const pushFiltersToUrl = useCallback(() => {
        const filters = buildFilters();
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                params.set(key, String(value));
            }
        });
        const qs = params.toString();
        const url = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
        window.history.replaceState({}, '', url);
    }, [buildFilters]);

    const handleApplyFilters = () => {
        setHasSearched(true);
        pushFiltersToUrl();
        fetchReportData();
        fetchSyncStatus();
        setChatMessages([]); // Clear chat when filters change
        setConversationId(null);
        setFollowUpQuestion('');
        setAiSummaryData(null); // Clear summary data when filters change
    };

    const handleClearFilters = () => {
        setLocationId('all');
        setSupplierId('all');
        setStatus('all');
        setPoNumber('');
        setMinVariance('');
        setOnlyDiscrepancies(false);
        setDateRange(undefined);
        window.history.replaceState({}, '', window.location.pathname);
    };

    // Auto-fetch on mount if URL has filter params
    useEffect(() => {
        if (initialFilters && Object.keys(initialFilters).length > 0) {
            setHasSearched(true);
            fetchReportData();
            fetchSyncStatus();
        }
         
    }, []);

    const handlePrint = () => {
        window.print();
    };

    const handleExportCSV = () => {
        if (!reportData.length) return;

        const csvData = reportData.map((item) => ({
            'PO Number': `PO${item.requisition.po_number}`,
            Project: item.location?.name || 'N/A',
            Supplier: item.supplier?.name || 'N/A',
            Status: item.requisition.status,
            'Created Date': format(new Date(item.requisition.created_at), 'dd/MM/yyyy'),
            'Original Value': item.totals.original,
            'Premier Value': item.totals.premier,
            'Invoice Value': item.totals.invoiced,
            Variance: item.totals.variance,
            'Variance %': item.totals.variance_percent,
            Remaining: item.totals.remaining,
            'Items Modified': item.summary.modified_count,
            'Items Added': item.summary.added_count,
            'Items Removed': item.summary.removed_count,
        }));

        const csv = Papa.unparse(csvData);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `po-comparison-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        a.click();
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="PO Comparison Report" />

            {/* Print-only header */}
            <div className="print-header hidden print:mb-6 print:block">
                <h1 className="text-2xl font-bold">PO Comparison Report</h1>
                <p className="text-sm text-gray-600">Generated: {format(new Date(), 'dd MMMM yyyy, HH:mm')}</p>
                {aggregate && (
                    <p className="text-sm">
                        {aggregate.total_pos} Purchase Orders | {formatCurrency(aggregate.total_original_value)} Total Value
                    </p>
                )}
            </div>

            <div className="mx-auto max-w-5xl space-y-4 p-4 print:max-w-none print:p-0">
                {/* Filters Section - Hide on print */}
                <Card className="print:hidden">
                    <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Filter className="h-4 w-4" />
                                <CardTitle>Report Filters</CardTitle>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={handleClearFilters}>
                                    Clear All
                                </Button>
                                <Button size="sm" onClick={handleApplyFilters} disabled={loading}>
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Apply Filters
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                            {/* Project/Location Filter */}
                            <div className="space-y-2">
                                <Label>Project</Label>
                                <Select value={locationId} onValueChange={setLocationId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All Projects" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Projects</SelectItem>
                                        {filterOptions.locations.map((loc) => (
                                            <SelectItem key={loc.id} value={loc.id.toString()}>
                                                {loc.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Supplier Filter */}
                            <div className="space-y-2">
                                <Label>Supplier</Label>
                                <Select value={supplierId} onValueChange={setSupplierId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All Suppliers" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Suppliers</SelectItem>
                                        {filterOptions.suppliers.map((sup) => (
                                            <SelectItem key={sup.id} value={sup.id.toString()}>
                                                {sup.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Date Range Filter */}
                            <div className="space-y-2">
                                <Label>Date Range</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn('w-full justify-start text-left font-normal', !dateRange && 'text-muted-foreground')}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {dateRange?.from ? (
                                                dateRange.to ? (
                                                    <>
                                                        {format(dateRange.from, 'dd/MM/yy')} - {format(dateRange.to, 'dd/MM/yy')}
                                                    </>
                                                ) : (
                                                    format(dateRange.from, 'dd/MM/yy')
                                                )
                                            ) : (
                                                'Select dates'
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* Status Filter */}
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select value={status} onValueChange={setStatus}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All Statuses" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Statuses</SelectItem>
                                        {filterOptions.statuses.map((s) => (
                                            <SelectItem key={s} value={s}>
                                                {s.charAt(0).toUpperCase() + s.slice(1)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* PO Number Search */}
                            <div className="space-y-2">
                                <Label>PO Number</Label>
                                <Input placeholder="Search PO number..." value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
                            </div>

                            {/* Minimum Variance */}
                            <div className="space-y-2">
                                <Label>Min Variance ($)</Label>
                                <Input type="number" min="0" placeholder="Show variances above..." value={minVariance} onChange={(e) => setMinVariance(e.target.value)} />
                            </div>

                            {/* Only Discrepancies Toggle */}
                            <div className="flex items-center space-x-2 pt-6">
                                <Switch id="only-discrepancies" checked={onlyDiscrepancies} onCheckedChange={setOnlyDiscrepancies} />
                                <Label htmlFor="only-discrepancies">Only show POs with discrepancies</Label>
                            </div>
                        </div>

                        {/* Sync Status Section */}
                        {syncStatus && (
                            <div className="mt-4 space-y-3 border-t pt-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            {isSyncing ? (
                                                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                            ) : (
                                                <CloudDownload className="text-muted-foreground h-4 w-4" />
                                            )}
                                            <span className="text-sm font-medium">Premier Data Sync</span>
                                            <span
                                                className={cn('h-2 w-2 rounded-full', isWsConnected ? 'bg-green-500' : 'bg-red-500')}
                                                role="status"
                                                aria-label={isWsConnected ? 'Real-time updates connected' : 'Real-time updates disconnected'}
                                            />
                                        </div>
                                        <div className="text-muted-foreground flex items-center gap-3 text-xs">
                                            <span>{syncStatus.cached} cached</span>
                                            {syncStatus.stale > 0 && <span>{syncStatus.stale} stale</span>}
                                            {syncStatus.missing > 0 && <span>{syncStatus.missing} missing</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {syncMessage && <span className="text-muted-foreground text-sm">{syncMessage}</span>}
                                        {lastSyncedPo && isSyncing && <span className="text-muted-foreground text-xs">Last: PO{lastSyncedPo}</span>}
                                        {syncStatus.needs_sync > 0 && !isSyncing && (
                                            <Button variant="outline" size="sm" onClick={queueSyncJobs} disabled={syncQueueLoading}>
                                                {syncQueueLoading ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <CloudDownload className="mr-2 h-4 w-4" />
                                                )}
                                                Sync {syncStatus.needs_sync} POs
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="sm" onClick={fetchSyncStatus} disabled={syncStatusLoading || isSyncing} aria-label="Refresh sync status">
                                            <RefreshCw className={cn('h-4 w-4', (syncStatusLoading || isSyncing) && 'animate-spin')} />
                                        </Button>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="flex items-center gap-3">
                                    <Progress value={syncStatus.ready_percent} className={cn('h-2 flex-1', isSyncing && 'animate-pulse')} />
                                    <span className="text-muted-foreground min-w-[40px] text-right text-xs">
                                        {syncStatus.ready_percent}%
                                    </span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Error Alert */}
                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {/* Loading State */}
                {loading && (
                    <div className="space-y-4">
                        <div className="rounded-md border p-4">
                            <div className="mb-3 flex gap-6">
                                <Skeleton className="h-5 w-32" />
                                <Skeleton className="h-5 w-32" />
                                <Skeleton className="h-5 w-32" />
                            </div>
                            <Skeleton className="h-4 w-64" />
                        </div>
                        <div className="rounded-md border p-4">
                            <Skeleton className="h-64 w-full" />
                        </div>
                    </div>
                )}

                {/* Report Content */}
                {!loading && aggregate && (
                    <>
                        {/* Action Bar - Hide on print */}
                        <div className="flex items-center justify-between print:hidden">
                            <p className="text-muted-foreground text-sm">
                                Showing {reportData.length} purchase orders
                                {aggregate.pos_with_variances > 0 && (
                                    <span className="ml-1">({aggregate.pos_with_variances} with variances)</span>
                                )}
                            </p>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={handleExportCSV}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Export CSV
                                </Button>
                                <Button variant="outline" size="sm" onClick={handlePrint}>
                                    <Printer className="mr-2 h-4 w-4" />
                                    Print Report
                                </Button>
                            </div>
                        </div>

                        {/* Executive Summary */}
                        <div className="flex flex-col gap-3 rounded-md border px-4 py-3 md:flex-row md:items-center md:justify-between print:border">
                            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                                <div>
                                    <span className="text-muted-foreground text-sm">Original</span>
                                    <span className="ml-2 text-sm font-semibold tabular-nums">{formatCurrency(aggregate.total_original_value)}</span>
                                </div>
                                <span className="text-muted-foreground/40">→</span>
                                <div>
                                    <span className="text-muted-foreground text-sm">Current</span>
                                    <span className="ml-2 text-sm font-semibold tabular-nums">{formatCurrency(aggregate.total_premier_value)}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground text-sm">Variance</span>
                                    <span className="ml-2 text-sm font-bold tabular-nums">
                                        {formatCurrency(aggregate.total_variance)} ({formatPercent(aggregate.variance_percent)})
                                    </span>
                                </div>
                            </div>
                            <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                <span>{aggregate.total_pos} POs</span>
                                <span className="text-muted-foreground/30">|</span>
                                <span>Invoiced {formatCurrency(aggregate.total_invoiced_value)}</span>
                                {(aggregate.items_modified > 0 || aggregate.items_added > 0 || aggregate.items_removed > 0) && (
                                    <>
                                        <span className="text-muted-foreground/30">|</span>
                                        <span>
                                            {aggregate.items_modified > 0 && `${aggregate.items_modified} modified`}
                                            {aggregate.items_added > 0 && ` +${aggregate.items_added} added`}
                                            {aggregate.items_removed > 0 && ` -${aggregate.items_removed} removed`}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Price List Violations Notice */}
                        {aggregate.price_list_violations > 0 && (
                            <p className="text-muted-foreground text-sm print:block">
                                <strong>{aggregate.price_list_violations} price list violation(s)</strong> totalling {formatCurrency(aggregate.price_list_violation_value)}.{' '}
                                See Violations tab.
                            </p>
                        )}

                        {/* Tabs for different views */}
                        <Tabs defaultValue={aggregate.price_list_violations > 0 ? 'violations' : 'summary'} className="print:hidden">
                            <TabsList className={cn('grid w-full', aggregate.price_list_violations > 0 ? 'grid-cols-4' : 'grid-cols-3')}>
                                {aggregate.price_list_violations > 0 && (
                                    <TabsTrigger value="violations">
                                        Violations ({aggregate.price_list_violations})
                                    </TabsTrigger>
                                )}
                                <TabsTrigger value="summary">Summary</TabsTrigger>
                                <TabsTrigger value="details">Details</TabsTrigger>
                                <TabsTrigger value="insights">Insights</TabsTrigger>
                            </TabsList>

                            {/* Price List Violations Tab */}
                            {aggregate.price_list_violations > 0 && (
                                <TabsContent value="violations" className="space-y-4">
                                    {priceListViolations.map((po, idx) => (
                                        <div key={idx} className="rounded-md border">
                                            <div className="flex items-center justify-between px-4 py-3">
                                                <div>
                                                    <p className="text-sm font-medium">PO{po.po_number}</p>
                                                    <p className="text-muted-foreground text-xs">
                                                        {po.location} | {po.supplier}
                                                    </p>
                                                </div>
                                                <span className="text-muted-foreground text-xs">{po.violations.length} violation(s)</span>
                                            </div>
                                                            <Table>
                                                                <TableHeader>
                                                                    <TableRow>
                                                                        <TableHead>Description</TableHead>
                                                                        <TableHead>Price List</TableHead>
                                                                        <TableHead className="text-right">Original Unit</TableHead>
                                                                        <TableHead className="text-right">Current Unit</TableHead>
                                                                        <TableHead className="text-right">Difference</TableHead>
                                                                        <TableHead className="text-right">Total Impact</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {po.violations.map((v, vIdx) => (
                                                                        <TableRow key={vIdx}>
                                                                            <TableCell className="max-w-[200px] truncate font-medium">
                                                                                {v.description}
                                                                            </TableCell>
                                                                            <TableCell className="text-xs">
                                                                                {v.price_list}
                                                                            </TableCell>
                                                                            <TableCell className="text-right tabular-nums">
                                                                                {formatCurrency(v.original_unit_cost)}
                                                                            </TableCell>
                                                                            <TableCell className="text-right tabular-nums">
                                                                                {formatCurrency(v.current_unit_cost)}
                                                                            </TableCell>
                                                                            <TableCell className="text-right tabular-nums">
                                                                                {v.difference > 0 ? '+' : ''}{formatCurrency(v.difference)}
                                                                            </TableCell>
                                                                            <TableCell className="text-right font-medium tabular-nums">
                                                                                {formatCurrency(v.total_impact)}
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                        </div>
                                    ))}
                                </TabsContent>
                            )}

                            {/* Summary Tab */}
                            <TabsContent value="summary">
                                <div className="overflow-x-auto rounded-md border">
                                    <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>PO Number</TableHead>
                                                        <TableHead>Project</TableHead>
                                                        <TableHead>Supplier</TableHead>
                                                        <TableHead className="text-right">Original</TableHead>
                                                        <TableHead className="text-right">Current</TableHead>
                                                        <TableHead className="text-right">Invoiced</TableHead>
                                                        <TableHead className="text-right">Variance</TableHead>
                                                        <TableHead className="text-center">Status</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {reportData.map((item) => (
                                                        <TableRow
                                                            key={item.requisition.id}
                                                            className="hover:bg-muted/50"
                                                        >
                                                            <TableCell className="font-medium">PO{item.requisition.po_number}</TableCell>
                                                            <TableCell className="max-w-[150px] truncate">{item.location?.name || 'N/A'}</TableCell>
                                                            <TableCell className="max-w-[150px] truncate">{item.supplier?.name || 'N/A'}</TableCell>
                                                            <TableCell className="text-right tabular-nums">
                                                                {formatCurrency(item.totals.original)}
                                                            </TableCell>
                                                            <TableCell className="text-right tabular-nums">
                                                                {formatCurrency(item.totals.premier)}
                                                            </TableCell>
                                                            <TableCell className="text-right tabular-nums">
                                                                {formatCurrency(item.totals.invoiced)}
                                                            </TableCell>
                                                            <TableCell className="text-right tabular-nums">
                                                                {formatCurrency(item.totals.variance)}
                                                            </TableCell>
                                                            <TableCell className="text-muted-foreground text-center text-xs">
                                                                {item.summary.has_discrepancies ? (
                                                                    <span>
                                                                        {item.summary.modified_count > 0 && `${item.summary.modified_count} mod`}
                                                                        {item.summary.added_count > 0 && ` +${item.summary.added_count}`}
                                                                        {item.summary.removed_count > 0 && ` -${item.summary.removed_count}`}
                                                                    </span>
                                                                ) : (
                                                                    <span>OK</span>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                    </Table>
                                </div>
                            </TabsContent>

                            {/* Details Tab */}
                            <TabsContent value="details" className="space-y-4">
                                {reportData.map((item) => (
                                    <div
                                        key={item.requisition.id}
                                        className="rounded-md border"
                                    >
                                        <div className="flex items-center justify-between px-4 py-3">
                                            <div>
                                                <p className="text-sm font-medium">PO{item.requisition.po_number}</p>
                                                <p className="text-muted-foreground text-xs">
                                                    {item.location?.name} | {item.supplier?.name}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-muted-foreground text-xs">Variance</p>
                                                <p className="text-sm font-semibold tabular-nums">
                                                    {formatCurrency(item.totals.variance)} ({formatPercent(item.totals.variance_percent)})
                                                </p>
                                            </div>
                                        </div>
                                            <div className="overflow-x-auto">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="border-b-2">
                                                            <TableHead className="w-[80px]">Status</TableHead>
                                                            <TableHead className="min-w-[200px]">Description</TableHead>
                                                            <TableHead className="text-right">Orig Qty</TableHead>
                                                            <TableHead className="text-right">Orig Unit</TableHead>
                                                            <TableHead className="text-right">Orig Total</TableHead>
                                                            <TableHead className="text-right">Curr Qty</TableHead>
                                                            <TableHead className="text-right">Curr Unit</TableHead>
                                                            <TableHead className="text-right">Curr Total</TableHead>
                                                            <TableHead className="text-right">Variance</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {item.comparison.slice(0, 10).map((line: any, idx: number) => (
                                                            <TableRow key={idx}>
                                                                <TableCell>
                                                                    <span className="text-muted-foreground text-xs capitalize">{line.status}</span>
                                                                </TableCell>
                                                                <TableCell className="max-w-[200px] truncate">
                                                                    {line.local?.description || line.premier?.description || 'N/A'}
                                                                </TableCell>
                                                                <TableCell className="text-right tabular-nums">{line.local?.qty ?? '—'}</TableCell>
                                                                <TableCell className="text-right tabular-nums">
                                                                    {line.local ? formatCurrency(line.local.unit_cost) : '—'}
                                                                </TableCell>
                                                                <TableCell className="text-right tabular-nums">
                                                                    {line.local ? formatCurrency(line.local.total_cost) : '—'}
                                                                </TableCell>
                                                                <TableCell className="text-right tabular-nums">{line.premier?.qty ?? '—'}</TableCell>
                                                                <TableCell className="text-right tabular-nums">
                                                                    {line.premier ? formatCurrency(line.premier.unit_cost) : '—'}
                                                                </TableCell>
                                                                <TableCell className="text-right tabular-nums">
                                                                    {line.premier ? formatCurrency(line.premier.total_cost) : '—'}
                                                                </TableCell>
                                                                <TableCell className="text-right tabular-nums">
                                                                    {line.variances?.total_cost?.difference !== undefined
                                                                        ? formatCurrency(line.variances.total_cost.difference)
                                                                        : '—'}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                        {item.comparison.length > 10 && (
                                                            <TableRow>
                                                                <TableCell colSpan={9} className="text-muted-foreground text-center">
                                                                    ... and {item.comparison.length - 10} more items
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                    </div>
                                ))}
                            </TabsContent>

                            {/* AI Insights Tab */}
                            <TabsContent value="insights" className="space-y-4">
                                <div className="flex h-[600px] flex-col rounded-md border">
                                    <div className="flex items-center justify-between border-b px-4 py-3">
                                        <div>
                                            <p className="text-sm font-medium">Procurement Insights</p>
                                            <p className="text-muted-foreground text-xs">Analyse PO data for trends and recommendations</p>
                                        </div>
                                        <div className="flex gap-2">
                                            {chatMessages.length === 0 && !insightsLoading && (
                                                <Button size="sm" onClick={fetchInsights}>
                                                    Start Analysis
                                                </Button>
                                            )}
                                            {chatMessages.length > 0 && (
                                                <Button variant="outline" size="sm" onClick={refreshInsights} disabled={insightsLoading}>
                                                    {insightsLoading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                                                    New Analysis
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-1 flex-col overflow-hidden px-4 py-3">
                                        {insightsError && (
                                            <Alert variant="destructive" className="mb-4 flex-shrink-0">
                                                <AlertCircle className="h-4 w-4" />
                                                <AlertTitle>Error</AlertTitle>
                                                <AlertDescription>{insightsError}</AlertDescription>
                                            </Alert>
                                        )}

                                        {/* Chat Messages Area */}
                                        <div className="mb-4 flex-1 space-y-4 overflow-y-auto pr-2">
                                            {chatMessages.length === 0 && !insightsLoading && !insightsError && (
                                                <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
                                                    Click "Start Analysis" to begin
                                                </div>
                                            )}

                                            {chatMessages.map((message) => (
                                                <div key={message.id} className={cn('flex', message.role === 'user' && 'justify-end')}>
                                                    <div
                                                        className={cn(
                                                            'max-w-[85%] rounded-md px-3 py-2',
                                                            message.role === 'assistant'
                                                                ? 'prose prose-sm dark:prose-invert prose-headings:mt-3 prose-headings:mb-1 prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5 max-w-none'
                                                                : 'bg-muted text-sm',
                                                        )}
                                                    >
                                                        {message.role === 'assistant' ? (
                                                            message.status === 'streaming' && !message.content ? (
                                                                <div className="space-y-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <Loader2 className="text-muted-foreground size-4 animate-spin" />
                                                                        <span className="text-muted-foreground text-sm font-medium">
                                                                            Analysing...
                                                                        </span>
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Skeleton className="h-4 w-full" />
                                                                        <Skeleton className="h-4 w-4/5" />
                                                                        <Skeleton className="h-4 w-3/5" />
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <ReactMarkdown>{message.content}</ReactMarkdown>
                                                                    {message.status === 'streaming' && (
                                                                        <span className="bg-primary ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm" />
                                                                    )}
                                                                </>
                                                            )
                                                        ) : (
                                                            <p>{message.content}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}

                                            <div ref={chatEndRef} />
                                        </div>

                                        {/* Follow-up Input - Styled like chat-input */}
                                        {chatMessages.length > 0 && chatMessages.some((m) => m.status === 'complete') && (
                                            <div className="flex-shrink-0 border-t pt-4">
                                                <div className="border-border focus-within:ring-ring flex items-center gap-2 rounded-lg border px-3 py-2 focus-within:ring-1">
                                                    <input
                                                        type="text"
                                                        placeholder="Ask a follow-up question..."
                                                        aria-label="Follow-up question"
                                                        value={followUpQuestion}
                                                        onChange={(e) => setFollowUpQuestion(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                                e.preventDefault();
                                                                askFollowUp();
                                                            }
                                                        }}
                                                        disabled={followUpLoading || chatMessages.some((m) => m.status === 'streaming')}
                                                        className="placeholder:text-muted-foreground min-h-[24px] flex-1 bg-transparent text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                                    />
                                                    {followUpLoading || chatMessages.some((m) => m.status === 'streaming') ? (
                                                        <Button
                                                            type="button"
                                                            size="icon"
                                                            variant="outline"
                                                            className="size-8"
                                                            aria-label="Stop generating"
                                                            onClick={() => abortControllerRef.current?.abort()}
                                                        >
                                                            <Square className="size-3.5" fill="currentColor" />
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            type="button"
                                                            size="icon"
                                                            className="size-8"
                                                            aria-label="Send question"
                                                            onClick={askFollowUp}
                                                            disabled={!followUpQuestion.trim()}
                                                        >
                                                            <ArrowUp className="size-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>

                        {/* Print-only detailed table */}
                        <div className="hidden print:block print:break-before-page">
                            <h2 className="mb-4 text-base font-bold">Detailed Comparison</h2>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>PO Number</TableHead>
                                        <TableHead>Project</TableHead>
                                        <TableHead>Supplier</TableHead>
                                        <TableHead className="text-right">Original</TableHead>
                                        <TableHead className="text-right">Current</TableHead>
                                        <TableHead className="text-right">Invoiced</TableHead>
                                        <TableHead className="text-right">Variance</TableHead>
                                        <TableHead className="text-center">Changes</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reportData.map((item) => (
                                        <TableRow key={item.requisition.id}>
                                            <TableCell>PO{item.requisition.po_number}</TableCell>
                                            <TableCell>{item.location?.name || 'N/A'}</TableCell>
                                            <TableCell>{item.supplier?.name || 'N/A'}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(item.totals.original)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(item.totals.premier)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(item.totals.invoiced)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(item.totals.variance)}</TableCell>
                                            <TableCell className="text-center">
                                                {item.summary.modified_count > 0 && `${item.summary.modified_count} mod `}
                                                {item.summary.added_count > 0 && `+${item.summary.added_count} `}
                                                {item.summary.removed_count > 0 && `-${item.summary.removed_count}`}
                                                {!item.summary.has_discrepancies && 'OK'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}

                {/* Empty state - before search */}
                {!loading && !error && !hasSearched && (
                    <div className="py-12 text-center">
                        <Filter className="text-muted-foreground mx-auto mb-4 h-10 w-10" />
                        <h3 className="mb-2 text-sm font-medium">Select Filters to Generate Report</h3>
                        <p className="text-muted-foreground mb-4 text-sm">
                            Choose your filters above and click "Apply Filters" to generate the PO comparison report.
                        </p>
                        <Button onClick={handleApplyFilters}>
                            Generate Report
                        </Button>
                    </div>
                )}

                {/* Empty state - after search with no results */}
                {!loading && !error && hasSearched && reportData.length === 0 && (
                    <div className="py-12 text-center">
                        <FileText className="text-muted-foreground mx-auto mb-4 h-10 w-10" />
                        <h3 className="mb-2 text-sm font-medium">No Purchase Orders Found</h3>
                        <p className="text-muted-foreground mb-4 text-sm">
                            No purchase orders match your current filters. Try broadening your search or clearing filters.
                        </p>
                        <Button variant="outline" onClick={handleClearFilters}>
                            Clear Filters
                        </Button>
                    </div>
                )}
            </div>

        </AppLayout>
    );
}
