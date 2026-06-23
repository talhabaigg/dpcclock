import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, EllipsisVertical } from 'lucide-react';
import { useMemo, useState } from 'react';

interface Person {
    id: number;
    name: string;
}

interface SignedEntry {
    id: number;
    employee: { id: number; name: string };
    signed_at: string;
    original_signed_at: string | null;
    carried_from_version: { id: string; version_number: string; url: string } | null;
    signature_url: string | null;
    signature_download_url: string | null;
}

interface Props {
    location: { id: number; name: string };
    swms: {
        id: string;
        name: string;
        description: string | null;
    };
    version: {
        id: string;
        version_number: string;
        status: string;
        status_label: string;
        requires_resignature: boolean;
        change_summary: string | null;
        approved_at: string | null;
        created_at: string;
        updated_at: string;
        created_by: Person | null;
        updated_by: Person | null;
        document_url: string | null;
        document_filename: string | null;
        previous_version: { id: string; version_number: string } | null;
    };
    signed: SignedEntry[];
    unsigned: { id: number; name: string }[];
}

type SortKey = 'name' | 'signed_at' | 'carried';
type SortDir = 'asc' | 'desc';

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
    switch (status) {
        case 'active':
            return 'default';
        case 'superseded':
            return 'secondary';
        case 'archived':
            return 'outline';
        default:
            return 'outline';
    }
}

function fmtDateTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
}

function fmtDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-AU');
}

export default function SwmsVersionShow({ location, swms, version, signed, unsigned }: Props) {
    const baseUrl = `/locations/${location.id}/swms`;
    const versionBase = `${baseUrl}/${swms.id}/versions/${version.id}`;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Locations', href: '/locations' },
        { title: location.name, href: `/locations/${location.id}` },
        { title: 'SWMS', href: baseUrl },
        { title: swms.name, href: `${baseUrl}/${swms.id}` },
        { title: version.version_number, href: versionBase },
    ];

    const { auth } = usePage<{ auth: { permissions?: string[] } }>().props as {
        auth: { permissions?: string[] };
    };
    const can = (p: string) => (auth?.permissions ?? []).includes(p);

    const [sortKey, setSortKey] = useState<SortKey>('signed_at');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    const [editOpen, setEditOpen] = useState(false);
    const editForm = useForm({
        version_number: version.version_number,
        requires_resignature: version.requires_resignature as boolean,
        change_summary: version.change_summary ?? '',
        approved_at: version.approved_at ? version.approved_at.slice(0, 10) : '',
    });

    const submitEdit = (e: React.FormEvent) => {
        e.preventDefault();
        editForm.put(versionBase, {
            preserveScroll: true,
            onSuccess: () => setEditOpen(false),
        });
    };

    const sortedSigned = useMemo(() => {
        const rows = [...signed];
        rows.sort((a, b) => {
            let av: string | number = '';
            let bv: string | number = '';
            if (sortKey === 'name') {
                av = a.employee.name.toLowerCase();
                bv = b.employee.name.toLowerCase();
            } else if (sortKey === 'signed_at') {
                av = a.signed_at || '';
                bv = b.signed_at || '';
            } else {
                av = a.carried_from_version?.version_number ?? '';
                bv = b.carried_from_version?.version_number ?? '';
            }
            if (av < bv) return sortDir === 'asc' ? -1 : 1;
            if (av > bv) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
        return rows;
    }, [signed, sortKey, sortDir]);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir(key === 'name' ? 'asc' : 'desc');
        }
    };

    const SortIcon = ({ k }: { k: SortKey }) => {
        if (sortKey !== k) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-40" />;
        return sortDir === 'asc' ? (
            <ArrowUp className="ml-1 inline h-3 w-3" />
        ) : (
            <ArrowDown className="ml-1 inline h-3 w-3" />
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${swms.name} — ${version.version_number}`} />
            <div className="mx-auto w-full max-w-5xl space-y-6 p-4">
                <div className="flex flex-row items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-semibold">SWMS Version {version.version_number}</h1>
                            <Badge variant={statusBadgeVariant(version.status)}>{version.status_label}</Badge>
                        </div>
                        {version.previous_version && (
                            <p className="text-muted-foreground mt-1 text-sm">
                                Supersedes{' '}
                                <Link
                                    href={`${baseUrl}/${swms.id}/versions/${version.previous_version.id}`}
                                    className="hover:underline"
                                >
                                    version {version.previous_version.version_number}
                                </Link>
                            </p>
                        )}
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                                Actions
                                <EllipsisVertical className="ml-2 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-max">
                            {version.document_url ? (
                                <DropdownMenuItem asChild className="whitespace-nowrap">
                                    <a href={`${versionBase}/document`} target="_blank" rel="noreferrer">
                                        Download SWMS File
                                    </a>
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem disabled className="whitespace-nowrap">
                                    Download SWMS File (no file)
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem asChild className="whitespace-nowrap">
                                <a href={`${versionBase}/sign-sheet`} target="_blank" rel="noreferrer">
                                    Download SWMS Signed Sheet
                                </a>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild className="whitespace-nowrap">
                                <Link href={`${baseUrl}/${swms.id}`}>View all versions</Link>
                            </DropdownMenuItem>
                            {can('swms.edit') && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="whitespace-nowrap" onClick={() => setEditOpen(true)}>
                                        Edit details
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <Card>
                    <CardContent>
                        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm md:grid-cols-2">
                            <div>
                                <dt className="text-muted-foreground text-xs uppercase tracking-wide">SWMS name</dt>
                                <dd className="font-medium">
                                    <Link href={`${baseUrl}/${swms.id}`} className="hover:underline">
                                        {swms.name}
                                    </Link>
                                </dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground text-xs uppercase tracking-wide">SWMS no</dt>
                                <dd className="font-medium">{version.version_number}</dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground text-xs uppercase tracking-wide">Created</dt>
                                <dd>
                                    {fmtDateTime(version.created_at)}
                                    {version.created_by && (
                                        <span className="text-muted-foreground"> · by {version.created_by.name}</span>
                                    )}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground text-xs uppercase tracking-wide">Updated</dt>
                                <dd>
                                    {fmtDateTime(version.updated_at)}
                                    {version.updated_by && (
                                        <span className="text-muted-foreground"> · by {version.updated_by.name}</span>
                                    )}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground text-xs uppercase tracking-wide">Approved at</dt>
                                <dd>{fmtDate(version.approved_at)}</dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground text-xs uppercase tracking-wide">Re-signature</dt>
                                <dd>{version.requires_resignature ? 'Required' : 'Carried forward'}</dd>
                            </div>
                            {version.change_summary && (
                                <div className="md:col-span-2">
                                    <dt className="text-muted-foreground text-xs uppercase tracking-wide">Change summary</dt>
                                    <dd>{version.change_summary}</dd>
                                </div>
                            )}
                        </dl>
                    </CardContent>
                </Card>

                <div className="space-y-3">
                    <h2 className="text-base font-semibold">Signed ({signed.length})</h2>
                    <div className="rounded-md border">
                        <Table className="[&_td]:py-1 [&_th]:h-auto [&_th]:py-1">
                            <TableHeader>
                                <TableRow>
                                    <TableHead
                                        className="cursor-pointer select-none"
                                        onClick={() => toggleSort('name')}
                                    >
                                        Signed by <SortIcon k="name" />
                                    </TableHead>
                                    <TableHead>Signature</TableHead>
                                    <TableHead
                                        className="cursor-pointer select-none"
                                        onClick={() => toggleSort('signed_at')}
                                    >
                                        Signed at <SortIcon k="signed_at" />
                                    </TableHead>
                                    <TableHead
                                        className="cursor-pointer select-none"
                                        onClick={() => toggleSort('carried')}
                                    >
                                        Origin <SortIcon k="carried" />
                                    </TableHead>
                                    <TableHead className="w-24"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedSigned.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-muted-foreground py-6 text-center">
                                            Nobody has signed this version yet.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {sortedSigned.map((s) => (
                                    <TableRow key={s.id}>
                                        <TableCell>{s.employee.name}</TableCell>
                                        <TableCell>
                                            {s.signature_url ? (
                                                <img
                                                    src={s.signature_url}
                                                    alt="Signature"
                                                    className="h-7 max-w-[140px] object-contain"
                                                />
                                            ) : (
                                                <span className="text-muted-foreground text-xs">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>{fmtDateTime(s.signed_at)}</TableCell>
                                        <TableCell>
                                            {s.carried_from_version ? (
                                                <Link
                                                    href={s.carried_from_version.url}
                                                    className="text-muted-foreground hover:underline"
                                                >
                                                    Originally signed version {s.carried_from_version.version_number}
                                                </Link>
                                            ) : (
                                                <span className="text-muted-foreground">Signed here</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {s.signature_download_url && (
                                                <Button asChild variant="ghost" size="sm">
                                                    <a href={s.signature_download_url}>
                                                        <Download className="h-4 w-4" />
                                                    </a>
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <div className="space-y-3">
                    <h2 className="text-base font-semibold">Not yet signed ({unsigned.length})</h2>
                    <div className="rounded-md border">
                        <Table className="[&_td]:py-1 [&_th]:h-auto [&_th]:py-1">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-10">#</TableHead>
                                        <TableHead>Worker</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {unsigned.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={2} className="text-muted-foreground py-6 text-center">
                                                All assigned workers have signed.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {unsigned.map((e, idx) => (
                                        <TableRow key={e.id}>
                                            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                                            <TableCell>{e.name}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                    </div>
                </div>
            </div>

            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit version</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={submitEdit} className="space-y-4">
                        <div>
                            <Label htmlFor="edit-version_number">Version number</Label>
                            <Input
                                id="edit-version_number"
                                value={editForm.data.version_number}
                                onChange={(e) => editForm.setData('version_number', e.target.value)}
                            />
                            {editForm.errors.version_number && (
                                <p className="text-destructive mt-1 text-xs">{editForm.errors.version_number}</p>
                            )}
                        </div>

                        <div>
                            <Label htmlFor="edit-approved_at">Approved at</Label>
                            <Input
                                id="edit-approved_at"
                                type="date"
                                value={editForm.data.approved_at}
                                onChange={(e) => editForm.setData('approved_at', e.target.value)}
                            />
                            {editForm.errors.approved_at && (
                                <p className="text-destructive mt-1 text-xs">{editForm.errors.approved_at}</p>
                            )}
                        </div>

                        <div>
                            <Label htmlFor="edit-change_summary">Change summary</Label>
                            <Textarea
                                id="edit-change_summary"
                                rows={3}
                                value={editForm.data.change_summary}
                                onChange={(e) => editForm.setData('change_summary', e.target.value)}
                            />
                            {editForm.errors.change_summary && (
                                <p className="text-destructive mt-1 text-xs">{editForm.errors.change_summary}</p>
                            )}
                        </div>

                        <div className="flex items-start gap-2">
                            <Checkbox
                                id="edit-requires_resignature"
                                checked={editForm.data.requires_resignature}
                                onCheckedChange={(v) => editForm.setData('requires_resignature', !!v)}
                            />
                            <div>
                                <Label htmlFor="edit-requires_resignature" className="cursor-pointer">
                                    Workers must re-sign this version
                                </Label>
                                <p className="text-muted-foreground text-xs">
                                    Unticking will carry forward signatures from the prior version (existing signers on this version are kept).
                                </p>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={editForm.processing}>
                                Save changes
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
