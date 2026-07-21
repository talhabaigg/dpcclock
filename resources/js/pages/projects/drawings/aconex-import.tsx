import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle, Clock, Download, Eye, FileText, Link2, Loader2, RefreshCw, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type Project = { id: number; name: string; aconex_project_id: string | null };

type Drawing = {
    id: number;
    sheet_number: string | null;
    title: string | null;
    status: string;
    created_at: string;
};

type AconexDocument = {
    aconex_document_id: string;
    document_number: string;
    title: string;
    doctype: string;
    file_type: string;
    author: string;
    revision: string;
    date_modified: string;
    already_imported: boolean;
    import_is_new_revision: boolean;
};

type AconexProjectOption = { id: string; name: string };

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: typeof Loader2 }> = {
    draft: { label: 'Draft', variant: 'outline', icon: Clock },
    processing: { label: 'Processing', variant: 'default', icon: Loader2 },
    pending_review: { label: 'Needs Review', variant: 'outline', icon: Clock },
    active: { label: 'Active', variant: 'secondary', icon: CheckCircle },
};

function csrfToken(): string {
    return (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content ?? '';
}

export default function AconexImport() {
    const { project, recentDrawings: initialDrawings } = usePage<{
        project: Project;
        recentDrawings: Drawing[];
    }>().props;

    const [drawings, setDrawings] = useState<Drawing[]>(initialDrawings);

    // Link-to-Aconex-project step
    const [aconexProjectId, setAconexProjectId] = useState<string | null>(project.aconex_project_id);
    const [aconexProjects, setAconexProjects] = useState<AconexProjectOption[] | null>(null);
    const [loadingAconexProjects, setLoadingAconexProjects] = useState(false);
    const [selectedAconexProjectId, setSelectedAconexProjectId] = useState<string>('');
    const [linking, setLinking] = useState(false);

    // Search/select step
    const [query, setQuery] = useState('doctype:"Drawing"');
    const [documents, setDocuments] = useState<AconexDocument[]>([]);
    const [searching, setSearching] = useState(false);
    const [searched, setSearched] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [importing, setImporting] = useState(false);
    const [previewDoc, setPreviewDoc] = useState<AconexDocument | null>(null);

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

    const handleLink = async () => {
        if (!selectedAconexProjectId) return;
        setLinking(true);
        try {
            const res = await fetch(`/projects/${project.id}/drawings/aconex-link`, {
                method: 'PATCH',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken(),
                },
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

    const handleSearch = async () => {
        setSearching(true);
        setSearched(true);
        setSelectedIds(new Set());
        try {
            const params = new URLSearchParams({ query });
            const res = await fetch(`/projects/${project.id}/drawings/aconex-search?${params}`, {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message ?? 'Search failed');
            setDocuments(data.documents ?? []);
        } catch (e: any) {
            toast.error(e?.message ?? 'Search failed');
            setDocuments([]);
        } finally {
            setSearching(false);
        }
    };

    const allSelected = documents.length > 0 && selectedIds.size === documents.length;
    const someSelected = selectedIds.size > 0 && !allSelected;

    const toggleAll = () => {
        setSelectedIds(allSelected ? new Set() : new Set(documents.map((d) => d.aconex_document_id)));
    };

    const toggleOne = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectedDocs = useMemo(() => documents.filter((d) => selectedIds.has(d.aconex_document_id)), [documents, selectedIds]);

    // Only formats browsers can render natively — CAD formats (dwg, dgn, ifc...) must be downloaded.
    const isPreviewable = (doc: AconexDocument) => ['pdf', 'png', 'jpg', 'jpeg', 'gif'].includes(doc.file_type?.toLowerCase());
    const previewUrl = (doc: AconexDocument) => `/projects/${project.id}/drawings/aconex-preview/${doc.aconex_document_id}`;

    const handleImport = async () => {
        if (selectedDocs.length === 0) return;
        setImporting(true);
        try {
            const res = await fetch(`/projects/${project.id}/drawings/aconex-import`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken(),
                },
                body: JSON.stringify({
                    documents: selectedDocs.map((d) => ({
                        aconex_document_id: d.aconex_document_id,
                        document_number: d.document_number,
                        title: d.title,
                        revision: d.revision,
                    })),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message ?? 'Import failed');
            toast.success(data.message ?? 'Import queued');
            setSelectedIds(new Set());
        } catch (e: any) {
            toast.error(e?.message ?? 'Import failed');
        } finally {
            setImporting(false);
        }
    };

    const handleRefresh = () => router.reload({ only: ['recentDrawings'], onSuccess: () => setDrawings(initialDrawings) });

    if (!aconexProjectId) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title={`Import from Aconex — ${project.name}`} />
                <div className="mx-auto w-full max-w-2xl space-y-4 p-2 sm:p-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Link2 className="h-4 w-4" />
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

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Import from Aconex — ${project.name}`} />

            <div className="mx-auto w-full max-w-5xl space-y-4 p-2 sm:p-4">
                <Card>
                    <CardContent className="space-y-3 p-3 sm:p-6">
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder='e.g. partition, or doctype:"Drawing" AND level 3'
                                className="flex-1"
                            />
                            <Button onClick={handleSearch} disabled={searching} className="gap-2">
                                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                Search
                            </Button>
                        </div>
                        <p className="text-muted-foreground text-xs">
                            Defaults to drawings only. Clear the query to search all document types, or use Aconex search syntax (e.g.{' '}
                            <code>doctype:"Shop Drawing"</code>).
                        </p>
                    </CardContent>
                </Card>

                {searched && (
                    <Card className="py-0">
                        <CardContent className="p-0">
                            {documents.length === 0 ? (
                                <div className="text-muted-foreground flex flex-col items-center py-12 text-center">
                                    <FileText className="text-muted-foreground/30 mb-2 h-10 w-10" />
                                    <p className="text-sm">No documents matched that search</p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between border-b px-3 py-2 sm:px-6">
                                        <span className="text-muted-foreground text-xs">
                                            {documents.length} document{documents.length === 1 ? '' : 's'} found
                                            {selectedIds.size > 0 && ` — ${selectedIds.size} selected`}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            {documents.some((d) => d.import_is_new_revision) && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-2"
                                                    onClick={() =>
                                                        setSelectedIds(
                                                            new Set(
                                                                documents
                                                                    .filter((d) => d.import_is_new_revision)
                                                                    .map((d) => d.aconex_document_id),
                                                            ),
                                                        )
                                                    }
                                                >
                                                    <RefreshCw className="h-4 w-4" />
                                                    Select new revisions
                                                </Button>
                                            )}
                                            <Button onClick={handleImport} disabled={selectedIds.size === 0 || importing} size="sm" className="gap-2">
                                                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                                Import selected
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader className="bg-muted/50">
                                                <TableRow>
                                                    <TableHead className="w-10 pl-3 sm:pl-6">
                                                        <Checkbox
                                                            checked={allSelected}
                                                            indeterminate={someSelected}
                                                            onCheckedChange={toggleAll}
                                                            aria-label="Select all"
                                                        />
                                                    </TableHead>
                                                    <TableHead>Title</TableHead>
                                                    <TableHead>File</TableHead>
                                                    <TableHead className="hidden sm:table-cell">Doc No.</TableHead>
                                                    <TableHead className="hidden md:table-cell">Type</TableHead>
                                                    <TableHead className="hidden md:table-cell">Rev</TableHead>
                                                    <TableHead className="hidden lg:table-cell">Modified</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead className="w-10" />
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {documents.map((doc) => (
                                                    <TableRow key={doc.aconex_document_id}>
                                                        <TableCell className="pl-3 sm:pl-6">
                                                            <Checkbox
                                                                checked={selectedIds.has(doc.aconex_document_id)}
                                                                onCheckedChange={() => toggleOne(doc.aconex_document_id)}
                                                                aria-label={`Select ${doc.title}`}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="max-w-[260px] truncate text-sm font-medium" title={doc.title}>
                                                            {doc.title}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className="text-[10px] uppercase">
                                                                {doc.file_type || '?'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="hidden text-xs sm:table-cell">{doc.document_number}</TableCell>
                                                        <TableCell className="hidden text-xs md:table-cell">{doc.doctype}</TableCell>
                                                        <TableCell className="hidden text-xs md:table-cell">{doc.revision}</TableCell>
                                                        <TableCell className="text-muted-foreground hidden text-xs lg:table-cell">
                                                            {doc.date_modified ? formatDistanceToNow(new Date(doc.date_modified), { addSuffix: true }) : '—'}
                                                        </TableCell>
                                                        <TableCell>
                                                            {doc.import_is_new_revision ? (
                                                                <Badge variant="default" className="text-xs">
                                                                    New revision
                                                                </Badge>
                                                            ) : doc.already_imported ? (
                                                                <Badge variant="secondary" className="text-xs">
                                                                    Imported
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="text-xs">
                                                                    New
                                                                </Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="pr-3 sm:pr-6">
                                                            {isPreviewable(doc) ? (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7"
                                                                    title="Preview"
                                                                    onClick={() => setPreviewDoc(doc)}
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7"
                                                                    title={`Download ${doc.file_type?.toUpperCase() || 'file'} (can't be previewed in the browser)`}
                                                                    onClick={() => window.open(previewUrl(doc), '_blank', 'noopener')}
                                                                >
                                                                    <Download className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                )}

                <div className="flex items-center justify-between pt-2">
                    <div>
                        <h2 className="text-base font-semibold tracking-tight">Recently imported from Aconex</h2>
                        <p className="text-muted-foreground text-xs">Only shows drawings that came through Aconex — imports land here once processed.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                    </Button>
                </div>

                <Card className="py-0">
                    <CardContent className="p-0">
                        {drawings.length === 0 ? (
                            <div className="text-muted-foreground flex flex-col items-center py-12 text-center">
                                <FileText className="text-muted-foreground/30 mb-2 h-10 w-10" />
                                <p className="text-sm">No drawings yet</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead className="pl-3 sm:pl-6">Title</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="hidden lg:table-cell">Imported</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {drawings.map((drawing) => {
                                            const sConfig = statusConfig[drawing.status] || statusConfig.draft;
                                            const StatusIcon = sConfig.icon;
                                            return (
                                                <TableRow key={drawing.id}>
                                                    <TableCell className="pl-3 sm:pl-6 text-sm font-medium">{drawing.title || '—'}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={sConfig.variant} className="gap-1 text-xs">
                                                            <StatusIcon className={`h-3 w-3 ${drawing.status === 'processing' ? 'animate-spin' : ''}`} />
                                                            {sConfig.label}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground hidden text-xs lg:table-cell">
                                                        {formatDistanceToNow(new Date(drawing.created_at), { addSuffix: true })}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

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
                    {previewDoc && (
                        <iframe
                            src={previewUrl(previewDoc)}
                            title={previewDoc.title}
                            className="w-full flex-1 rounded-md border bg-white"
                        />
                    )}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
