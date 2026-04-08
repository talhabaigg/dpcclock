import AppLayout from '@/layouts/app-layout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { X } from 'lucide-react';
import Dropzone from 'shadcn-dropzone';
import { useState } from 'react';

interface Location {
    id: number;
    name: string;
}

interface Attendee {
    employee_id: number;
    employee_name: string;
    signed: boolean;
}

interface Talk {
    id: string;
    meeting_date: string;
    meeting_date_formatted: string;
    location: Location | null;
}

interface SignedPdf {
    id: number;
    file_name: string;
    url: string;
}

interface Props {
    talk: Talk;
    attendees: Attendee[];
    signedPdf: SignedPdf | null;
}

export default function UploadSignatures({ talk, attendees, signedPdf }: Props) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Toolbox Talks', href: '/toolbox-talks' },
        { title: talk.meeting_date_formatted, href: `/toolbox-talks/${talk.id}` },
        { title: 'Upload Signatures', href: '#' },
    ];

    const [localAttendees, setLocalAttendees] = useState<Record<number, 'signed' | 'other'>>(() => {
        const initial: Record<number, 'signed' | 'other'> = {};
        attendees.forEach((a) => {
            initial[a.employee_id] = a.signed ? 'signed' : 'other';
        });
        return initial;
    });

    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);

    const handleSave = () => {
        setSaving(true);
        const formData = new FormData();

        attendees.forEach((a, i) => {
            formData.append(`attendees[${i}][employee_id]`, String(a.employee_id));
            formData.append(`attendees[${i}][signed]`, localAttendees[a.employee_id] === 'signed' ? '1' : '0');
        });

        if (pdfFile) {
            formData.append('signed_pdf', pdfFile);
        }

        router.post(`/toolbox-talks/${talk.id}/upload-signatures`, formData, {
            forceFormData: true,
            onFinish: () => setSaving(false),
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Upload Signatures" />
            <div className="mx-auto w-full max-w-3xl space-y-6 p-4">
                {/* Attendee list */}
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Signed or other</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {attendees.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={2} className="py-8 text-center text-muted-foreground">
                                        No employees found for this location.
                                    </TableCell>
                                </TableRow>
                            )}
                            {attendees.map((a) => (
                                <TableRow key={a.employee_id}>
                                    <TableCell className="font-medium">{a.employee_name}</TableCell>
                                    <TableCell>
                                        <RadioGroup
                                            value={localAttendees[a.employee_id] ?? 'other'}
                                            onValueChange={(val) => setLocalAttendees((prev) => ({ ...prev, [a.employee_id]: val as 'signed' | 'other' }))}
                                            className="flex items-center gap-6"
                                        >
                                            <div className="flex items-center gap-2">
                                                <RadioGroupItem value="signed" id={`signed-${a.employee_id}`} />
                                                <Label htmlFor={`signed-${a.employee_id}`} className="cursor-pointer font-normal">Signed</Label>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <RadioGroupItem value="other" id={`other-${a.employee_id}`} />
                                                <Label htmlFor={`other-${a.employee_id}`} className="cursor-pointer font-normal">Other</Label>
                                            </div>
                                        </RadioGroup>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Upload signed PDF */}
                <div className="space-y-2">
                    {signedPdf && !pdfFile && (
                        <div className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
                            <a href={signedPdf.url} target="_blank" rel="noreferrer" className="flex-1 text-blue-600 hover:underline">
                                {signedPdf.file_name}
                            </a>
                            <span className="text-xs text-muted-foreground">Current file</span>
                        </div>
                    )}
                    <Dropzone onDrop={(files) => setPdfFile(files[0] ?? null)} maxFiles={1} multiple={false} accept={{ 'application/pdf': ['.pdf'] }} />
                    {pdfFile && (
                        <div className="flex items-center gap-2 text-sm">
                            <span className="flex-1">{pdfFile.name}</span>
                            <button type="button" onClick={() => setPdfFile(null)}>
                                <X className="h-4 w-4 text-destructive" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4">
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? 'Uploading...' : 'Upload signatures'}
                    </Button>
                    <Button variant="ghost" asChild>
                        <Link href={`/toolbox-talks/${talk.id}`}>Cancel</Link>
                    </Button>
                </div>
            </div>
        </AppLayout>
    );
}
