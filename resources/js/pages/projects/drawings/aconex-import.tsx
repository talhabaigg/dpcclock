import AconexIcon from '@/components/aconex-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { formatDistanceToNow } from 'date-fns';
import { ChevronLeft, ChevronRight, Download, Eye, FileText, Folder, Layers, Loader2, RefreshCw, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type Project = { id: number; name: string; aconex_project_id: string | null };

type AconexDocument = {
    aconex_document_id: string;
    document_number: string;
    title: string;
    doctype: string;
    discipline?: string;
    file_type: string;
    author: string;
    revision: string;
    version_number: number;
    date_modified: string;
    already_imported: boolean;
    import_is_new_revision: boolean;
    imported_revision: string | null;
    thumbnail_url?: string | null;
};

type AconexProjectOption = { id: string; name: string };

type AconexVersion = Omit<AconexDocument, 'import_is_new_revision' | 'imported_revision'>;

// Aconex brand coral — used as an integration accent (the accepted exception to
// the shadcn-tokens-only convention for a third-party mark).
const ACONEX_CORAL = '#E8600D';

// Known discipline prefixes → colour. Anything else groups by its own leading
// prefix (so a register that doesn't use these codes still splits sensibly).
const DISCIPLINE_MAP: Record<string, { label: string; color: string }> = {
    A: { label: 'Architectural', color: '#E8600D' },
    AR: { label: 'Architectural', color: '#E8600D' },
    ARC: { label: 'Architectural', color: '#E8600D' },
    S: { label: 'Structural', color: '#3B7DD8' },
    ST: { label: 'Structural', color: '#3B7DD8' },
    STR: { label: 'Structural', color: '#3B7DD8' },
    M: { label: 'Mechanical', color: '#8B5CF6' },
    MEC: { label: 'Mechanical', color: '#8B5CF6' },
    MECH: { label: 'Mechanical', color: '#8B5CF6' },
    E: { label: 'Electrical', color: '#0EA5A5' },
    ELE: { label: 'Electrical', color: '#0EA5A5' },
    ELEC: { label: 'Electrical', color: '#0EA5A5' },
    P: { label: 'Plumbing', color: '#D9418C' },
    PLU: { label: 'Plumbing', color: '#D9418C' },
    H: { label: 'Hydraulic', color: '#D9418C' },
    HYD: { label: 'Hydraulic', color: '#D9418C' },
    C: { label: 'Civil', color: '#0284C7' },
    CIV: { label: 'Civil', color: '#0284C7' },
    F: { label: 'Fire', color: '#DC2626' },
    FP: { label: 'Fire', color: '#DC2626' },
};

const GROUP_PALETTE = ['#0284C7', '#8B5CF6', '#0EA5A5', '#D9418C', '#DC2626', '#65A30D', '#CA8A04', '#3B7DD8'];

function groupColor(key: string): string {
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return GROUP_PALETTE[h % GROUP_PALETTE.length];
}

const DISCIPLINE_NAME_COLOR: Record<string, string> = {
    architectural: '#E8600D',
    structural: '#3B7DD8',
    mechanical: '#8B5CF6',
    electrical: '#0EA5A5',
    plumbing: '#D9418C',
    hydraulic: '#D9418C',
    civil: '#0284C7',
    fire: '#DC2626',
};

// Prefer Aconex's real Discipline metadata field. Only when it's absent do we
// fall back to guessing from the drawing-number prefix.
function groupOfDoc(doc: { document_number: string; discipline?: string }): { key: string; label: string; color: string } {
    const disc = (doc.discipline ?? '').trim();
    if (disc) return { key: disc, label: disc, color: DISCIPLINE_NAME_COLOR[disc.toLowerCase()] ?? groupColor(disc) };

    const prefix = (doc.document_number.match(/^[A-Za-z]+/)?.[0] ?? '').toUpperCase();
    const known = DISCIPLINE_MAP[prefix];
    const key = known ? known.label : prefix || 'Other';
    return { key, label: key, color: known ? known.color : groupColor(key) };
}

function csrfToken(): string {
    return (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content ?? '';
}

function buildQuery(text: string): string {
    const t = text.trim();
    return t ? `doctype:"Drawing" AND (${t})` : 'doctype:"Drawing"';
}

export default function AconexImport() {
    const { project } = usePage<{ project: Project }>().props;

    // Link-to-Aconex-project step
    const [aconexProjectId, setAconexProjectId] = useState<string | null>(project.aconex_project_id);
    const [aconexProjects, setAconexProjects] = useState<AconexProjectOption[] | null>(null);
    const [loadingAconexProjects, setLoadingAconexProjects] = useState(false);
    const [selectedAconexProjectId, setSelectedAconexProjectId] = useState<string>('');
    const [linking, setLinking] = useState(false);

    // Updates (drawings already imported that now have a newer Aconex revision)
    const [updates, setUpdates] = useState<AconexDocument[]>([]);
    const [updatesLoading, setUpdatesLoading] = useState(false);
    const [hasImported, setHasImported] = useState<boolean | null>(null);

    // Search results (server-paginated, 100/page)
    const [documents, setDocuments] = useState<AconexDocument[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [query, setQuery] = useState('doctype:"Drawing"');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(100);
    const [total, setTotal] = useState<number | null>(null);
    const [hasMore, setHasMore] = useState(false);

    const [activeFolder, setActiveFolder] = useState<string>('updates'); // 'updates' | 'all' | 'g:<key>'

    // Selection is keyed by document id and holds the full doc so it survives
    // paging and folder switches.
    const [selected, setSelected] = useState<Map<string, AconexDocument>>(new Map());
    const [importing, setImporting] = useState(false);
    const [previewDoc, setPreviewDoc] = useState<AconexDocument | null>(null);

    // Version-history dialog
    const [versionsFor, setVersionsFor] = useState<AconexDocument | null>(null);
    const [versions, setVersions] = useState<AconexVersion[] | null>(null);
    const [importingVersionId, setImportingVersionId] = useState<string | null>(null);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Projects', href: '/locations' },
        { title: project.name, href: `/locations/${project.id}` },
        { title: 'Drawings', href: `/projects/${project.id}/drawings` },
        { title: 'Import from Aconex', href: `/projects/${project.id}/drawings/import-aconex` },
    ];

    useEffect(() => {
        if (aconexProjectId) return;
        setLoadingAconexProjects(true);
        fetch('/aconex/projects', { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
            .then(async (res) => {
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message ?? 'Could not load Aconex projects');
                setAconexProjects(data.projects ?? []);
            })
            .catch((e: any) => toast.error(e?.message ?? 'Could not load Aconex projects'))
            .finally(() => setLoadingAconexProjects(false));
    }, [aconexProjectId]);

    // Nothing imported yet → skip the Updates folder and browse the register.
    const startBrowsing = () => {
        setHasImported(false);
        setSearched(true);
        setActiveFolder('all');
        loadPage(1, 'doctype:"Drawing"');
    };

    const loadUpdates = async () => {
        setUpdatesLoading(true);
        try {
            const res = await fetch(`/projects/${project.id}/drawings/aconex-updates`, {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message ?? 'Could not check for updates');
            if (data.has_imported === false) {
                startBrowsing();
                return;
            }
            setUpdates(data.documents ?? []);
            setHasImported(true);
        } catch (e: any) {
            toast.error(e?.message ?? 'Could not check for updates');
            startBrowsing();
        } finally {
            setUpdatesLoading(false);
        }
    };

    // Priority on open: check what we've already imported for newer revisions.
    useEffect(() => {
        if (aconexProjectId) loadUpdates();
    }, [aconexProjectId]);

    const loadPage = async (pageNum: number, q: string = query) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ query: q, page: String(pageNum) });
            const res = await fetch(`/projects/${project.id}/drawings/aconex-search?${params}`, {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message ?? 'Aconex search failed');
            setDocuments(data.documents ?? []);
            setPage(data.page ?? pageNum);
            setPageSize(data.page_size ?? 100);
            setTotal(typeof data.total === 'number' ? data.total : null);
            setHasMore(!!data.has_more);
        } catch (e: any) {
            toast.error(e?.message ?? 'Aconex search failed');
            setDocuments([]);
            setHasMore(false);
        } finally {
            setLoading(false);
        }
    };

    const runSearch = () => {
        const q = buildQuery(searchText);
        setQuery(q);
        setSearched(true);
        setActiveFolder('all');
        loadPage(1, q);
    };

    const handleLink = async () => {
        if (!selectedAconexProjectId) return;
        setLinking(true);
        try {
            const res = await fetch(`/projects/${project.id}/drawings/aconex-link`, {
                method: 'PATCH',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': csrfToken() },
                body: JSON.stringify({ aconex_project_id: selectedAconexProjectId }),
            });
            if (!res.ok) throw new Error('Failed to link project');
            setAconexProjectId(selectedAconexProjectId);
            toast.success('Linked to Aconex project');
        } catch (e: any) {
            toast.error(e?.message ?? 'Failed to link project');
        } finally {
            setLinking(false);
        }
    };

    const toggleOne = (doc: AconexDocument) => {
        setSelected((prev) => {
            const next = new Map(prev);
            if (next.has(doc.aconex_document_id)) next.delete(doc.aconex_document_id);
            else next.set(doc.aconex_document_id, doc);
            return next;
        });
    };

    const isPreviewable = (doc: AconexDocument | AconexVersion) => ['pdf', 'png', 'jpg', 'jpeg', 'gif'].includes(doc.file_type?.toLowerCase());
    const previewUrl = (doc: AconexDocument | AconexVersion) => `/projects/${project.id}/drawings/aconex-preview/${doc.aconex_document_id}`;

    const openVersions = async (doc: AconexDocument) => {
        setVersionsFor(doc);
        setVersions(null);
        try {
            const params = new URLSearchParams({ document_number: doc.document_number });
            const res = await fetch(`/projects/${project.id}/drawings/aconex-versions?${params}`, {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message ?? 'Could not load versions');
            setVersions(data.versions ?? []);
        } catch (e: any) {
            toast.error(e?.message ?? 'Could not load versions');
            setVersionsFor(null);
        }
    };

    const importVersion = async (version: AconexVersion) => {
        setImportingVersionId(version.aconex_document_id);
        try {
            const res = await fetch(`/projects/${project.id}/drawings/aconex-import`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': csrfToken() },
                body: JSON.stringify({
                    documents: [
                        {
                            aconex_document_id: version.aconex_document_id,
                            document_number: version.document_number,
                            title: version.title,
                            revision: version.revision,
                            version_number: version.version_number,
                            date_modified: version.date_modified,
                        },
                    ],
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message ?? 'Import failed');
            toast.success(data.message ?? 'Import queued');
            setVersions((prev) => prev?.map((v) => (v.aconex_document_id === version.aconex_document_id ? { ...v, already_imported: true } : v)) ?? null);
        } catch (e: any) {
            toast.error(e?.message ?? 'Import failed');
        } finally {
            setImportingVersionId(null);
        }
    };

    // ── Folders + displayed docs ────────────────────────────────────────────
    const resultGroups = useMemo(() => {
        const map = new Map<string, { label: string; color: string; count: number }>();
        documents.forEach((d) => {
            const g = groupOfDoc(d);
            const e = map.get(g.key) ?? { label: g.label, color: g.color, count: 0 };
            e.count += 1;
            map.set(g.key, e);
        });
        return Array.from(map.entries())
            .map(([key, v]) => ({ id: `g:${key}`, ...v }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [documents]);

    const displayed = useMemo(() => {
        if (activeFolder === 'updates') return updates;
        if (activeFolder === 'all') return documents;
        const key = activeFolder.slice(2);
        return documents.filter((d) => groupOfDoc(d).key === key);
    }, [activeFolder, updates, documents]);

    const inUpdates = activeFolder === 'updates';

    // ── Selection helpers ───────────────────────────────────────────────────
    const pageAllSelected = displayed.length > 0 && displayed.every((d) => selected.has(d.aconex_document_id));
    const pageSomeSelected = displayed.some((d) => selected.has(d.aconex_document_id)) && !pageAllSelected;
    const selectedCount = selected.size;

    const toggleAllDisplayed = () => {
        setSelected((prev) => {
            const next = new Map(prev);
            if (pageAllSelected) displayed.forEach((d) => next.delete(d.aconex_document_id));
            else displayed.forEach((d) => next.set(d.aconex_document_id, d));
            return next;
        });
    };

    const totalPages = total !== null ? Math.max(1, Math.ceil(total / pageSize)) : null;

    const handleImport = async () => {
        const docs = Array.from(selected.values());
        if (docs.length === 0) return;
        setImporting(true);
        try {
            const res = await fetch(`/projects/${project.id}/drawings/aconex-import`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': csrfToken() },
                body: JSON.stringify({
                    documents: docs.map((d) => ({
                        aconex_document_id: d.aconex_document_id,
                        document_number: d.document_number,
                        title: d.title,
                        revision: d.revision,
                        version_number: d.version_number,
                        date_modified: d.date_modified,
                    })),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message ?? 'Import failed');
            toast.success(data.message ?? 'Import queued');
            const importedIds = new Set(docs.map((d) => d.aconex_document_id));
            const markImported = (d: AconexDocument): AconexDocument =>
                importedIds.has(d.aconex_document_id) ? { ...d, already_imported: true, import_is_new_revision: false, imported_revision: d.revision } : d;
            setDocuments((prev) => prev.map(markImported));
            // Imported updates are no longer "updates".
            setUpdates((prev) => prev.filter((d) => !importedIds.has(d.aconex_document_id)));
            setSelected(new Map());
        } catch (e: any) {
            toast.error(e?.message ?? 'Import failed');
        } finally {
            setImporting(false);
        }
    };

    // ── Link step ───────────────────────────────────────────────────────────
    if (!aconexProjectId) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title={`Import from Aconex — ${project.name}`} />
                <div className="mx-auto w-full max-w-2xl space-y-4 p-2 sm:p-4">
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border" style={{ backgroundColor: `${ACONEX_CORAL}1a` }}>
                            <AconexIcon className="h-7 w-7" />
                        </div>
                        <div>
                            <h1 className="text-lg leading-tight font-semibold tracking-tight">Import from Aconex</h1>
                            <p className="text-muted-foreground text-sm">Connect {project.name} to its Aconex project to start importing drawings.</p>
                        </div>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <AconexIcon className="h-4 w-4" />
                                Link this project to Aconex
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-muted-foreground text-sm">
                                Pick the Aconex project that corresponds to <strong>{project.name}</strong>. This only needs to be done once.
                            </p>
                            <Select value={selectedAconexProjectId} onValueChange={setSelectedAconexProjectId} disabled={loadingAconexProjects}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder={loadingAconexProjects ? 'Loading Aconex projects...' : 'Select an Aconex project'} />
                                </SelectTrigger>
                                <SelectContent>
                                    {(aconexProjects ?? []).map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.name} ({p.id})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button onClick={handleLink} disabled={!selectedAconexProjectId || linking} className="gap-2">
                                {linking && <Loader2 className="h-4 w-4 animate-spin" />}
                                Link project
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </AppLayout>
        );
    }

    const statePill = (doc: AconexDocument) => {
        if (doc.import_is_new_revision)
            return (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: ACONEX_CORAL }}>
                    Update
                </span>
            );
        if (doc.already_imported) return <Badge variant="secondary" className="px-2 py-0.5 text-[10px]">Imported</Badge>;
        return <Badge variant="outline" className="px-2 py-0.5 text-[10px]">New</Badge>;
    };

    const revBadge = (doc: AconexDocument) => {
        const up = doc.import_is_new_revision && doc.imported_revision;
        const label = up ? `${doc.imported_revision} → ${doc.revision || '—'}` : `Rev ${doc.revision || '—'}`;
        const clickable = doc.version_number > 1;
        return (
            <span
                onClick={clickable ? (e) => { e.stopPropagation(); openVersions(doc); } : undefined}
                title={clickable ? `View all ${doc.version_number} versions in Aconex` : undefined}
                className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap', clickable && 'cursor-pointer', !up && 'bg-muted text-muted-foreground')}
                style={up ? { backgroundColor: `${ACONEX_CORAL}1f`, color: ACONEX_CORAL } : undefined}
            >
                {label}
            </span>
        );
    };

    const previewButton = (doc: AconexDocument, className?: string) =>
        isPreviewable(doc) ? (
            <Button variant="secondary" size="icon" className={cn('h-7 w-7', className)} title="Preview" onClick={(e) => { e.stopPropagation(); setPreviewDoc(doc); }}>
                <Eye className="h-4 w-4" />
            </Button>
        ) : (
            <Button
                variant="secondary"
                size="icon"
                className={cn('h-7 w-7', className)}
                title={`Download ${doc.file_type?.toUpperCase() || 'file'}`}
                onClick={(e) => { e.stopPropagation(); window.open(previewUrl(doc), '_blank', 'noopener'); }}
            >
                <Download className="h-4 w-4" />
            </Button>
        );

    const folders: { id: string; name: string; count: number; coral?: boolean; color?: string }[] = [
        ...(hasImported ? [{ id: 'updates', name: 'Updates available', count: updates.length, coral: true }] : []),
        ...(searched
            ? [
                  { id: 'all', name: 'All results', count: documents.length },
                  ...resultGroups.map((g) => ({ id: g.id, name: g.label, count: g.count, color: g.color })),
              ]
            : []),
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Import from Aconex — ${project.name}`} />

            <div className="mx-auto w-full max-w-6xl space-y-4 p-2 sm:p-4">
                {/* Hero */}
                <Card className="overflow-hidden py-0">
                    <div aria-hidden className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${ACONEX_CORAL}, #f0894a)` }} />
                    <div className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border" style={{ backgroundColor: `${ACONEX_CORAL}1a` }}>
                            <AconexIcon className="h-8 w-8" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-xl leading-tight font-bold tracking-tight">Import from Aconex</h1>
                                <Badge variant="secondary" className="gap-1.5 font-normal">
                                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACONEX_CORAL }} />
                                    Connected
                                </Badge>
                            </div>
                            <p className="text-muted-foreground text-sm">Pull drawings straight from your Aconex document register into {project.name}.</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                            <div className="hidden text-right sm:block">
                                <div className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Aconex project</div>
                                <div className="font-mono text-sm">{aconexProjectId}</div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setSelectedAconexProjectId('');
                                    setAconexProjectId(null);
                                    setSelected(new Map());
                                }}
                            >
                                Change
                            </Button>
                        </div>
                    </div>
                </Card>

                {/* Picker */}
                <Card className="flex flex-col overflow-hidden py-0">
                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-2 border-b p-3 sm:px-4">
                        <div className="relative min-w-0 flex-1 sm:max-w-sm">
                            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                            <Input
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                                placeholder="Search drawings by number or title…"
                                className="pl-9"
                            />
                        </div>
                        <Button onClick={runSearch} disabled={loading} className="gap-2">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            Search
                        </Button>
                    </div>

                    {/* Body: folder sidebar + results */}
                    <div className="flex min-h-[460px]">
                        {/* Sidebar */}
                        <div className="hidden w-56 shrink-0 flex-col overflow-y-auto border-r p-2 md:flex">
                            <div className="text-muted-foreground px-2 py-1.5 text-[11px] font-semibold tracking-wide uppercase">Browse</div>
                            {folders.map((f) => {
                                const active = f.id === activeFolder;
                                const isUpdates = f.id === 'updates';
                                const highlight = isUpdates && f.count > 0;
                                const dotColor = 'color' in f ? (f as { color: string }).color : undefined;
                                return (
                                    <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => setActiveFolder(f.id)}
                                        className={cn(
                                            'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                                            active ? 'bg-muted font-medium' : 'hover:bg-muted/60 text-muted-foreground',
                                        )}
                                    >
                                        <span className="flex shrink-0">
                                            {isUpdates ? (
                                                <RefreshCw className="h-4 w-4" style={{ color: highlight ? ACONEX_CORAL : undefined }} />
                                            ) : f.id === 'all' ? (
                                                <Layers className="h-4 w-4" />
                                            ) : (
                                                <Folder className="h-4 w-4" style={{ color: dotColor }} />
                                            )}
                                        </span>
                                        <span className="flex-1 truncate">{f.name}</span>
                                        {(isUpdates ? f.count > 0 : true) && (
                                            <span
                                                className={cn('rounded-full text-[11px] font-semibold', highlight ? 'px-1.5 py-0.5 text-white' : 'text-muted-foreground')}
                                                style={highlight ? { backgroundColor: ACONEX_CORAL } : undefined}
                                            >
                                                {f.count}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                            {!searched && (
                                <p className="text-muted-foreground/70 mt-2 px-2 text-xs leading-relaxed">Search to browse the rest of the register by discipline.</p>
                            )}
                        </div>

                        {/* Results */}
                        <div className="flex min-w-0 flex-1 flex-col">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
                                <label className="flex cursor-pointer items-center gap-2 text-sm">
                                    <Checkbox
                                        checked={pageAllSelected}
                                        indeterminate={pageSomeSelected}
                                        onCheckedChange={toggleAllDisplayed}
                                        aria-label="Select all shown"
                                        disabled={displayed.length === 0}
                                    />
                                    <span className="font-medium">{inUpdates ? 'Select all updates' : 'Select shown'}</span>
                                    <span className="text-muted-foreground">·</span>
                                    <span className="text-muted-foreground tabular-nums">
                                        {inUpdates
                                            ? `${updates.length} update${updates.length === 1 ? '' : 's'}`
                                            : total !== null
                                              ? `${displayed.length} of ${total.toLocaleString()}`
                                              : `${displayed.length} shown`}
                                    </span>
                                </label>
                                {!inUpdates && searched && (
                                    <div className="flex items-center gap-1 text-xs">
                                        <Button variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1 || loading} onClick={() => loadPage(page - 1)} aria-label="Previous page">
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <span className="text-muted-foreground min-w-16 text-center tabular-nums">Page {page}{totalPages ? ` of ${totalPages}` : ''}</span>
                                        <Button variant="outline" size="icon" className="h-7 w-7" disabled={!hasMore || loading} onClick={() => loadPage(page + 1)} aria-label="Next page">
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>

                            <div className="min-h-[400px] p-3 sm:p-4">
                                {(inUpdates ? updatesLoading : loading) ? (
                                    <div className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        {inUpdates ? 'Checking Aconex for newer revisions…' : 'Loading drawings…'}
                                    </div>
                                ) : displayed.length === 0 ? (
                                    <div className="text-muted-foreground flex flex-col items-center py-16 text-center">
                                        <FileText className="text-muted-foreground/30 mb-2 h-10 w-10" />
                                        <p className="text-sm">
                                            {inUpdates
                                                ? 'Every Aconex drawing you’ve imported is at its latest revision.'
                                                : searched
                                                  ? 'No drawings match your search'
                                                  : 'Search to find drawings to import'}
                                        </p>
                                        {inUpdates && (
                                            <p className="text-muted-foreground/70 mt-1 text-xs">Use search above to import new drawings.</p>
                                        )}
                                    </div>
                                ) : (
                                    <Card className="overflow-hidden py-0">
                                        <Table className="text-xs">
                                                <TableHeader className="bg-muted/50">
                                                    <TableRow>
                                                        <TableHead className="w-10" />
                                                        {inUpdates && <TableHead className="w-12" />}
                                                        <TableHead>Number</TableHead>
                                                        <TableHead>Title</TableHead>
                                                        <TableHead className="hidden sm:table-cell">Rev</TableHead>
                                                        <TableHead className="hidden md:table-cell">Discipline</TableHead>
                                                        <TableHead>Status</TableHead>
                                                        <TableHead className="hidden lg:table-cell">Modified</TableHead>
                                                        <TableHead className="w-10" />
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {displayed.map((doc) => {
                                                        const isSel = selected.has(doc.aconex_document_id);
                                                        const g = groupOfDoc(doc);
                                                        return (
                                                            <TableRow
                                                                key={doc.aconex_document_id}
                                                                data-state={isSel ? 'selected' : undefined}
                                                                className="cursor-pointer"
                                                                onClick={() => toggleOne(doc)}
                                                            >
                                                                <TableCell onClick={(e) => e.stopPropagation()}>
                                                                    <Checkbox checked={isSel} onCheckedChange={() => toggleOne(doc)} aria-label={`Select ${doc.title}`} />
                                                                </TableCell>
                                                                {inUpdates && (
                                                                    <TableCell>
                                                                        <div className="bg-muted flex h-9 w-9 items-center justify-center overflow-hidden rounded border">
                                                                            {doc.thumbnail_url ? (
                                                                                <img src={doc.thumbnail_url} alt="" loading="lazy" className="h-full w-full object-cover dark:brightness-90 dark:invert" />
                                                                            ) : (
                                                                                <FileText className="text-muted-foreground/40 h-4 w-4" />
                                                                            )}
                                                                        </div>
                                                                    </TableCell>
                                                                )}
                                                                <TableCell className="font-semibold tabular-nums whitespace-nowrap">{doc.document_number}</TableCell>
                                                                <TableCell className="text-muted-foreground break-words whitespace-normal">
                                                                    {doc.title}
                                                                </TableCell>
                                                                <TableCell className="hidden sm:table-cell">{revBadge(doc)}</TableCell>
                                                                <TableCell className="text-muted-foreground hidden md:table-cell">
                                                                    <span className="flex items-center gap-1.5">
                                                                        <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ backgroundColor: g.color }} />
                                                                        {g.label}
                                                                    </span>
                                                                </TableCell>
                                                                <TableCell>{statePill(doc)}</TableCell>
                                                                <TableCell className="text-muted-foreground hidden lg:table-cell">
                                                                    {doc.date_modified ? formatDistanceToNow(new Date(doc.date_modified), { addSuffix: true }) : '—'}
                                                                </TableCell>
                                                                <TableCell onClick={(e) => e.stopPropagation()}>{previewButton(doc)}</TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                        </Table>
                                    </Card>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer action bar */}
                    <div className="bg-muted/30 flex flex-wrap items-center justify-between gap-3 border-t p-3 sm:px-4">
                        <div className="text-muted-foreground text-sm">
                            {selectedCount > 0 ? (
                                <span>
                                    <strong className="text-foreground font-bold tabular-nums">{selectedCount}</strong> drawing{selectedCount === 1 ? '' : 's'} selected
                                </span>
                            ) : (
                                <span className="text-muted-foreground/80">
                                    {inUpdates ? 'Select updated drawings to bring in at their latest revision.' : 'Select drawings to import into your project.'}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {selectedCount > 0 && (
                                <Button variant="ghost" size="sm" onClick={() => setSelected(new Map())} disabled={importing}>
                                    Clear
                                </Button>
                            )}
                            <Button variant="outline" onClick={() => router.visit(`/projects/${project.id}/drawings`)}>
                                Cancel
                            </Button>
                            <Button onClick={handleImport} disabled={selectedCount === 0 || importing} className="gap-2">
                                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                {selectedCount > 0 ? `Import ${selectedCount} drawing${selectedCount === 1 ? '' : 's'}` : 'Import drawings'}
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>

            <Dialog open={!!versionsFor} onOpenChange={(open) => !open && setVersionsFor(null)}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="truncate pr-8 text-sm">Versions of {versionsFor?.document_number}</DialogTitle>
                        <DialogDescription className="text-xs">{versionsFor?.title} — only versions transmitted to your organisation appear here.</DialogDescription>
                    </DialogHeader>
                    {versions === null ? (
                        <div className="text-muted-foreground flex items-center justify-center gap-2 py-8 text-sm">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading versions...
                        </div>
                    ) : (
                        <div className="max-h-[60vh] overflow-y-auto">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead>Version</TableHead>
                                        <TableHead>Rev</TableHead>
                                        <TableHead className="hidden sm:table-cell">Modified</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="w-20" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {versions.map((version, i) => (
                                        <TableRow key={version.aconex_document_id}>
                                            <TableCell className="text-xs">
                                                v{version.version_number}
                                                {i === 0 && (
                                                    <Badge variant="secondary" className="ml-2 text-[10px]">
                                                        Current
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs">{version.revision || '—'}</TableCell>
                                            <TableCell className="text-muted-foreground hidden text-xs sm:table-cell">
                                                {version.date_modified ? formatDistanceToNow(new Date(version.date_modified), { addSuffix: true }) : '—'}
                                            </TableCell>
                                            <TableCell>
                                                {version.already_imported ? (
                                                    <Badge variant="secondary" className="text-xs">
                                                        Imported
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-xs">
                                                        Not imported
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    {isPreviewable(version) && (
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Preview" onClick={() => setPreviewDoc(version as AconexDocument)}>
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {!version.already_imported && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7"
                                                            title="Import this version"
                                                            disabled={importingVersionId !== null}
                                                            onClick={() => importVersion(version)}
                                                        >
                                                            {importingVersionId === version.aconex_document_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
                <DialogContent className="flex h-[92vh] flex-col gap-2 p-4 sm:max-w-[90vw]">
                    <DialogHeader className="shrink-0">
                        <DialogTitle className="truncate pr-8 text-sm">
                            {previewDoc?.document_number} — {previewDoc?.title}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Rev {previewDoc?.revision || '—'} · {previewDoc?.doctype || 'Document'}
                        </DialogDescription>
                    </DialogHeader>
                    {previewDoc && <iframe src={previewUrl(previewDoc)} title={previewDoc.title} className="w-full flex-1 rounded-md border bg-white" />}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
