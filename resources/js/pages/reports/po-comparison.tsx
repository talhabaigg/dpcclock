import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { format } from 'date-fns';
import {
    AlertCircle,
    ArrowDownRight,
    ArrowUp,
    ArrowUpRight,
    BarChart3,
    Brain,
    CalendarIcon,
    CheckCircle2,
    CloudDownload,
    Download,
    FileText,
    Filter,
    Loader2,
    Minus,
    Printer,
    RefreshCw,
    Sparkles,
    Square,
    TrendingDown,
    TrendingUp,
    User,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Echo from 'laravel-echo';
import Papa from 'papaparse';
import Pusher from 'pusher-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DateRange } from 'react-day-picker';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Reports', href: '/' },
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

    // Expanded rows for detail view
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

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
            console.log('[premier-sync] WebSocket connected');
            setIsWsConnected(true);
        });

        echo.connector.pusher.connection.bind('error', (error: any) => {
            console.error('[premier-sync] WebSocket error:', error);
            setIsWsConnected(false);
        });

        echo.connector.pusher.connection.bind('disconnected', () => {
            console.log('[premier-sync] WebSocket disconnected');
            setIsWsConnected(false);
        });

        // Listen to premier-sync channel
        const channel = echo.channel('premier-sync');

        channel.subscribed(() => {
            console.log('[premier-sync] Subscribed to channel');
            setIsWsConnected(true);
        });

        channel.error((error: any) => {
            console.error('[premier-sync] Channel error:', error);
            setIsWsConnected(false);
        });

        channel.listen('.sync.progress', (event: {
            cached: number;
            total: number;
            missing: number;
            stale: number;
            needs_sync: number;
            ready_percent: number;
            last_synced_po: string | null;
            status: string;
        }) => {
            console.log('[premier-sync] Received sync.progress event:', event);
            setSyncStatus({
                cached: event.cached,
                total: event.total,
                missing: event.missing,
                stale: event.stale,
                needs_sync: event.needs_sync,
                ready_percent: event.ready_percent,
            });
            setLastSyncedPo(event.last_synced_po);
            setIsSyncing(event.status === 'syncing');

            if (event.status === 'completed') {
                setSyncMessage('Sync completed');
                // Clear message after 3 seconds
                setTimeout(() => setSyncMessage(null), 3000);
            }
        });

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
                    'Accept': 'application/json',
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
                    'Accept': 'text/event-stream',
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
                        setChatMessages(prev =>
                            prev.map(m =>
                                m.id === assistantId
                                    ? { ...m, content: m.content + event.data.delta }
                                    : m
                            )
                        );
                    } else if (event.type === 'done') {
                        setConversationId(event.data.conversation_id);
                        setChatMessages(prev =>
                            prev.map(m =>
                                m.id === assistantId
                                    ? { ...m, status: 'complete' as const }
                                    : m
                            )
                        );
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
                    setChatMessages(prev =>
                        prev.map(m =>
                            m.id === assistantId
                                ? { ...m, status: 'complete' as const }
                                : m
                        )
                    );
                }
            }

            // Mark complete if not already
            setChatMessages(prev =>
                prev.map(m =>
                    m.id === assistantId && m.status === 'streaming'
                        ? { ...m, status: 'complete' as const }
                        : m
                )
            );
        } catch (err: any) {
            if (err.name === 'AbortError') return;
            setInsightsError(err.message || 'Failed to generate AI insights');
            setChatMessages(prev =>
                prev.map(m =>
                    m.id === assistantId
                        ? { ...m, content: m.content || 'Failed to generate insights.', status: 'error' as const }
                        : m
                )
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

        setChatMessages(prev => [...prev, userMessage, assistantMessage]);

        try {
            const response = await fetch('/reports/po-comparison/insights/follow-up/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream',
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
                        setChatMessages(prev =>
                            prev.map(m =>
                                m.id === assistantId
                                    ? { ...m, content: m.content + event.data.delta }
                                    : m
                            )
                        );
                    } else if (event.type === 'done') {
                        setChatMessages(prev =>
                            prev.map(m =>
                                m.id === assistantId
                                    ? { ...m, status: 'complete' as const }
                                    : m
                            )
                        );
                    } else if (event.type === 'error') {
                        throw new Error(event.data.error);
                    }
                }
            }

            // Process any remaining buffer
            if (buffer.trim()) {
                const event = parseSSEEvent(buffer);
                if (event?.type === 'done') {
                    setChatMessages(prev =>
                        prev.map(m =>
                            m.id === assistantId
                                ? { ...m, status: 'complete' as const }
                                : m
                        )
                    );
                }
            }

            // Mark complete if not already
            setChatMessages(prev =>
                prev.map(m =>
                    m.id === assistantId && m.status === 'streaming'
                        ? { ...m, status: 'complete' as const }
                        : m
                )
            );
        } catch (err: any) {
            if (err.name === 'AbortError') return;
            setChatMessages(prev =>
                prev.map(m =>
                    m.id === assistantId
                        ? { ...m, content: `Error: ${err.message}`, status: 'error' as const }
                        : m
                )
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
                    'Accept': 'application/json',
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
        } catch (err) {
            console.error('Failed to fetch sync status:', err);
        } finally {
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
                    'Accept': 'application/json',
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

    const handleApplyFilters = () => {
        setHasSearched(true);
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
    };

    const toggleRowExpand = (id: number) => {
        setExpandedRows((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

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
            <div className="print-header hidden print:block print:mb-6">
                <h1 className="text-2xl font-bold">PO Comparison Report</h1>
                <p className="text-sm text-gray-600">Generated: {format(new Date(), 'dd MMMM yyyy, HH:mm')}</p>
                {aggregate && (
                    <p className="text-sm">
                        {aggregate.total_pos} Purchase Orders | {formatCurrency(aggregate.total_original_value)} Total Value
                    </p>
                )}
            </div>

            <div className="mx-auto space-y-4 p-4 print:p-0">
                {/* Filters Section - Hide on print */}
                <Card className="print:hidden">
                    <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Filter className="h-5 w-5" />
                                <CardTitle className="text-lg">Report Filters</CardTitle>
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
                                                    format(dateRange.from, 'dd/MM/yyyy')
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
                                <Input
                                    type="number"
                                    placeholder="e.g. 1000"
                                    value={minVariance}
                                    onChange={(e) => setMinVariance(e.target.value)}
                                />
                            </div>

                            {/* Only Discrepancies Toggle */}
                            <div className="flex items-center space-x-2 pt-6">
                                <Switch id="only-discrepancies" checked={onlyDiscrepancies} onCheckedChange={setOnlyDiscrepancies} />
                                <Label htmlFor="only-discrepancies">Only show POs with discrepancies</Label>
                            </div>
                        </div>

                        {/* Sync Status Section */}
                        {syncStatus && (
                            <div className="mt-4 pt-4 border-t space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            {isSyncing ? (
                                                <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                                            ) : (
                                                <CloudDownload className="h-4 w-4 text-muted-foreground" />
                                            )}
                                            <span className="text-sm font-medium">Premier Data Sync</span>
                                            <span
                                                className={cn(
                                                    "h-2 w-2 rounded-full",
                                                    isWsConnected ? "bg-green-500" : "bg-red-500"
                                                )}
                                                title={isWsConnected ? "Real-time updates connected" : "Real-time updates disconnected"}
                                            />
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                            <span className="flex items-center gap-1">
                                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                <span className="text-green-700 dark:text-green-400">{syncStatus.cached} cached</span>
                                            </span>
                                            {syncStatus.stale > 0 && (
                                                <span className="flex items-center gap-1">
                                                    <RefreshCw className="h-4 w-4 text-amber-500" />
                                                    <span className="text-amber-700 dark:text-amber-400">{syncStatus.stale} stale</span>
                                                </span>
                                            )}
                                            {syncStatus.missing > 0 && (
                                                <span className="flex items-center gap-1">
                                                    <AlertCircle className="h-4 w-4 text-red-500" />
                                                    <span className="text-red-700 dark:text-red-400">{syncStatus.missing} missing</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {syncMessage && (
                                            <span className="text-sm text-muted-foreground">{syncMessage}</span>
                                        )}
                                        {lastSyncedPo && isSyncing && (
                                            <span className="text-xs text-muted-foreground">Last: PO{lastSyncedPo}</span>
                                        )}
                                        {syncStatus.needs_sync > 0 && !isSyncing && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={queueSyncJobs}
                                                disabled={syncQueueLoading}
                                            >
                                                {syncQueueLoading ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <CloudDownload className="mr-2 h-4 w-4" />
                                                )}
                                                Sync {syncStatus.needs_sync} POs
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={fetchSyncStatus}
                                            disabled={syncStatusLoading || isSyncing}
                                        >
                                            <RefreshCw className={cn('h-4 w-4', (syncStatusLoading || isSyncing) && 'animate-spin')} />
                                        </Button>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="flex items-center gap-3">
                                    <Progress
                                        value={syncStatus.ready_percent}
                                        className={cn(
                                            "flex-1 h-2",
                                            isSyncing && "animate-pulse"
                                        )}
                                    />
                                    <span className={cn(
                                        "text-sm font-medium min-w-[60px] text-right",
                                        syncStatus.ready_percent === 100 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"
                                    )}>
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
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                            {[...Array(4)].map((_, i) => (
                                <Card key={i}>
                                    <CardContent className="p-6">
                                        <Skeleton className="h-4 w-24 mb-2" />
                                        <Skeleton className="h-8 w-32" />
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                        <Card>
                            <CardContent className="p-6">
                                <Skeleton className="h-64 w-full" />
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Report Content */}
                {!loading && aggregate && (
                    <>
                        {/* Action Bar - Hide on print */}
                        <div className="flex justify-between items-center print:hidden">
                            <p className="text-sm text-muted-foreground">
                                Showing {reportData.length} purchase orders
                                {aggregate.pos_with_variances > 0 && (
                                    <span className="ml-2 text-amber-600">
                                        ({aggregate.pos_with_variances} with variances)
                                    </span>
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

                        {/* Executive Summary Cards */}
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 print:grid-cols-4">
                            <Card className="print:border print:shadow-none">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-muted-foreground">Total POs</p>
                                            <p className="text-2xl font-bold">{aggregate.total_pos}</p>
                                        </div>
                                        <FileText className="h-8 w-8 text-blue-500 opacity-50" />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="print:border print:shadow-none">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-muted-foreground">Original Value</p>
                                            <p className="text-2xl font-bold">{formatCurrency(aggregate.total_original_value)}</p>
                                        </div>
                                        <BarChart3 className="h-8 w-8 text-green-500 opacity-50" />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="print:border print:shadow-none">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-muted-foreground">Current Value</p>
                                            <p className="text-2xl font-bold">{formatCurrency(aggregate.total_premier_value)}</p>
                                        </div>
                                        <TrendingUp className="h-8 w-8 text-purple-500 opacity-50" />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className={cn('print:border print:shadow-none', aggregate.total_variance > 0 ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30' : aggregate.total_variance < 0 ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30' : '')}>
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-muted-foreground">Total Variance</p>
                                            <p className={cn('text-2xl font-bold', aggregate.total_variance > 0 ? 'text-amber-600' : aggregate.total_variance < 0 ? 'text-green-600' : '')}>
                                                {formatCurrency(aggregate.total_variance)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">{formatPercent(aggregate.variance_percent)}</p>
                                        </div>
                                        {aggregate.total_variance > 0 ? (
                                            <TrendingUp className="h-8 w-8 text-amber-500" />
                                        ) : aggregate.total_variance < 0 ? (
                                            <TrendingDown className="h-8 w-8 text-green-500" />
                                        ) : (
                                            <Minus className="h-8 w-8 text-gray-400" />
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Secondary Stats Row */}
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-6 print:grid-cols-6">
                            <Card className="print:border print:shadow-none">
                                <CardContent className="p-3 text-center">
                                    <p className="text-xs text-muted-foreground">Invoiced</p>
                                    <p className="text-lg font-semibold">{formatCurrency(aggregate.total_invoiced_value)}</p>
                                </CardContent>
                            </Card>
                            <Card className="print:border print:shadow-none">
                                <CardContent className="p-3 text-center">
                                    <p className="text-xs text-muted-foreground">Items Unchanged</p>
                                    <p className="text-lg font-semibold text-green-600 dark:text-green-400">{aggregate.items_unchanged}</p>
                                </CardContent>
                            </Card>
                            <Card className="print:border print:shadow-none">
                                <CardContent className="p-3 text-center">
                                    <p className="text-xs text-muted-foreground">Items Modified</p>
                                    <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">{aggregate.items_modified}</p>
                                </CardContent>
                            </Card>
                            <Card className="print:border print:shadow-none">
                                <CardContent className="p-3 text-center">
                                    <p className="text-xs text-muted-foreground">Items Added</p>
                                    <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">{aggregate.items_added}</p>
                                </CardContent>
                            </Card>
                            <Card className="print:border print:shadow-none">
                                <CardContent className="p-3 text-center">
                                    <p className="text-xs text-muted-foreground">Items Removed</p>
                                    <p className="text-lg font-semibold text-red-600 dark:text-red-400">{aggregate.items_removed}</p>
                                </CardContent>
                            </Card>
                            <Card className="print:border print:shadow-none">
                                <CardContent className="p-3 text-center">
                                    <p className="text-xs text-muted-foreground">POs with Issues</p>
                                    <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">{aggregate.pos_with_variances}</p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* CRITICAL: Price List Violations Alert */}
                        {aggregate.price_list_violations > 0 && (
                            <Alert variant="destructive" className="border-red-500 bg-red-50 dark:bg-red-950/30 print:border print:bg-red-50">
                                <AlertCircle className="h-5 w-5" />
                                <AlertTitle className="text-lg font-bold">
                                    Price List Violations Detected
                                </AlertTitle>
                                <AlertDescription>
                                    <p className="mb-2">
                                        <strong>{aggregate.price_list_violations} item(s)</strong> with contracted price lists have pricing changes.
                                        This represents a potential breach in the purchasing/invoice process.
                                    </p>
                                    <p className="text-lg font-bold text-red-700 dark:text-red-400">
                                        Total Impact: {formatCurrency(aggregate.price_list_violation_value)}
                                    </p>
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Tabs for different views */}
                        <Tabs defaultValue={aggregate.price_list_violations > 0 ? 'violations' : 'summary'} className="print:hidden">
                            <TabsList className="grid w-full grid-cols-4">
                                {aggregate.price_list_violations > 0 && (
                                    <TabsTrigger value="violations" className="text-red-600 dark:text-red-400">
                                        <AlertCircle className="mr-2 h-4 w-4" />
                                        Violations ({aggregate.price_list_violations})
                                    </TabsTrigger>
                                )}
                                <TabsTrigger value="summary">
                                    <BarChart3 className="mr-2 h-4 w-4" />
                                    Summary
                                </TabsTrigger>
                                <TabsTrigger value="details">
                                    <FileText className="mr-2 h-4 w-4" />
                                    Details
                                </TabsTrigger>
                                <TabsTrigger value="insights">
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Ask AI
                                </TabsTrigger>
                            </TabsList>

                            {/* Price List Violations Tab */}
                            {aggregate.price_list_violations > 0 && (
                                <TabsContent value="violations" className="space-y-4">
                                    <Card className="border-red-200 dark:border-red-800">
                                        <CardHeader className="bg-red-50 dark:bg-red-950/30">
                                            <div className="flex items-center gap-2">
                                                <AlertCircle className="h-6 w-6 text-red-600" />
                                                <div>
                                                    <CardTitle className="text-red-700 dark:text-red-300">Price List Compliance Violations</CardTitle>
                                                    <CardDescription className="text-red-600 dark:text-red-400">
                                                        Items with contracted price lists that have unauthorized price changes
                                                    </CardDescription>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="pt-4">
                                            <div className="space-y-4">
                                                {priceListViolations.map((po, idx) => (
                                                    <Card key={idx} className="border-red-100 dark:border-red-900">
                                                        <CardHeader className="pb-2">
                                                            <div className="flex items-center justify-between">
                                                                <div>
                                                                    <CardTitle className="text-base">PO{po.po_number}</CardTitle>
                                                                    <CardDescription>{po.location} | {po.supplier}</CardDescription>
                                                                </div>
                                                                <Badge variant="destructive">{po.violations.length} violation(s)</Badge>
                                                            </div>
                                                        </CardHeader>
                                                        <CardContent>
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
                                                                        <TableRow key={vIdx} className="bg-red-50 dark:bg-red-950/30">
                                                                            <TableCell className="font-medium max-w-[200px] truncate">
                                                                                {v.description}
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 text-xs">
                                                                                    {v.price_list}
                                                                                </Badge>
                                                                            </TableCell>
                                                                            <TableCell className="text-right tabular-nums">
                                                                                {formatCurrency(v.original_unit_cost)}
                                                                            </TableCell>
                                                                            <TableCell className="text-right tabular-nums">
                                                                                {formatCurrency(v.current_unit_cost)}
                                                                            </TableCell>
                                                                            <TableCell className="text-right tabular-nums">
                                                                                <span className={cn(
                                                                                    'font-medium',
                                                                                    v.difference > 0 ? 'text-red-600' : 'text-green-600'
                                                                                )}>
                                                                                    {v.difference > 0 ? '+' : ''}{formatCurrency(v.difference)}
                                                                                </span>
                                                                            </TableCell>
                                                                            <TableCell className="text-right tabular-nums font-bold text-red-600">
                                                                                {formatCurrency(v.total_impact)}
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            )}

                            {/* Summary Tab */}
                            <TabsContent value="summary" className="space-y-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>PO Comparison Summary</CardTitle>
                                        <CardDescription>Overview of all purchase orders with variance analysis</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="overflow-x-auto">
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
                                                            className={cn(
                                                                'cursor-pointer hover:bg-muted/50',
                                                                item.summary.has_discrepancies && 'bg-amber-50/50 dark:bg-amber-950/30',
                                                            )}
                                                            onClick={() => toggleRowExpand(item.requisition.id)}
                                                        >
                                                            <TableCell className="font-medium">PO{item.requisition.po_number}</TableCell>
                                                            <TableCell className="max-w-[150px] truncate">{item.location?.name || 'N/A'}</TableCell>
                                                            <TableCell className="max-w-[150px] truncate">{item.supplier?.name || 'N/A'}</TableCell>
                                                            <TableCell className="text-right tabular-nums">{formatCurrency(item.totals.original)}</TableCell>
                                                            <TableCell className="text-right tabular-nums">{formatCurrency(item.totals.premier)}</TableCell>
                                                            <TableCell className="text-right tabular-nums">{formatCurrency(item.totals.invoiced)}</TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex items-center justify-end gap-1">
                                                                    {item.totals.variance > 0 ? (
                                                                        <ArrowUpRight className="h-4 w-4 text-amber-500" />
                                                                    ) : item.totals.variance < 0 ? (
                                                                        <ArrowDownRight className="h-4 w-4 text-green-500" />
                                                                    ) : null}
                                                                    <span
                                                                        className={cn(
                                                                            'tabular-nums',
                                                                            item.totals.variance > 0 && 'text-amber-600',
                                                                            item.totals.variance < 0 && 'text-green-600',
                                                                        )}
                                                                    >
                                                                        {formatCurrency(item.totals.variance)}
                                                                    </span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                <div className="flex items-center justify-center gap-1">
                                                                    {item.summary.modified_count > 0 && (
                                                                        <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                                                                            {item.summary.modified_count} mod
                                                                        </Badge>
                                                                    )}
                                                                    {item.summary.added_count > 0 && (
                                                                        <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                                                                            +{item.summary.added_count}
                                                                        </Badge>
                                                                    )}
                                                                    {item.summary.removed_count > 0 && (
                                                                        <Badge variant="outline" className="text-xs bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
                                                                            -{item.summary.removed_count}
                                                                        </Badge>
                                                                    )}
                                                                    {!item.summary.has_discrepancies && (
                                                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* Details Tab */}
                            <TabsContent value="details" className="space-y-4">
                                {reportData.map((item) => (
                                    <Card key={item.requisition.id} className={cn(item.summary.has_discrepancies && 'border-amber-200 dark:border-amber-800')}>
                                        <CardHeader className="pb-2">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <CardTitle className="text-lg">PO{item.requisition.po_number}</CardTitle>
                                                    <CardDescription>
                                                        {item.location?.name} | {item.supplier?.name}
                                                    </CardDescription>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm text-muted-foreground">Variance</p>
                                                    <p
                                                        className={cn(
                                                            'text-lg font-bold',
                                                            item.totals.variance > 0 && 'text-amber-600',
                                                            item.totals.variance < 0 && 'text-green-600',
                                                        )}
                                                    >
                                                        {formatCurrency(item.totals.variance)} ({formatPercent(item.totals.variance_percent)})
                                                    </p>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
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
                                                            <TableRow
                                                                key={idx}
                                                                className={cn(
                                                                    line.status === 'added' && 'bg-blue-50 dark:bg-blue-950/30',
                                                                    line.status === 'removed' && 'bg-red-50 dark:bg-red-950/30',
                                                                    line.status === 'modified' && 'bg-amber-50 dark:bg-amber-950/30',
                                                                )}
                                                            >
                                                                <TableCell>
                                                                    <Badge
                                                                        variant="outline"
                                                                        className={cn(
                                                                            'text-xs',
                                                                            line.status === 'unchanged' && 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
                                                                            line.status === 'modified' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
                                                                            line.status === 'added' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
                                                                            line.status === 'removed' && 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
                                                                        )}
                                                                    >
                                                                        {line.status}
                                                                    </Badge>
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
                                                                    {line.variances?.total_cost?.difference !== undefined ? (
                                                                        <span
                                                                            className={cn(
                                                                                line.variances.total_cost.difference > 0 && 'text-amber-600',
                                                                                line.variances.total_cost.difference < 0 && 'text-green-600',
                                                                            )}
                                                                        >
                                                                            {formatCurrency(line.variances.total_cost.difference)}
                                                                        </span>
                                                                    ) : (
                                                                        '—'
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                        {item.comparison.length > 10 && (
                                                            <TableRow>
                                                                <TableCell colSpan={9} className="text-center text-muted-foreground">
                                                                    ... and {item.comparison.length - 10} more items
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </TabsContent>

                            {/* AI Insights Tab */}
                            <TabsContent value="insights" className="space-y-4">
                                <Card className="flex flex-col h-[700px]">
                                    <CardHeader className="flex-shrink-0">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Sparkles className="h-5 w-5 text-purple-500" />
                                                <CardTitle>AI Procurement Advisor</CardTitle>
                                            </div>
                                            <div className="flex gap-2">
                                                {chatMessages.length === 0 && !insightsLoading && (
                                                    <Button onClick={fetchInsights}>
                                                        <Brain className="mr-2 h-4 w-4" />
                                                        Start Analysis
                                                    </Button>
                                                )}
                                                {chatMessages.length > 0 && (
                                                    <Button variant="outline" onClick={refreshInsights} disabled={insightsLoading}>
                                                        <RefreshCw className={cn('mr-2 h-4 w-4', insightsLoading && 'animate-spin')} />
                                                        New Analysis
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        <CardDescription>
                                            Chat with AI about your procurement data. Ask follow-up questions to dive deeper.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex-1 flex flex-col overflow-hidden">
                                        {insightsError && (
                                            <Alert variant="destructive" className="mb-4 flex-shrink-0">
                                                <AlertCircle className="h-4 w-4" />
                                                <AlertTitle>Error</AlertTitle>
                                                <AlertDescription>{insightsError}</AlertDescription>
                                            </Alert>
                                        )}

                                        {/* Chat Messages Area */}
                                        <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">

                                            {chatMessages.length === 0 && !insightsLoading && !insightsError && (
                                                <div className="text-center py-12">
                                                    <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                                    <p className="text-muted-foreground mb-2">Your AI Procurement Advisor</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        Click "Start Analysis" to get insights on your PO data.<br />
                                                        You can ask follow-up questions to explore specific areas.
                                                    </p>
                                                </div>
                                            )}

                                            {chatMessages.map((message) => (
                                                <div
                                                    key={message.id}
                                                    className={cn(
                                                        'flex gap-3',
                                                        message.role === 'user' && 'justify-end'
                                                    )}
                                                >
                                                    {message.role === 'assistant' && (
                                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                                                            <Sparkles className="h-4 w-4 text-white" />
                                                        </div>
                                                    )}
                                                    <div
                                                        className={cn(
                                                            'max-w-[85%] rounded-lg p-4',
                                                            message.role === 'assistant'
                                                                ? 'bg-muted/30 border prose prose-sm max-w-none dark:prose-invert prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-blockquote:my-2 prose-blockquote:border-purple-300 prose-blockquote:bg-purple-50 dark:prose-blockquote:bg-purple-950/30 prose-blockquote:py-1 prose-blockquote:px-3 prose-blockquote:rounded'
                                                                : 'bg-primary text-primary-foreground',
                                                            message.status === 'error' && 'border-destructive'
                                                        )}
                                                    >
                                                        {message.role === 'assistant' ? (
                                                            message.status === 'streaming' && !message.content ? (
                                                                <div className="space-y-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <Sparkles className="size-4 text-violet-500 animate-pulse" />
                                                                        <span className="bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 bg-clip-text text-sm font-medium text-transparent animate-pulse">
                                                                            Thinking...
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
                                                    {message.role === 'user' && (
                                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                                                            <User className="h-4 w-4 text-primary-foreground" />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}

                                            <div ref={chatEndRef} />
                                        </div>

                                        {/* Follow-up Input - Styled like chat-input */}
                                        {chatMessages.length > 0 && chatMessages.some(m => m.status === 'complete') && (
                                            <div className="flex-shrink-0 pt-4 border-t">
                                                <div className="group relative">
                                                    {/* Rainbow gradient border effect */}
                                                    <div
                                                        className="absolute -inset-[1px] rounded-2xl opacity-0 blur-sm transition-opacity duration-300 group-focus-within:opacity-60"
                                                        style={{
                                                            background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899, #ef4444, #f97316, #eab308, #22c55e, #3b82f6)',
                                                            backgroundSize: '200% 100%',
                                                            animation: 'rainbow-shift 8s linear infinite',
                                                        }}
                                                    />
                                                    <div className="relative flex items-center gap-3 rounded-2xl border border-border/50 bg-card px-4 py-3 shadow-sm transition-all duration-200 group-focus-within:border-border group-focus-within:shadow-md">
                                                        <input
                                                            type="text"
                                                            placeholder="Ask a follow-up question..."
                                                            value={followUpQuestion}
                                                            onChange={(e) => setFollowUpQuestion(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                                    e.preventDefault();
                                                                    askFollowUp();
                                                                }
                                                            }}
                                                            disabled={followUpLoading || chatMessages.some(m => m.status === 'streaming')}
                                                            className="min-h-[24px] flex-1 bg-transparent text-base leading-relaxed outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:opacity-50"
                                                        />
                                                        <div className="flex shrink-0 items-center">
                                                            {(followUpLoading || chatMessages.some(m => m.status === 'streaming')) ? (
                                                                <Button
                                                                    type="button"
                                                                    size="icon"
                                                                    variant="outline"
                                                                    className="size-9 rounded-full"
                                                                    onClick={() => abortControllerRef.current?.abort()}
                                                                >
                                                                    <Square className="size-4" fill="currentColor" />
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    type="button"
                                                                    size="icon"
                                                                    className={cn(
                                                                        'size-9 rounded-full transition-all',
                                                                        followUpQuestion.trim()
                                                                            ? 'bg-foreground text-background shadow-md hover:bg-foreground/90 hover:scale-105'
                                                                            : 'bg-muted text-muted-foreground cursor-not-allowed'
                                                                    )}
                                                                    onClick={askFollowUp}
                                                                    disabled={!followUpQuestion.trim()}
                                                                >
                                                                    <ArrowUp className="size-5" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* CSS animation for rainbow effect */}
                                                <style>{`
                                                    @keyframes rainbow-shift {
                                                        0% { background-position: 0% 50%; }
                                                        100% { background-position: 200% 50%; }
                                                    }
                                                `}</style>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>

                        {/* Print-only detailed table */}
                        <div className="hidden print:block print:break-before-page">
                            <h2 className="text-xl font-bold mb-4">Detailed Comparison</h2>
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
                    <Card>
                        <CardContent className="p-12 text-center">
                            <Filter className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium mb-2">Select Filters to Generate Report</h3>
                            <p className="text-muted-foreground mb-4">
                                Choose your filters above and click "Apply Filters" to generate the PO comparison report.
                            </p>
                            <Button onClick={handleApplyFilters}>
                                <BarChart3 className="mr-2 h-4 w-4" />
                                Generate Report
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Empty state - after search with no results */}
                {!loading && !error && hasSearched && reportData.length === 0 && (
                    <Card>
                        <CardContent className="p-12 text-center">
                            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium mb-2">No Purchase Orders Found</h3>
                            <p className="text-muted-foreground">
                                No purchase orders match your current filters, or there are no POs synced with Premier yet.
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Print Styles */}
            <style>{`
                @media print {
                    .print\\:hidden {
                        display: none !important;
                    }
                    .print\\:block {
                        display: block !important;
                    }
                    .print\\:border {
                        border: 1px solid #e5e7eb !important;
                    }
                    .print\\:shadow-none {
                        box-shadow: none !important;
                    }
                    .print\\:p-0 {
                        padding: 0 !important;
                    }
                    .print\\:mb-6 {
                        margin-bottom: 1.5rem !important;
                    }
                    .print\\:grid-cols-4 {
                        grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
                    }
                    .print\\:grid-cols-6 {
                        grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
                    }
                    .print\\:break-before-page {
                        break-before: page !important;
                    }
                    body {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            `}</style>
        </AppLayout>
    );
}
