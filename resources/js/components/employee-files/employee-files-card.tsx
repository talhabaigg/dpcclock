import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { router } from '@inertiajs/react';
import { CheckCircle, Clock, Download, GraduationCap, Loader2, Minus, Plus, Trash2, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import UploadFileDialog from './upload-file-dialog';

interface FileType {
    id: number;
    name: string;
    category: string[] | null;
    has_back_side: boolean;
    expiry_requirement: 'required' | 'optional' | 'none';
    requires_completed_date: boolean;
}

interface EmployeeFileRecord {
    id: number;
    document_number: string | null;
    expires_at: string | null;
    completed_at: string | null;
    status: 'valid' | 'expired' | 'expiring_soon';
    notes: string | null;
    uploaded_by: string | null;
    created_at: string;
    file_type: FileType;
    front_url: string | null;
    back_url: string | null;
    front_filename: string | null;
    back_filename: string | null;
}

function StatusIcon({ status }: { status: string }) {
    switch (status) {
        case 'valid':
            return <CheckCircle className="h-4 w-4 text-green-500" />;
        case 'expiring_soon':
            return <Clock className="h-4 w-4 text-yellow-500" />;
        case 'expired':
            return <XCircle className="h-4 w-4 text-red-500" />;
        case 'missing':
            return <Minus className="h-4 w-4 text-gray-400" />;
        default:
            return null;
    }
}

function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
        valid: { label: 'Valid', variant: 'default' },
        expiring_soon: { label: 'Expiring Soon', variant: 'secondary' },
        expired: { label: 'Expired', variant: 'destructive' },
        missing: { label: 'Missing', variant: 'outline' },
    };
    const c = config[status] ?? { label: status, variant: 'outline' as const };
    return (
        <Badge variant={c.variant} className="text-[10px]">
            {c.label}
        </Badge>
    );
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function EmployeeFilesCard({ employeeId }: { employeeId: number }) {
    const [files, setFiles] = useState<EmployeeFileRecord[]>([]);
    const [fileTypes, setFileTypes] = useState<FileType[]>([]);
    const [loading, setLoading] = useState(true);
    const [showUpload, setShowUpload] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch(`/employees/${employeeId}/files`, {
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            });
            const data = await res.json();
            setFiles(data.files ?? []);

            const typeMap = new Map<number, FileType>();
            (data.files ?? []).forEach((f: EmployeeFileRecord) => typeMap.set(f.file_type.id, f.file_type));
            // Also include types from all active file types for the upload dialog
            if (data.all_file_types) {
                (data.all_file_types as FileType[]).forEach((ft) => typeMap.set(ft.id, ft));
            }
            setFileTypes(Array.from(typeMap.values()));
        } catch {
            // silent fail
        } finally {
            setLoading(false);
        }
    }, [employeeId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const handler = () => fetchData();
        document.addEventListener('inertia:finish', handler);
        return () => document.removeEventListener('inertia:finish', handler);
    }, [fetchData]);

    const handleDelete = (fileId: number) => {
        if (!confirm('Are you sure you want to delete this file?')) return;
        router.delete(`/employees/${employeeId}/files/${fileId}`, { preserveState: true, preserveScroll: true });
    };

    // Group uploaded files by first category
    const filesByCategory = useMemo(() => {
        const grouped: Record<string, EmployeeFileRecord[]> = {};
        for (const f of files) {
            const cat = (f.file_type.category && f.file_type.category.length > 0) ? f.file_type.category[0] : 'Other';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(f);
        }
        return grouped;
    }, [files]);

    const categories = useMemo(() => Object.keys(filesByCategory).sort(), [filesByCategory]);

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <GraduationCap className="h-4 w-4" />
                            Licences, tickets & training
                        </CardTitle>
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowUpload(true)}>
                            <Plus className="h-3.5 w-3.5" />
                            Upload
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="pt-0">
                    <Separator className="mb-4" />

                    {loading ? (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
                        </div>
                    ) : files.length === 0 ? (
                        <p className="text-muted-foreground text-sm italic">No files uploaded.</p>
                    ) : (
                        <div className="flex flex-col gap-5">
                            {categories.map((cat) => (
                                <div key={cat} className="flex flex-col gap-1">
                                    <p className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wide">{cat}</p>
                                    {filesByCategory[cat].map((f) => (
                                        <div key={f.id} className="hover:bg-muted/50 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                                            <StatusIcon status={f.status} />
                                            <span className="min-w-0 flex-1 truncate font-medium">{f.file_type.name}</span>
                                            {f.completed_at && (
                                                <span className="text-muted-foreground shrink-0 text-xs">Completed: {formatDate(f.completed_at)}</span>
                                            )}
                                            {f.expires_at && (
                                                <span className="text-muted-foreground shrink-0 text-xs">Exp: {formatDate(f.expires_at)}</span>
                                            )}
                                            <StatusBadge status={f.status} />
                                            <div className="flex shrink-0 gap-0.5">
                                                {f.front_url && (
                                                    <a href={f.front_url} target="_blank" rel="noopener noreferrer" title={f.front_filename ?? 'Download front'}>
                                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                                            <Download size={12} />
                                                        </Button>
                                                    </a>
                                                )}
                                                {f.back_url && (
                                                    <a href={f.back_url} target="_blank" rel="noopener noreferrer" title={f.back_filename ?? 'Download back'}>
                                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                                            <Download size={12} />
                                                        </Button>
                                                    </a>
                                                )}
                                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500" onClick={() => handleDelete(f.id)}>
                                                    <Trash2 size={12} />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <UploadFileDialog open={showUpload} onOpenChange={setShowUpload} employeeId={employeeId} fileTypes={fileTypes} />
        </>
    );
}
