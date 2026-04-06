import { Button } from '@/components/ui/button';
import { DatePickerDemo } from '@/components/date-picker';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { router } from '@inertiajs/react';
import { format } from 'date-fns';
import { FileText, Loader2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import Dropzone from 'shadcn-dropzone';

interface FileType {
    id: number;
    name: string;
    category: string | null;
    has_back_side: boolean;
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    employeeId: number;
    fileTypes: FileType[];
}

export default function UploadFileDialog({ open, onOpenChange, employeeId, fileTypes }: Props) {
    const [category, setCategory] = useState('');
    const [typeId, setTypeId] = useState('');
    const [expiresAt, setExpiresAt] = useState<Date | undefined>(undefined);
    const [fileFront, setFileFront] = useState<File | null>(null);
    const [fileBack, setFileBack] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const selectedType = fileTypes.find((t) => String(t.id) === typeId);

    const categories = useMemo(() => {
        const cats = new Set(fileTypes.map((ft) => ft.category || 'Other'));
        return Array.from(cats).sort();
    }, [fileTypes]);

    const filteredTypes = useMemo(() => {
        if (!category) return [];
        return fileTypes.filter((ft) => (ft.category || 'Other') === category);
    }, [fileTypes, category]);

    const reset = () => {
        setCategory('');
        setTypeId('');
        setExpiresAt(undefined);
        setFileFront(null);
        setFileBack(null);
    };

    const handleSubmit = () => {
        if (!typeId || !fileFront) return;
        setSubmitting(true);

        const data: Record<string, string | File> = {
            employee_file_type_id: typeId,
            file_front: fileFront,
        };
        if (expiresAt) data.expires_at = format(expiresAt, 'yyyy-MM-dd');
        if (fileBack) data.file_back = fileBack;

        router.post(`/employees/${employeeId}/files`, data, {
            forceFormData: true,
            onFinish: () => setSubmitting(false),
            onSuccess: () => {
                reset();
                onOpenChange(false);
            },
        });
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                if (!v) reset();
                onOpenChange(v);
            }}
        >
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Upload Employee File</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <Label>Document Type</Label>
                        <Select
                            value={category}
                            onValueChange={(v) => {
                                setCategory(v);
                                setTypeId('');
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select type..." />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map((cat) => (
                                    <SelectItem key={cat} value={cat}>
                                        {cat}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {category && (
                        <div className="flex flex-col gap-1.5">
                            <Label>Document Name</Label>
                            <Select value={typeId} onValueChange={setTypeId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select document..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {filteredTypes.map((ft) => (
                                        <SelectItem key={ft.id} value={String(ft.id)}>
                                            {ft.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {typeId && (
                        <>
                            <div className="flex flex-col gap-1.5">
                                <Label>Expiry Date</Label>
                                <DatePickerDemo
                                    value={expiresAt}
                                    onChange={setExpiresAt}
                                    placeholder="Select expiry date"
                                    className="w-full"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label>Front Side</Label>
                                {fileFront ? (
                                    <div className="bg-muted/50 flex items-center gap-2 rounded-md border px-3 py-2">
                                        <FileText size={16} className="text-muted-foreground shrink-0" />
                                        <span className="flex-1 truncate text-sm">{fileFront.name}</span>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setFileFront(null)}>
                                            <X size={14} />
                                        </Button>
                                    </div>
                                ) : (
                                    <Dropzone onDrop={(files) => files.length > 0 && setFileFront(files[0])} maxFiles={1} multiple={false} />
                                )}
                            </div>

                            {selectedType?.has_back_side && (
                                <div className="flex flex-col gap-1.5">
                                    <Label>Back Side</Label>
                                    {fileBack ? (
                                        <div className="bg-muted/50 flex items-center gap-2 rounded-md border px-3 py-2">
                                            <FileText size={16} className="text-muted-foreground shrink-0" />
                                            <span className="flex-1 truncate text-sm">{fileBack.name}</span>
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setFileBack(null)}>
                                                <X size={14} />
                                            </Button>
                                        </div>
                                    ) : (
                                        <Dropzone onDrop={(files) => files.length > 0 && setFileBack(files[0])} maxFiles={1} multiple={false} />
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting || !typeId || !fileFront}>
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Upload
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
